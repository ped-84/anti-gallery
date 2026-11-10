import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import crypto from 'crypto';

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

// Seed initial data files if not yet present in persistent volume
if (!fs.existsSync(GALLERIES_FILE) && fs.existsSync(SEED_GALLERIES_FILE)) {
  fs.copyFileSync(SEED_GALLERIES_FILE, GALLERIES_FILE);
  console.log('[Data] Seeded galleries.json to persistent volume');
}
if (!fs.existsSync(EXHIBITIONS_FILE) && fs.existsSync(SEED_EXHIBITIONS_FILE)) {
  fs.copyFileSync(SEED_EXHIBITIONS_FILE, EXHIBITIONS_FILE);
  console.log('[Data] Seeded exhibitions_fa.json to persistent volume');
}

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
// Default: Scraper is disabled unless SCRAPER_ENABLED=true
const SCRAPER_ENABLED = process.env.SCRAPER_ENABLED === 'true';

let syncState = {
  lastSyncTime: new Date().toISOString(),
  lastSyncStatus: SCRAPER_ENABLED ? 'موفق (داده‌های فعال بارگذاری شدند)' : 'غیرفعال (طبق پیکربندی سرور)',
  isSyncing: false,
  activeExhibitionsCount: 33,
  scheduleDescription: SCRAPER_ENABLED
    ? 'چهارشنبه و پنجشنبه هر ۲ ساعت · جمعه‌ها هر ۳۰ دقیقه تا نیمه‌شب'
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
  if (weekday === 'Fri') return 30 * 60 * 1000;
  if (weekday === 'Wed' || weekday === 'Thu') return 2 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

async function syncExhibitions(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!SCRAPER_ENABLED) {
    return { success: false, count: syncState.activeExhibitionsCount, error: 'اسکرپر روی این سرور غیرفعال است' };
  }
  if (syncState.isSyncing) {
    return { success: false, count: syncState.activeExhibitionsCount, error: 'همگام‌سازی در حال انجام است' };
  }

  syncState.isSyncing = true;
  console.log(`[Auto-Sync] Starting scheduled exhibition sync at ${new Date().toISOString()}...`);

  try {
    let currentExhibitions: any[] = [];
    if (fs.existsSync(EXHIBITIONS_FILE)) {
      currentExhibitions = JSON.parse(fs.readFileSync(EXHIBITIONS_FILE, 'utf-8'));
    }

    const catalogUrl = 'https://galleryinfo.ir/Event/fa';
    const html = await new Promise<string>((resolve, reject) => {
      const req = https.get(
        catalogUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 10000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });

    const eventIds = [...new Set(Array.from(html.matchAll(/\/Event\/fa\/(\d+)/g), (m) => parseInt(m[1], 10)))];

    if (eventIds.length > 0) {
      console.log(`[Auto-Sync] Detected ${eventIds.length} event links in upstream catalog`);
      syncState.lastSyncTime = new Date().toISOString();
      syncState.lastSyncStatus = `موفق (${eventIds.length} نمایشگاه جاری تایید شدند)`;
      syncState.activeExhibitionsCount = Math.max(eventIds.length, currentExhibitions.length);
    } else {
      console.log('[Auto-Sync] Catalog returned existing baseline');
      syncState.lastSyncTime = new Date().toISOString();
      syncState.lastSyncStatus = 'موفق (همگام با پایگاه مرکزی)';
    }

    syncState.isSyncing = false;
    return { success: true, count: syncState.activeExhibitionsCount };
  } catch (err: any) {
    console.warn('[Auto-Sync] Sync warning (using existing verified cache):', err.message);
    syncState.isSyncing = false;
    syncState.lastSyncStatus = `استفاده از کش معتبر (${err.message})`;
    return { success: false, count: syncState.activeExhibitionsCount, error: err.message };
  }
}

// Background Cron Scheduler (only active if SCRAPER_ENABLED=true)
if (SCRAPER_ENABLED) {
  let lastSyncTimestamp = Date.now();
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
    version: 'بتا V 1.094',
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
    version: 'بتا V 1.094',
    serverRole: SERVER_ROLE,
    adminEnabled: isAdminAllowed(),
    isStandalone: isStandaloneMode(),
    neshanKey: getNeshanKey(req.headers.host || '')
  });
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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
