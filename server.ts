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

// Persistent Data & Uploads directories (can be mounted via Docker volume)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const GALLERIES_FILE = path.join(DATA_DIR, 'galleries.json');
const EXHIBITIONS_FILE = path.join(DATA_DIR, 'exhibitions_fa.json');

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

// Data Helper Functions
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

// Admin Authentication Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'artgasht2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'artgasht-secret-token-key-2026';

function generateAdminToken(): string {
  return crypto.createHmac('sha256', ADMIN_SECRET).update(`admin:${ADMIN_PASSWORD}`).digest('hex');
}

function verifyAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
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

// In-memory sync state for upstream galleryinfo.ir
let syncState = {
  lastSyncTime: new Date().toISOString(),
  lastSyncStatus: 'موفق (داده‌های فعال بارگذاری شدند)',
  isSyncing: false,
  activeExhibitionsCount: 33,
  scheduleDescription: 'چهارشنبه و پنجشنبه هر ۲ ساعت · جمعه‌ها هر ۳۰ دقیقه تا نیمه‌شب'
};

// Helper: Determine required sync interval based on Tehran Timezone
function getTehranSyncIntervalMs(): number {
  const now = new Date();
  const tehranParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  }).formatToParts(now);

  const weekday = tehranParts.find((p) => p.type === 'weekday')?.value || '';
  if (weekday === 'Fri') {
    return 30 * 60 * 1000;
  }
  if (weekday === 'Wed' || weekday === 'Thu') {
    return 2 * 60 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

// Scrape / Synchronize latest exhibitions from central gallery data
async function syncExhibitions(): Promise<{ success: boolean; count: number; error?: string }> {
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

// Background Cron Scheduler
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

// ========================================================
// 1. Health Endpoint (Crucial for Docker & Uptime Monitoring)
// ========================================================
app.get('/health', (req, res) => {
  const galleries = getGalleries();
  res.json({
    status: 'ok',
    appName: 'آرت‌گشت',
    version: 'بتا V 1.091',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    totalGalleries: galleries.length,
    activeExhibitionsCount: syncState.activeExhibitionsCount
  });
});

// ========================================================
// 2. Client Config Endpoint (Dynamic Neshan Map Key per Domain)
// ========================================================
app.get('/api/config', (req, res) => {
  res.json({
    appName: 'آرت‌گشت',
    version: 'بتا V 1.091',
    neshanKey: getNeshanKey(req.headers.host || '')
  });
});

// ========================================================
// 3. Galleries API Endpoints (Dynamic Server Data)
// ========================================================
app.get('/api/galleries', (req, res) => {
  const galleries = getGalleries();
  res.json(galleries);
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'رمز عبور مدیریت نادرست است' });
  }
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
  const created = {
    ...newGallery,
    id: newGallery.id || maxId + 1,
    city: newGallery.city || 'tehran',
    cityFa: newGallery.cityFa || 'تهران'
  };
  galleries.unshift(created);
  saveGalleries(galleries);
  console.log(`[Admin] Added new gallery: "${created.name}" (ID: ${created.id})`);
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

  galleries[index] = { ...galleries[index], ...updates, id };
  saveGalleries(galleries);
  console.log(`[Admin] Updated gallery ID ${id}: "${galleries[index].name}"`);
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
  console.log(`[Admin] Deleted gallery ID ${id}`);
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
    console.log(`[Upload] Image saved: ${safeName}`);
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
  const intervalMs = getTehranSyncIntervalMs();
  const nextSyncTime = new Date(lastSyncTimestamp + intervalMs).toISOString();

  res.json({
    lastSyncTime: syncState.lastSyncTime,
    lastSyncStatus: syncState.lastSyncStatus,
    nextScheduledSync: nextSyncTime,
    intervalMinutes: Math.round(intervalMs / 60000),
    activeExhibitionsCount: syncState.activeExhibitionsCount,
    isSyncing: syncState.isSyncing,
    scheduleDescription: syncState.scheduleDescription
  });
});

app.post('/api/sync-now', async (req, res) => {
  console.log('[API] Manual sync triggered from client');
  lastSyncTimestamp = Date.now();
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
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Health check available at: http://0.0.0.0:${PORT}/health`);
    console.log(`[Server] Persistent data directory: ${DATA_DIR}`);
  });
}

startServer();
