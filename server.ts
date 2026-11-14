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

// Synchronize persistent volume with bundled seed baseline when seed is newer or has equal/more data
function syncVolumeFromSeed(volumePath: string, seedPath: string, name: string) {
  if (!fs.existsSync(seedPath)) return;
  if (!fs.existsSync(volumePath)) {
    fs.copyFileSync(seedPath, volumePath);
    console.log(`[Data] Seeded ${name} to persistent volume`);
    return;
  }
  try {
    const seedStat = fs.statSync(seedPath);
    const volStat = fs.statSync(volumePath);
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const volData = JSON.parse(fs.readFileSync(volumePath, 'utf-8'));

    let shouldUpdate = false;
    if (Array.isArray(seedData) && Array.isArray(volData)) {
      const seedActive = seedData.filter((x: any) => x.activeExhibition || x.openingDate).length;
      const volActive = volData.filter((x: any) => x.activeExhibition || x.openingDate).length;
      if (
        seedActive > volActive ||
        (seedActive >= volActive && seedStat.mtimeMs > volStat.mtimeMs) ||
        seedData.length > volData.length
      ) {
        shouldUpdate = true;
      }
    } else if (seedStat.mtimeMs > volStat.mtimeMs) {
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      fs.copyFileSync(seedPath, volumePath);
      console.log(`[Data] Auto-updated persistent ${name} from newer bundled seed`);
    }
  } catch (e) {
    console.warn(`[Data] Error checking seed vs volume for ${name}:`, e);
  }
}

syncVolumeFromSeed(GALLERIES_FILE, SEED_GALLERIES_FILE, 'galleries.json');
syncVolumeFromSeed(EXHIBITIONS_FILE, SEED_EXHIBITIONS_FILE, 'exhibitions_fa.json');

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
  fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleries, null, 2), 'utf-8');
}

// ========================================================
// 2. Admin Authentication & Rate Limiting
// ========================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'artgasht2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'artgasht-secret-token-key-2026';

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

function generateAdminToken(): string {
  return crypto.createHmac('sha256', ADMIN_SECRET).update(`admin:${ADMIN_PASSWORD}`).digest('hex');
}

function verifyAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isAdminAllowed()) {
    return res.status(403).json({
      error: 'پنل مدیریت در سرور آینه (Mirror) غیرفعال است. ویرایش تنها در سرور اصلی (Primary) یا با فعال‌سازی حالت STANDALONE مجاز است.'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-token'] as string);
  const expected = generateAdminToken();

  if (!token || token !== expected) {
    return res.status(401).json({ error: 'دسترسی غیرمجاز. لطفاً با رمز عبور مدیریت وارد شوید.' });
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
  const galleries = getGalleries();
  res.json({
    status: 'ok',
    appName: 'آرت‌گشت',
    version: 'بتا V 1.114',
    serverRole: SERVER_ROLE, // 'primary' | 'mirror'
    adminEnabled: isAdminAllowed(),
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
    version: 'بتا V 1.114',
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
  const galleries = getGalleries();
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

  if (!isAdminAllowed()) {
    return res.status(403).json({
      success: false,
      error: 'پنل مدیریت روی سرور آینه (Mirror) غیرفعال است. ویرایش تنها روی سرور اصلی آلمان یا در حالت STANDALONE مجاز است.'
    });
  }

  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    recordFailedLogin(clientIp);
    return res.status(401).json({ success: false, error: 'رمز عبور مدیریت نادرست است' });
  }

  recordSuccessfulLogin(clientIp);
  res.json({ success: true, token: generateAdminToken() });
});

// Admin: Add Gallery / Exhibition
app.post('/api/admin/galleries', verifyAdminAuth, (req, res) => {
  const newGallery = req.body;
  if (!newGallery || !newGallery.name) {
    return res.status(400).json({ error: 'نام نگارخانه الزامی است' });
  }
  const galleries = getGalleries();
  const maxId = galleries.reduce((max, g) => (typeof g.id === 'number' && g.id > max ? g.id : max), 1000);
  const nowIso = new Date().toISOString();

  const created = {
    ...newGallery,
    id: newGallery.id || maxId + 1,
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
app.put('/api/admin/galleries/:id', verifyAdminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const updates = req.body;
  const galleries = getGalleries();
  const index = galleries.findIndex((g) => g.id === id);

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
app.delete('/api/admin/galleries/:id', verifyAdminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const galleries = getGalleries();
  const filtered = galleries.filter((g) => g.id !== id);

  if (filtered.length === galleries.length) {
    return res.status(404).json({ error: 'نگارخانه مورد نظر یافت نشد' });
  }

  saveGalleries(filtered);
  console.log(`[Admin] Deleted gallery ID ${id} on ${SERVER_ROLE}`);
  res.json({ success: true, message: 'نگارخانه با موفقیت حذف گردید' });
});

// Admin: Upload Image (Stored in persistent data/uploads/)
app.post('/api/admin/upload', verifyAdminAuth, (req, res) => {
  try {
    const { filename, base64Data } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ error: 'داده تصویر ارسال نشده است' });
    }

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const ext = matches ? (matches[1].split('/')[1] || 'jpg') : 'jpg';
    const cleanBase64 = matches ? matches[2] : base64Data;

    const safeExt = ext === 'jpeg' ? 'jpg' : ext.replace(/[^a-zA-Z0-9]/g, '');
    const safeName = `poster_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${safeExt}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
    console.log(`[Upload] Image saved: ${safeName} on ${SERVER_ROLE}`);
    res.json({ success: true, url: `/uploads/${safeName}` });
  } catch (err: any) {
    console.error('[Upload] Error saving image:', err.message);
    res.status(500).json({ error: `خطا در ذخیره تصویر: ${err.message}` });
  }
});

// Serve persistent uploads statically
app.use('/uploads', express.static(UPLOADS_DIR));

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

    // Serve static files with proper caching headers
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const norm = filePath.replace(/\\/g, '/');
        if (norm.endsWith('/index.html') || norm.endsWith('/sw.js') || norm.endsWith('/manifest.json')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (norm.includes('/assets/')) {
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
  });
}

startServer();
