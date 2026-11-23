import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';
import { fork } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// High body size limit for base64 image uploads in admin
app.use(express.json({ limit: '20mb' }));

// Persistent Data & Uploads directories (mounted via Docker volume)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const IMAGE_CACHE_DIR = path.join(DATA_DIR, 'image_cache');
const GALLERIES_FILE = path.join(DATA_DIR, 'galleries.json');
const EXHIBITIONS_FILE = path.join(DATA_DIR, 'exhibitions_fa.json');
const STANDALONE_FILE = path.join(DATA_DIR, 'STANDALONE');
const LAST_SYNC_FILE = path.join(DATA_DIR, 'last-sync.txt');

// Source seed baseline files
const SEED_GALLERIES_FILE = path.join(__dirname, 'src', 'data', 'galleries.json');
const SEED_EXHIBITIONS_FILE = path.join(__dirname, 'src', 'data', 'exhibitions_fa.json');

// Ensure persistent folders exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

// --------------------------------------------------------
// Safe JSON persistence
// --------------------------------------------------------
// Write to a temp file in the same folder, then rename over the target.
// rename() is atomic on the same filesystem, so a crash mid-write can never
// leave a half-written (corrupt) galleries.json behind.
function writeJsonAtomic(filePath: string, data: unknown) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonArray(filePath: string): any[] | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const BACKUP_DIR = path.join(DATA_DIR, 'backups', 'startup');
const MAX_STARTUP_BACKUPS = 10;

// Keep a copy of the live file before startup touches it (last 10 kept).
function backupBeforeChange(filePath: string, name: string) {
  try {
    if (!fs.existsSync(filePath)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(filePath, path.join(BACKUP_DIR, `${name}.${stamp}.json`));
    const old = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith(`${name}.`))
      .sort()
      .reverse()
      .slice(MAX_STARTUP_BACKUPS);
    old.forEach((f) => fs.rmSync(path.join(BACKUP_DIR, f), { force: true }));
  } catch (e) {
    console.warn(`[Data] Could not back up ${name}:`, e);
  }
}

function timestampOf(record: any): number {
  const t = record && record.updatedAt ? new Date(record.updatedAt).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

// Merge the seed bundled in the Docker image into the live data on the volume.
// The live data is the source of truth (admin edits + server scraper). Rules:
//   - seed record whose id is not on the volume  -> added
//   - same id, seed has a strictly newer updatedAt -> seed version wins
//   - otherwise the volume version is kept (admin edits, soft deletes survive deploys)
//   - nothing is ever removed from the volume
function mergeSeedIntoLive(live: any[], seed: any[]): { merged: any[]; added: number; updated: number } {
  const byId = new Map<any, number>();
  live.forEach((g, i) => {
    if (g && g.id !== undefined) byId.set(g.id, i);
  });
  const merged = live.slice();
  let added = 0;
  let updated = 0;
  for (const s of seed) {
    if (!s || s.id === undefined) continue;
    const idx = byId.get(s.id);
    if (idx === undefined) {
      merged.push(s);
      byId.set(s.id, merged.length - 1);
      added++;
    } else if (timestampOf(s) > timestampOf(merged[idx])) {
      // Never resurrect a record that was deleted on the live server.
      merged[idx] = merged[idx].deleted ? { ...s, deleted: true, deletedAt: merged[idx].deletedAt } : s;
      updated++;
    }
  }
  return { merged, added, updated };
}

function syncGalleriesFromSeed() {
  const seed = readJsonArray(SEED_GALLERIES_FILE);
  if (!seed) return;
  const live = readJsonArray(GALLERIES_FILE);
  if (!live || live.length === 0) {
    if (fs.existsSync(GALLERIES_FILE)) backupBeforeChange(GALLERIES_FILE, 'galleries-unreadable');
    writeJsonAtomic(GALLERIES_FILE, seed);
    console.log(`[Data] Seeded galleries.json (${seed.length} records)`);
    return;
  }
  const { merged, added, updated } = mergeSeedIntoLive(live, seed);
  if (added === 0 && updated === 0) {
    console.log('[Data] galleries.json is up to date with the seed; nothing changed');
    return;
  }
  backupBeforeChange(GALLERIES_FILE, 'galleries');
  writeJsonAtomic(GALLERIES_FILE, merged);
  console.log(`[Data] Merged seed into galleries.json: ${added} added, ${updated} newer from seed`);
}

// Exhibitions file is written only by the scraper; keep the live copy unless it is missing or broken.
function syncExhibitionsFromSeed() {
  const seed = readJsonArray(SEED_EXHIBITIONS_FILE);
  if (!seed) return;
  const live = readJsonArray(EXHIBITIONS_FILE);
  if (live && live.length > 0) return;
  if (fs.existsSync(EXHIBITIONS_FILE)) backupBeforeChange(EXHIBITIONS_FILE, 'exhibitions-unreadable');
  writeJsonAtomic(EXHIBITIONS_FILE, seed);
  console.log(`[Data] Seeded exhibitions_fa.json (${seed.length} records)`);
}

syncGalleriesFromSeed();
syncExhibitionsFromSeed();

// ========================================================
// 1. Role & Standalone Mode Configuration
// ========================================================
// PRIMARY = Germany VPS (artgasht.com) - Source of truth with admin panel enabled
// MIRROR  = Iran VPS (artgasht.ir)    - Normally read-only replica synced from primary
const SERVER_ROLE = (process.env.SERVER_ROLE || 'primary').toLowerCase(); // 'primary' | 'mirror'

function isStandaloneMode(): boolean {
  return fs.existsSync(STANDALONE_FILE);
}

function isAdminAllowed(): boolean {
  if (!ADMIN_CREDENTIALS_OK) return false;
  // If explicitly disabled via env
  if (process.env.ADMIN_ENABLED === 'false') {
    return isStandaloneMode();
  }
  // On primary: admin is enabled by default unless ADMIN_ENABLED=false
  if (SERVER_ROLE === 'primary') {
    return process.env.ADMIN_ENABLED !== 'false';
  }
  // On mirror: admin is strictly DISABLED unless the local STANDALONE flag file exists!
  return isStandaloneMode();
}

function getLastSyncTime(): string | null {
  try {
    if (fs.existsSync(LAST_SYNC_FILE)) {
      return fs.readFileSync(LAST_SYNC_FILE, 'utf-8').trim();
    }
  } catch {}
  return null;
}

// Data Helper Functions (with automatic updatedAt timestamp preservation)
function getGalleries(): any[] {
  try {
    if (fs.existsSync(GALLERIES_FILE)) {
      return JSON.parse(fs.readFileSync(GALLERIES_FILE, 'utf-8'));
    }
    if (fs.existsSync(SEED_GALLERIES_FILE)) {
      return JSON.parse(fs.readFileSync(SEED_GALLERIES_FILE, 'utf-8'));
    }
  } catch (err: any) {
    console.error('[Data] Error reading galleries:', err.message);
  }
  return [];
}

function saveGalleries(galleries: any[]) {
  writeJsonAtomic(GALLERIES_FILE, galleries);
}

// Soft-deleted records stay in the file (so deletes replicate to the mirror and
// survive seed merges) but are never sent to visitors.
function getVisibleGalleries(): any[] {
  return getGalleries().filter((g) => !g.deleted);
}

// ========================================================
// 2. Admin Authentication & Rate Limiting
// ========================================================
// No fallback values: this repository is public, so any default would be a public password.
// If either variable is missing or too short, the admin panel stays disabled.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const KNOWN_PUBLIC_VALUES = new Set([
  'artgasht2026',
  'artgasht-secret-token-key-2026',
  'changeThisToALongRandomAlphanumericPassword2026',
  'generateA32CharAlphanumericSecretStringHere2026',
  'K8mP2x9Lq4vW7zR1tY5nB3cD6eF0jH9a',
  'X7vB2mK9qL4zR1tY5nP8wD3cE6fJ0hA1'
]);
const ADMIN_CREDENTIALS_OK =
  ADMIN_PASSWORD.length >= 12 &&
  ADMIN_SECRET.length >= 16 &&
  !KNOWN_PUBLIC_VALUES.has(ADMIN_PASSWORD) &&
  !KNOWN_PUBLIC_VALUES.has(ADMIN_SECRET);
if (!ADMIN_CREDENTIALS_OK) {
  console.warn(
    '[Security] ADMIN_PASSWORD (12+ chars) and ADMIN_SECRET (16+ chars) must be set in .env to non-public values. Admin panel is DISABLED until then.'
  );
}
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // admin sessions expire after 12 hours

// Rate Limiter for Login: max 5 failed attempts per IP within 15 minutes
interface LoginAttemptRecord {
  failedCount: number;
  lockedUntil: number;
}
const loginRateLimitMap = new Map<string, LoginAttemptRecord>();

function checkRateLimit(ip: string): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);
  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  if (record.lockedUntil <= now && record.failedCount >= 5) {
    loginRateLimitMap.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginRateLimitMap.get(ip) || { failedCount: 0, lockedUntil: 0 };
  record.failedCount += 1;
  if (record.failedCount >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 minute lock
    console.warn(`[Security] IP ${ip} locked out for 15 minutes due to 5 failed login attempts`);
  }
  loginRateLimitMap.set(ip, record);
}

function recordSuccessfulLogin(ip: string) {
  loginRateLimitMap.delete(ip);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signAdminPayload(expiresAt: number): string {
  // Including the password means changing ADMIN_PASSWORD logs out every session.
  return crypto.createHmac('sha256', ADMIN_SECRET).update(`admin:${expiresAt}:${ADMIN_PASSWORD}`).digest('hex');
}

// Token format: "<expiresAtMs>.<hmac>"
function generateAdminToken(): string {
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  return `${expiresAt}.${signAdminPayload(expiresAt)}`;
}

function isValidAdminToken(token: string): boolean {
  const [expStr, sig] = token.split('.');
  const expiresAt = Number(expStr);
  if (!sig || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(sig, signAdminPayload(expiresAt));
}

function verifyAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isAdminAllowed()) {
    return res.status(403).json({
      error: 'پنل مدیریت در سرور آینه (Mirror) غیرفعال است. ویرایش تنها در سرور اصلی (Primary) یا با فعال‌سازی حالت STANDALONE مجاز است.'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-token'] as string);
  if (!token || !isValidAdminToken(token)) {
    return res.status(401).json({ error: 'نشست مدیریت منقضی شده یا نامعتبر است. لطفاً دوباره وارد شوید.' });
  }
  next();
}

// Dynamic Neshan Web Key resolution (per domain env: artgasht.ir vs artgasht.com)
function getNeshanKey(host: string = ''): string {
  const cleanHost = host.toLowerCase();
  if (cleanHost.includes('artgasht.ir') && process.env.NESHAN_KEY_IR) {
    return process.env.NESHAN_KEY_IR;
  }
  if (cleanHost.includes('artgasht.com') && process.env.NESHAN_KEY_COM) {
    return process.env.NESHAN_KEY_COM;
  }
  return process.env.NESHAN_WEB_KEY || 'web.cd0b84e26a35496f87485087bce939da';
}

// ========================================================
// 3. Optional Upstream Scraper (Switchable via SCRAPER_ENABLED)
// ========================================================
// Default: Scraper is enabled by default on Primary, disabled only if SCRAPER_ENABLED=false
const SCRAPER_ENABLED = process.env.SCRAPER_ENABLED !== 'false' && SERVER_ROLE !== 'mirror';

let syncState = {
  lastSyncTime: new Date().toISOString(),
  lastSyncStatus: SCRAPER_ENABLED ? 'موفق (داده‌های فعال بارگذاری شدند)' : 'غیرفعال (طبق پیکربندی سرور)',
  isSyncing: false,
  activeExhibitionsCount: 33,
  scheduleDescription: SCRAPER_ENABLED
    ? 'پنجشنبه شب هر ۳۰ دقیقه · جمعه صبح تا ظهر هر ۱۵ دقیقه · چهارشنبه و پنجشنبه روز هر ۱ ساعت'
    : 'کران‌جاب اسکرپر در این سرور غیرفعال است'
};

function getTehranSyncIntervalMs(): number {
  const now = new Date();
  const tehranParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  }).formatToParts(now);

  const weekday = tehranParts.find((p) => p.type === 'weekday')?.value || '';
  const hour = parseInt(tehranParts.find((p) => p.type === 'hour')?.value || '12', 10);

  // Friday (جمعه): Peak exhibition opening day!
  // From midnight to 14:00 (جمعه صبح تا ظهر): run every 15 minutes!
  // After 14:00 on Friday: run every 30 minutes
  if (weekday === 'Fri') {
    if (hour <= 14) return 15 * 60 * 1000;
    return 30 * 60 * 1000;
  }

  // Thursday (پنجشنبه): Heavy gallery upload night!
  // From 18:00 to midnight (پنجشنبه شب): run every 30 minutes!
  // Daytime Thursday: run every 1 hour
  if (weekday === 'Thu') {
    if (hour >= 18) return 30 * 60 * 1000;
    return 60 * 60 * 1000;
  }

  // Wednesday (چهارشنبه): First wave of upcoming exhibitions
  if (weekday === 'Wed') {
    return 2 * 60 * 60 * 1000;
  }

  // Other days (Sat, Sun, Mon, Tue): 4 times a day
  return 6 * 60 * 60 * 1000;
}

async function syncExhibitions(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!SCRAPER_ENABLED) {
    return { success: false, count: syncState.activeExhibitionsCount, error: 'اسکرپر روی این سرور غیرفعال است' };
  }
  if (syncState.isSyncing) {
    return { success: false, count: syncState.activeExhibitionsCount, error: 'همگام‌سازی در حال انجام است' };
  }

  syncState.isSyncing = true;
  console.log(`[Auto-Sync] Running full GalleryInfo sync at ${new Date().toISOString()}...`);

  try {
    const syncScriptPath = path.join(__dirname, 'scripts', 'sync-galleryinfo.cjs');
    if (!fs.existsSync(syncScriptPath)) {
      throw new Error(`Sync script not found at ${syncScriptPath}`);
    }

    const syncResult = await new Promise<{ code: number | null }>((resolve) => {
      const child = fork(syncScriptPath, [], {
        env: {
          ...process.env,
          DATA_DIR
        },
        stdio: 'inherit'
      });
      child.on('exit', (code) => resolve({ code }));
      child.on('error', (err) => {
        console.error('[Auto-Sync] Fork error:', err.message);
        resolve({ code: 1 });
      });
    });

    if (syncResult.code === 0) {
      const freshGalleries = getGalleries();
      let activeCount = 0;
      if (fs.existsSync(EXHIBITIONS_FILE)) {
        try {
          const exList = JSON.parse(fs.readFileSync(EXHIBITIONS_FILE, 'utf-8'));
          if (Array.isArray(exList)) activeCount = exList.length;
        } catch {}
      }
      syncState.lastSyncTime = new Date().toISOString();
      syncState.lastSyncStatus = `موفق (${freshGalleries.length} نگارخانه و ${activeCount} نمایشگاه به‌روز شدند)`;
      syncState.activeExhibitionsCount = activeCount || freshGalleries.length;
      syncState.isSyncing = false;
      console.log(`[Auto-Sync] Completed successfully! Fresh count: ${freshGalleries.length} galleries.`);
      return { success: true, count: syncState.activeExhibitionsCount };
    } else {
      throw new Error(`Sync script exited with code ${syncResult.code}`);
    }
  } catch (err: any) {
    console.warn('[Auto-Sync] Sync warning (using existing verified database):', err.message);
    syncState.isSyncing = false;
    syncState.lastSyncStatus = `استفاده از پایگاه معتبر (${err.message})`;
    return { success: false, count: syncState.activeExhibitionsCount, error: err.message };
  }
}

// Background Cron Scheduler (only active if SCRAPER_ENABLED=true)
if (SCRAPER_ENABLED) {
  let lastSyncTimestamp = Date.now();

  // Run initial sync shortly after startup
  setTimeout(() => {
    console.log('[Scheduler] Running initial post-startup sync...');
    syncExhibitions().catch((err) => console.error('[Scheduler] Initial sync error:', err));
  }, 5000);

  setInterval(async () => {
    const requiredInterval = getTehranSyncIntervalMs();
    const elapsed = Date.now() - lastSyncTimestamp;

    if (elapsed >= requiredInterval) {
      console.log(`[Scheduler] Interval elapsed. Running sync...`);
      lastSyncTimestamp = Date.now();
      await syncExhibitions();
    }
  }, 60 * 1000);
}

// ========================================================
// 4. Endpoints & API Routes
// ========================================================

// Health check endpoint (exposing role, admin state, sync status)
app.get('/health', (req, res) => {
  const galleries = getVisibleGalleries();
  res.json({
    status: 'ok',
    appName: 'آرت‌گشت',
    version: 'بتا V 1.167',
    serverRole: SERVER_ROLE, // 'primary' | 'mirror'
    adminEnabled: isAdminAllowed(),
    adminConfigured: ADMIN_CREDENTIALS_OK,
    isStandalone: isStandaloneMode(),
    scraperEnabled: SCRAPER_ENABLED,
    lastSyncFromPrimary: getLastSyncTime(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    totalGalleries: galleries.length,
    activeExhibitionsCount: syncState.activeExhibitionsCount
  });
});

// Client runtime configuration
app.get('/api/config', (req, res) => {
  res.json({
    appName: 'آرت‌گشت',
    version: 'بتا V 1.167',
    serverRole: SERVER_ROLE,
    adminEnabled: isAdminAllowed(),
    isStandalone: isStandaloneMode(),
    neshanKey: getNeshanKey(req.headers.host || '')
  });
});

// Hidden Admin Route: Direct access handler (returns 404 if ADMIN_ENABLED=false, redirects to /#/admin if allowed)
app.get(['/admin', '/admin/'], (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!isAdminAllowed()) {
    return res.status(404).send('Not Found');
  }
  res.redirect('/#/admin');
});

// Security & SEO: Ensure all admin API endpoints send noindex robots headers
app.use('/api/admin', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// Serve galleries list
app.get('/api/galleries', (req, res) => {
  const galleries = getVisibleGalleries();
  res.json(galleries);
});

// Admin Login (with rate-limiting)
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const rateCheck = checkRateLimit(clientIp);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${rateCheck.remainingSeconds} ثانیه دیگر مجدداً تلاش کنید.`
    });
  }

  if (!ADMIN_CREDENTIALS_OK) {
    return res.status(403).json({
      success: false,
      error: 'پنل مدیریت غیرفعال است: رمز مدیریت روی سرور تنظیم نشده است (ADMIN_PASSWORD و ADMIN_SECRET در فایل .env).'
    });
  }

  if (!isAdminAllowed()) {
    return res.status(403).json({
      success: false,
      error: 'پنل مدیریت روی سرور آینه (Mirror) غیرفعال است. ویرایش تنها روی سرور اصلی آلمان یا در حالت STANDALONE مجاز است.'
    });
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || !password || !safeEqual(password, ADMIN_PASSWORD)) {
    recordFailedLogin(clientIp);
    return res.status(401).json({ success: false, error: 'رمز عبور مدیریت نادرست است' });
  }

  recordSuccessfulLogin(clientIp);
  res.json({ success: true, token: generateAdminToken() });
});

// The scraper runs in a child process that reads galleries.json, works for a while and
// writes it back. An admin save in between would be silently overwritten, so writes wait.
function rejectIfSyncing(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (syncState.isSyncing) {
    return res.status(409).json({ error: 'همگام‌سازی خودکار نمایشگاه‌ها در حال انجام است. لطفاً یک دقیقه دیگر دوباره ذخیره کنید.' });
  }
  next();
}

// Admin: Add Gallery / Exhibition
app.post('/api/admin/galleries', verifyAdminAuth, rejectIfSyncing, (req, res) => {
  const newGallery = req.body;
  if (!newGallery || !newGallery.name) {
    return res.status(400).json({ error: 'نام نگارخانه الزامی است' });
  }
  const galleries = getGalleries();
  const maxId = galleries.reduce((max, g) => (typeof g.id === 'number' && g.id > max ? g.id : max), 1000);
  const nowIso = new Date().toISOString();

  const { deleted: _d, deletedAt: _da, ...cleanGallery } = newGallery;
  const created = {
    ...cleanGallery,
    id: maxId + 1,
    city: newGallery.city || 'tehran',
    cityFa: newGallery.cityFa || 'تهران',
    updatedAt: nowIso
  };

  galleries.unshift(created);
  saveGalleries(galleries);
  console.log(`[Admin] Added new gallery: "${created.name}" (ID: ${created.id}) on ${SERVER_ROLE}`);
  res.status(201).json(created);
});

// Admin: Update Gallery / Exhibition
app.put('/api/admin/galleries/:id', verifyAdminAuth, rejectIfSyncing, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { deleted: _ignoredDeleted, deletedAt: _ignoredDeletedAt, ...updates } = req.body || {};
  const galleries = getGalleries();
  const index = galleries.findIndex((g) => g.id === id && !g.deleted);

  if (index === -1) {
    return res.status(404).json({ error: 'نگارخانه مورد نظر یافت نشد' });
  }

  const nowIso = new Date().toISOString();
  galleries[index] = {
    ...galleries[index],
    ...updates,
    id,
    updatedAt: nowIso
  };

  saveGalleries(galleries);
  console.log(`[Admin] Updated gallery ID ${id}: "${galleries[index].name}" on ${SERVER_ROLE}`);
  res.json(galleries[index]);
});

// Admin: Delete Gallery
app.delete('/api/admin/galleries/:id', verifyAdminAuth, rejectIfSyncing, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const galleries = getGalleries();
  const index = galleries.findIndex((g) => g.id === id && !g.deleted);

  if (index === -1) {
    return res.status(404).json({ error: 'نگارخانه مورد نظر یافت نشد' });
  }

  // Soft delete: keeps the record so the delete replicates to the mirror and is not
  // brought back by the seed bundled in the next deploy.
  const nowIso = new Date().toISOString();
  galleries[index] = { ...galleries[index], deleted: true, deletedAt: nowIso, updatedAt: nowIso };
  saveGalleries(galleries);
  console.log(`[Admin] Deleted gallery ID ${id} on ${SERVER_ROLE}`);
  res.json({ success: true, message: 'نگارخانه با موفقیت حذف گردید' });
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function detectImageExtension(buf: Buffer): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  const head = buf.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'gif';
  return null;
}

// Admin: Upload Image (Stored in persistent data/uploads/)
app.post('/api/admin/upload', verifyAdminAuth, (req, res) => {
  try {
    const { filename, base64Data } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ error: 'داده تصویر ارسال نشده است' });
    }

    if (typeof base64Data !== 'string') {
      return res.status(400).json({ error: 'داده تصویر نامعتبر است' });
    }
    const matches = base64Data.match(/^data:[^;]+;base64,(.+)$/s);
    const buffer = Buffer.from(matches ? matches[1] : base64Data, 'base64');

    // Decide the type from the file's own bytes, never from what the client claims.
    // Only raster images are accepted (no SVG/HTML, which could run scripts on our domain).
    const safeExt = detectImageExtension(buffer);
    if (!safeExt) {
      return res.status(415).json({ error: 'فقط تصویر JPG، PNG، WebP یا GIF قابل آپلود است' });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد' });
    }

    const safeName = `poster_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${safeExt}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);
    console.log(`[Upload] Image saved: ${safeName} on ${SERVER_ROLE}`);
    res.json({ success: true, url: `/uploads/${safeName}` });
  } catch (err: any) {
    console.error('[Upload] Error saving image:', err.message);
    res.status(500).json({ error: `خطا در ذخیره تصویر: ${err.message}` });
  }
});

// Serve persistent uploads statically
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    }
  })
);

// Upstream sync status & manual trigger
app.get('/api/sync-status', (req, res) => {
  res.json({
    scraperEnabled: SCRAPER_ENABLED,
    lastSyncTime: syncState.lastSyncTime,
    lastSyncStatus: syncState.lastSyncStatus,
    activeExhibitionsCount: syncState.activeExhibitionsCount,
    isSyncing: syncState.isSyncing,
    scheduleDescription: syncState.scheduleDescription
  });
});

app.post('/api/sync-now', async (req, res) => {
  if (!SCRAPER_ENABLED) {
    return res.status(400).json({ error: 'اسکرپر روی این سرور غیرفعال است' });
  }
  const result = await syncExhibitions();
  res.json(result);
});

// Proxy external galleryinfo.ir images with persistent disk cache & immutable Cache-Control
app.get('/api/image-proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || (!targetUrl.startsWith('https://galleryinfo.ir/') && !targetUrl.startsWith('http://galleryinfo.ir/'))) {
    return res.status(400).send('Invalid image URL');
  }

  // Safe hashed disk cache filename
  const hash = crypto.createHash('sha256').update(targetUrl).digest('hex').slice(0, 24);
  const ext = path.extname(targetUrl.split('?')[0]) || '.jpg';
  const cachedFilePath = path.join(IMAGE_CACHE_DIR, `${hash}${ext}`);

  // Serve directly from persistent SSD disk cache (<10ms response time!)
  if (fs.existsSync(cachedFilePath)) {
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(cachedFilePath);
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://galleryinfo.ir/'
      }
    });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Upstream image error');
    }
    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());

    // Asynchronously save to persistent disk cache
    fs.writeFile(cachedFilePath, buffer, (err) => {
      if (err) console.warn('[ImageProxy] Failed to write cache file:', err.message);
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (err: any) {
    res.status(502).send('Error proxying image');
  }
});

// Prewarm top active exhibition images in background on server boot
async function prewarmTopImages() {
  try {
    if (!fs.existsSync(GALLERIES_FILE)) return;
    const raw = fs.readFileSync(GALLERIES_FILE, 'utf-8');
    const galleries = JSON.parse(raw);
    const urlsToWarm: string[] = [];
    for (const g of galleries) {
      if (g.activeExhibition?.poster) urlsToWarm.push(g.activeExhibition.poster);
      else if (g.posterImage) urlsToWarm.push(g.posterImage);
      else if (g.activeExhibition?.posterSmall) urlsToWarm.push(g.activeExhibition.posterSmall);
      else if (g.posterSmall) urlsToWarm.push(g.posterSmall);
      if (urlsToWarm.length >= 25) break;
    }
    for (const url of urlsToWarm) {
      if (!url.includes('galleryinfo.ir/')) continue;
      const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 24);
      const ext = path.extname(url.split('?')[0]) || '.jpg';
      const cachedFilePath = path.join(IMAGE_CACHE_DIR, `${hash}${ext}`);
      if (!fs.existsSync(cachedFilePath)) {
        try {
          const resp = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://galleryinfo.ir/'
            }
          });
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(cachedFilePath, buf);
          }
        } catch (_) {}
      }
    }
    console.log('[ImageCache] Pre-warmed top exhibition images on local disk');
  } catch (e: any) {
    console.warn('[ImageCache] Pre-warm notice:', e.message);
  }
}

// Full-Stack Server Initialization (Vite in dev, static dist in prod)
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted for development');
  } else {
    const distPath = path.join(__dirname, 'dist');

    // Explicit handler for Google Play Trusted Web Activity (TWA) Digital Asset Links
    app.get('/.well-known/assetlinks.json', (_req, res) => {
      const assetlinksFile = path.join(distPath, '.well-known', 'assetlinks.json');
      if (fs.existsSync(assetlinksFile)) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(assetlinksFile);
      }
      res.setHeader('Content-Type', 'application/json');
      res.json([]);
    });

    // Explicit handler for Apple Universal Links (Apple App Site Association - AASA)
    app.get(['/.well-known/apple-app-site-association', '/.well-known/apple-app-site-association.json', '/apple-app-site-association'], (_req, res) => {
      const aasaFile = path.join(distPath, '.well-known', 'apple-app-site-association');
      if (fs.existsSync(aasaFile)) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(aasaFile);
      }
      res.setHeader('Content-Type', 'application/json');
      res.json({
        applinks: {
          apps: [],
          details: [{ appID: "TEAMID.com.artgasht.app", paths: ["*"] }]
        },
        webcredentials: {
          apps: ["TEAMID.com.artgasht.app"]
        }
      });
    });

    // Privacy Policy direct URL for Google Play & CafeBazaar store listing
    app.get(['/privacy', '/privacy/'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });

    // Serve static files with proper caching headers (and dotfiles allowed for .well-known)
    app.use(express.static(distPath, {
      dotfiles: 'allow',
      setHeaders: (res, filePath) => {
        const norm = filePath.replace(/\\/g, '/');
        if (norm.endsWith('/index.html') || norm.endsWith('/sw.js') || norm.endsWith('/manifest.json')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (norm.includes('/assets/') || norm.includes('/fonts/') || norm.includes('/icons/') || norm.includes('/favicon')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    // If an asset in /assets/ is missing, return 404 rather than index.html
    // This prevents index.html from being evaluated as JS/CSS which causes syntax errors
    app.use('/assets', (_req, res) => {
      res.status(404).type('text/plain').send('Asset not found');
    });

    // SPA fallback: ONLY for navigation requests (HTML)
    app.get('*', (req, res) => {
      const ext = path.extname(req.path);
      if (ext && ext !== '.html') {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} [Role: ${SERVER_ROLE.toUpperCase()}]`);
    console.log(`[Server] Admin Allowed: ${isAdminAllowed()} (Standalone: ${isStandaloneMode()})`);
    console.log(`[Server] Persistent data directory: ${DATA_DIR}`);

    // Prewarm image cache after server start
    setTimeout(() => {
      prewarmTopImages();
    }, 2000);
  });
}

startServer();
