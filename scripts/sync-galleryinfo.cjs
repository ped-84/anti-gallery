const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const telegram = require('./telegram-source.cjs');
const darz = require('./darz-source.cjs');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const PERSISTENT_GALLERIES = path.join(DATA_DIR, 'galleries.json');
const PERSISTENT_EXHIBITIONS = path.join(DATA_DIR, 'exhibitions_fa.json');
const SRC_GALLERIES = path.join(ROOT_DIR, 'src', 'data', 'galleries.json');
const SRC_EXHIBITIONS = path.join(ROOT_DIR, 'src', 'data', 'exhibitions_fa.json');
// Same cache the server's /api/image-proxy reads (server.ts IMAGE_CACHE_DIR).
const IMAGE_CACHE_DIR = path.join(DATA_DIR, 'image_cache');
// Read by server.ts after each run so /api/sync-status shows which source was used.
const REPORT_FILE = path.join(DATA_DIR, 'sync-report.json');

function writeReport(report) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify({ at: new Date().toISOString(), ...report }, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Sync] Could not write sync report:', err.message);
  }
}

function fatal(message) {
  const err = new Error(message);
  err.fatal = true;
  return err;
}

function readJsonArraySafe(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

// Must match server.ts /api/image-proxy: sha256(url) first 24 hex chars + extension.
function imageCachePath(url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 24);
  const ext = path.extname(url.split('?')[0]) || '.jpg';
  return path.join(IMAGE_CACHE_DIR, `${hash}${ext}`);
}

// Cache exhibition posters onto local SSD under imageCachePath(url) so /api/image-proxy
// serves both galleryinfo.ir (mirrored via Telegram) and Darz (ArvanCloud) posters offline to users.
async function cachePosters(exhibitions, photoById) {
  let saved = 0;
  for (const x of exhibitions) {
    if (!x) continue;
    const tgPhoto = photoById ? photoById.get(x.eventId) : null;
    const darzUrl = [x.poster, x.posterSmall].find((u) => darz.isAllowedDarzImageUrl(u));
    if (!tgPhoto && !darzUrl) continue;

    const urlFilter = tgPhoto
      ? (u) => typeof u === 'string' && u.includes('galleryinfo.ir/')
      : (u) => darz.isAllowedDarzImageUrl(u);

    const targets = [...new Set([x.poster, x.posterSmall].filter(urlFilter).map(imageCachePath))]
      .filter((p) => !fs.existsSync(p));
    if (!targets.length) continue;

    try {
      const buf = tgPhoto ? await telegram.downloadImage(tgPhoto) : await darz.downloadDarzImage(darzUrl);
      if (!buf) continue;
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
      for (const t of targets) fs.writeFileSync(t, buf);
      saved++;
      if (!tgPhoto) await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      console.warn(`[Sync] Poster for event ${x.eventId} not cached: ${err.message}`);
    }
  }
  if (saved) console.log(`[Sync] Cached ${saved} posters locally`);
  return saved;
}

function buildGalleryFromDarz(e, exObj, isExpired) {
  const d = e._venueDetails;
  if (!d || !Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return null;
  const galleryNameFa = (e.GalleryName || '').trim();
  const galleryNameEn = (e.GalleryNameEn || galleryNameFa).trim();
  const address = d.address || '';
  const locationInfo = getCityAndNeighborhood(address, galleryNameFa, d.lat);
  return {
    id: e.GalleryId,
    name: galleryNameEn,
    city: locationInfo.city,
    lat: d.lat,
    lng: d.lng,
    address,
    phone: d.phone || '',
    hours: '۱۶ - ۲۰',
    website: e._galleryUrl || '',
    instagram: '',
    image: '',
    sourceUrl: e._galleryUrl || '',
    exhibitions: [exObj],
    neighborhood: locationInfo.neighborhood,
    nameFa: galleryNameFa,
    cityFa: locationInfo.cityFa,
    neighborhoodFa: locationInfo.neighborhoodFa,
    isInTrafficZone: address.includes('مطهری') || address.includes('کریم‌خان') || address.includes('کریمخان') || address.includes('سنائی') || address.includes('سنایی') || address.includes('انقلاب') || address.includes('حافظ'),
    activeExhibition: isExpired ? null : exObj,
    posterImage: isExpired ? '' : exObj.poster,
    posterSmall: isExpired ? '' : exObj.posterSmall,
    logoImage: '',
    addressFa: address,
    hoursFa: '۱۶ - ۲۰',
    updatedAt: new Date().toISOString()
  };
}

async function buildGalleryFromTelegram(e, exObj, isExpired) {
  const coords = e._mapUrl ? await telegram.resolveMapCoords(e._mapUrl) : null;
  if (!coords) return null;
  const galleryName = (e.GalleryName || '').trim();
  const address = e._address || '';
  const locationInfo = getCityAndNeighborhood(address, galleryName, coords.lat);
  return {
    id: e.GalleryId,
    name: galleryName,
    city: locationInfo.city,
    lat: coords.lat,
    lng: coords.lng,
    address,
    phone: '',
    hours: '',
    website: `https://galleryinfo.ir/Gallery/fa/${e.GalleryId}`,
    instagram: '',
    image: `https://galleryinfo.ir/Images/Galleries/GallerySmall_${e.GalleryId}.jpg`,
    sourceUrl: `https://galleryinfo.ir/Gallery/fa/${e.GalleryId}`,
    exhibitions: [exObj],
    neighborhood: locationInfo.neighborhood,
    nameFa: galleryName,
    cityFa: locationInfo.cityFa,
    neighborhoodFa: locationInfo.neighborhoodFa,
    isInTrafficZone: address.includes('مطهری') || address.includes('کریم‌خان') || address.includes('انقلاب'),
    activeExhibition: isExpired ? null : exObj,
    posterImage: isExpired ? '' : exObj.poster,
    posterSmall: isExpired ? '' : exObj.posterSmall,
    logoImage: `https://galleryinfo.ir/Images/Galleries/GallerySmall_${e.GalleryId}.jpg`,
    addressFa: address,
    hoursFa: '',
    updatedAt: new Date().toISOString()
  };
}

function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// Helper to make POST requests to GalleryInfo ASP.NET endpoint (count <= 18 to avoid IIS TLS RST / truncated JSON)
function fetchEventsPage(skip, count = 18) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      count,
      skip,
      city: 0,
      media: 0,
      year: 0,
      stat: 'current'
    });

    const req = https.request('https://galleryinfo.ir/AjaxCalls.asmx/GetMoreEvents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://galleryinfo.ir/'
      },
      timeout: 25000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.d || []);
        } catch (e) {
          reject(new Error(`Invalid JSON response (HTTP ${res.statusCode}): ${data.slice(0, 120)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 25s'));
    });

    req.write(postData);
    req.end();
  });
}

async function fetchEventsWithRetry(skip, count = 18, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchEventsPage(skip, count);
    } catch (err) {
      console.warn(`[Sync] Attempt ${attempt}/${maxRetries} failed for skip=${skip}: ${err.message}`);
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
}

// Helper to fetch HTML of a gallery detail page
function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

// City & Neighborhood detector
function getCityAndNeighborhood(address, name, lat = 35.715) {
  const t = ((address || '') + ' ' + (name || '')).toLowerCase();

  // 1. Detect non-Tehran cities
  if (t.includes('کرج') || t.includes('مهرشهر') || t.includes('البرز') || t.includes('فردیس') || t.includes('عظیمیه')) {
    return { city: 'Karaj', cityFa: 'کرج', neighborhood: 'Karaj', neighborhoodFa: 'کرج' };
  }
  if (t.includes('مشهد') || t.includes('خراسان')) {
    return { city: 'Mashhad', cityFa: 'مشهد', neighborhood: 'Mashhad', neighborhoodFa: 'مشهد' };
  }
  if (t.includes('شیراز') && !t.includes('میرزای شیرازی') && !t.includes('خیابان شیراز')) {
    return { city: 'Shiraz', cityFa: 'شیراز', neighborhood: 'Shiraz', neighborhoodFa: 'شیراز' };
  }
  if (t.includes('اصفهان') && !t.includes('خیابان اصفهان')) {
    return { city: 'Isfahan', cityFa: 'اصفهان', neighborhood: 'Isfahan', neighborhoodFa: 'اصفهان' };
  }
  if (t.includes('کاشان') && !t.includes('خیابان کاشان')) {
    return { city: 'Kashan', cityFa: 'کاشان', neighborhood: 'Kashan', neighborhoodFa: 'کاشان' };
  }
  if (t.includes('بجنورد')) {
    return { city: 'Bojnurd', cityFa: 'بجنورد', neighborhood: 'Bojnurd', neighborhoodFa: 'بجنورد' };
  }
  if (t.includes('استانبول') || t.includes('ترکیه')) {
    return { city: 'Istanbul', cityFa: 'استانبول', neighborhood: 'Istanbul', neighborhoodFa: 'استانبول' };
  }
  if (t.includes('انزلی') || t.includes('رشت') || t.includes('گیلان') || t.includes('لاهیجان')) {
    return { city: 'Bandar Anzali', cityFa: 'بندرانزلی', neighborhood: 'Bandar Anzali', neighborhoodFa: 'بندرانزلی' };
  }
  if (t.includes('تبریز')) {
    return { city: 'Tabriz', cityFa: 'تبریز', neighborhood: 'Tabriz', neighborhoodFa: 'تبریز' };
  }

  // 2. Tehran zones
  const city = 'Tehran';
  const cityFa = 'تهران';

  // Niavaran & North Tehran
  if (
    t.includes('نیاوران') || t.includes('فرمانیه') || t.includes('اندرزگو') || t.includes('پاسداران') ||
    t.includes('دولت') || t.includes('کامرانیه') || t.includes('آجودانیه') || t.includes('اقدسیه') ||
    t.includes('ارتش') || t.includes('نخل') || t.includes('قیطریه') || t.includes('دروس') ||
    t.includes('دیباجی') || t.includes('پل رومی') || t.includes('تهرانپارس') || t.includes('سیدخندان') ||
    t.includes('تجریش') || t.includes('دزاشیب')
  ) {
    return { city, cityFa, neighborhood: 'North Tehran & Niavaran', neighborhoodFa: 'نیاوران و شمال تهران' };
  }

  // Elahiyeh & Fereshteh
  if (
    t.includes('فرشته') || t.includes('الهیه') || t.includes('سام سنتر') || t.includes('آقا بزرگی') ||
    t.includes('آقابزرگی') || t.includes('فیاضی') || t.includes('بیدار') || t.includes('چناران') ||
    t.includes('زعفرانیه') || t.includes('محمودیه') || t.includes('ولنجک') || t.includes('پسیان') ||
    t.includes('پارک وی') || t.includes('پارک‌وی') || t.includes('مریم غربی')
  ) {
    return { city, cityFa, neighborhood: 'Elahiyeh & Fereshteh', neighborhoodFa: 'الهیه و فرشته' };
  }

  // Vanak, Mirdamad & Zafar
  if (
    t.includes('ونک') || t.includes('ملاصدرا') || t.includes('شیخ بهایی') || t.includes('میرداماد') ||
    t.includes('ظفر') || t.includes('گاندی') || t.includes('کردستان') || t.includes('سئول') ||
    t.includes('آفریقا') || t.includes('جردن') || t.includes('خدامی')
  ) {
    return { city, cityFa, neighborhood: 'Vanak, Mirdamad & Zafar', neighborhoodFa: 'ونک، میرداماد و ظفر' };
  }

  // Beheshti & Motahari
  if (
    t.includes('مطهری') || t.includes('بهشتی') || t.includes('سهروردی') || t.includes('قائم‌مقام') ||
    t.includes('قائم مقام') || t.includes('میرزای شیرازی') || t.includes('هفت تیر') || t.includes('مفتح') ||
    t.includes('لارستان') || t.includes('عباس‌آباد') || t.includes('عباس آباد') || t.includes('میرعماد') ||
    t.includes('پاکستان') || t.includes('خرمشهر') || t.includes('عشقیار') || t.includes('وزرا')
  ) {
    return { city, cityFa, neighborhood: 'Beheshti & Motahari', neighborhoodFa: 'بهشتی و مطهری' };
  }

  // Downtown, Enghelab & Amirabad
  if (
    t.includes('امیرآباد') || t.includes('کارگر') || t.includes('انقلاب') || t.includes('فاطمی') ||
    t.includes('وصال') || t.includes('دانشگاه') || t.includes('نوفل‌لوشاتو') || t.includes('نوفل لوشاتو') ||
    t.includes('لولاگر') || t.includes('کشاورز') || t.includes('بلوار کشاورز') || t.includes('میدان ولیعصر') ||
    t.includes('میدان ولی‌عصر') || t.includes('زرتشت') || t.includes('فردوسی') || t.includes('کالج') ||
    t.includes('حوزه هنری') || t.includes('موزه هنرهای معاصر')
  ) {
    return { city, cityFa, neighborhood: 'Downtown, Enghelab & Amirabad', neighborhoodFa: 'مرکز، انقلاب و امیرآباد' };
  }

  // West Tehran
  if (
    t.includes('پونک') || t.includes('سعادت‌آباد') || t.includes('سعادت آباد') || t.includes('شهرک غرب') ||
    t.includes('جلال آل احمد') || t.includes('جهان‌آرا') || t.includes('مرزداران') || t.includes('صادقیه') ||
    t.includes('ستارخان') || t.includes('اکباتان')
  ) {
    return { city, cityFa, neighborhood: 'West Tehran', neighborhoodFa: 'غرب تهران' };
  }

  // Karimkhan & Center
  if (
    t.includes('کریمخان') || t.includes('کریم‌خان') || t.includes('سنایی') || t.includes('ایرانشهر') ||
    t.includes('ویلا') || t.includes('سمیه') || t.includes('پورموسی') || t.includes('سپهبد قرنی') ||
    t.includes('حافظ') || t.includes('طالقانی') || t.includes('عضدی') || t.includes('آبان') ||
    t.includes('سپند') || t.includes('باغ هنر')
  ) {
    return { city, cityFa, neighborhood: 'Karimkhan & Center', neighborhoodFa: 'کریم‌خان و مرکز' };
  }

  // Geographic fallback based on latitude if no keyword matched
  if (lat >= 35.78) {
    return { city, cityFa, neighborhood: 'North Tehran & Niavaran', neighborhoodFa: 'نیاوران و شمال تهران' };
  }
  if (lat >= 35.74) {
    return { city, cityFa, neighborhood: 'Vanak, Mirdamad & Zafar', neighborhoodFa: 'ونک، میرداماد و ظفر' };
  }
  if (lat >= 35.71) {
    return { city, cityFa, neighborhood: 'Beheshti & Motahari', neighborhoodFa: 'بهشتی و مطهری' };
  }

  return { city, cityFa, neighborhood: 'Karimkhan & Center', neighborhoodFa: 'کریم‌خان و مرکز' };
}

const PERSIAN_MONTHS = {
  'فروردین': 1, 'اردیبهشت': 2, 'خرداد': 3, 'تیر': 4, 'مرداد': 5, 'شهریور': 6,
  'مهر': 7, 'آبان': 8, 'آذر': 9, 'دی': 10, 'بهمن': 11, 'اسفند': 12
};

function parsePersianSingleDateScore(text, fallbackScore = 0) {
  const part = String(text || '').trim();
  if (!part) return fallbackScore;
  const enStr = part.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
  const yearMatch = enStr.match(/\b(14\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 1405;
  let month = 0;
  for (const [mName, mNum] of Object.entries(PERSIAN_MONTHS)) {
    if (part.includes(mName)) { month = mNum; break; }
  }
  const numbers = enStr.match(/\b(\d{1,2})\b/g);
  let day = 1;
  if (numbers) {
    for (const n of numbers) {
      const val = parseInt(n, 10);
      if (val >= 1 && val <= 31) { day = val; break; }
    }
  }
  if (!month) return fallbackScore;
  return year * 10000 + month * 100 + day;
}

function parsePersianEndDateToScore(fullRange, closingDate) {
  const text = (closingDate || fullRange || '').trim();
  if (!text || text.includes('ادامه نمایشگاه')) return 99999999;
  const part = text.includes('تا') ? text.split('تا')[1].trim() : text;
  return parsePersianSingleDateScore(part, 99999999);
}

function normalizeEventTitle(title) {
  return String(title || '')
    .replace(/[\u200c\u200f\s]+/g, ' ')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[«»"'()\-–_|/\\:،,.\u200b]+/g, '')
    .trim()
    .toLowerCase();
}

function isNewerExhibitionCandidate(nextEx, curEx, todayScore) {
  if (!nextEx) return false;
  if (!curEx) return true;
  const curEnd = parsePersianEndDateToScore(curEx.fullDateRange, curEx.closingDate);
  if (curEnd < todayScore) return true;

  const nextOpen = parsePersianSingleDateScore(nextEx.openingDate, 0);
  const curOpen = parsePersianSingleDateScore(curEx.openingDate, 0);
  if (nextOpen !== curOpen) return nextOpen > curOpen;

  const nextId = Number(nextEx.eventId || 0);
  const curId = Number(curEx.eventId || 0);
  // Real GalleryInfo IDs (> 0) take precedence over negative Darz/manual placeholders on the same date
  if (nextId > 0 && curId <= 0) return true;
  if (curId > 0 && nextId <= 0) return false;
  return nextId >= curId;
}

function mergeFallbackEvents(tgEvents, darzEvents) {
  const merged = [...tgEvents];
  for (const d of darzEvents) {
    const dStartScore = (d.SY || 0) * 10000 + (d.SM || 0) * 100 + (d.SD || 0);
    const dTitleNorm = normalizeEventTitle(d.Title);
    const dArtistNorm = normalizeEventTitle(d.Names);
    const match = tgEvents.find((t) => {
      if (t.GalleryId !== d.GalleryId) return false;
      const tStartScore = (t.SY || 0) * 10000 + (t.SM || 0) * 100 + (t.SD || 0);
      if (tStartScore !== dStartScore) return false;
      const tTitleNorm = normalizeEventTitle(t.Title);
      const tArtistNorm = normalizeEventTitle(t.Names || t.Title2ToShow);
      const titleMatch = !dTitleNorm || !tTitleNorm || tTitleNorm === 'بدونعنوان' || dTitleNorm.startsWith('نمایشگاهاثار') || dTitleNorm === tTitleNorm || dTitleNorm.includes(tTitleNorm) || tTitleNorm.includes(dTitleNorm);
      const artistMatch = dArtistNorm && tArtistNorm && (dArtistNorm.includes(tArtistNorm) || tArtistNorm.includes(dArtistNorm));
      return titleMatch && (artistMatch || dTitleNorm === tTitleNorm || (tTitleNorm && dTitleNorm.includes(tTitleNorm)));
    });
    if (match) {
      if (!match.Poster1 && d.Poster1) match.Poster1 = d.Poster1;
      continue;
    }
    merged.push(d);
  }
  return merged;
}

function getTodayPersianScore() {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tehran'
    }).formatToParts(new Date());
    const y = parseInt(parts.find(p => p.type === 'year')?.value || '1405', 10);
    const m = parseInt(parts.find(p => p.type === 'month')?.value || '8', 10);
    const d = parseInt(parts.find(p => p.type === 'day')?.value || '23', 10);
    return y * 10000 + m * 100 + d;
  } catch {
    return 14050823;
  }
}

async function main() {
  console.log('--- Starting Live Exhibition Sync ---');
  
  // 1. Load galleries cleanly: when DATA_DIR is set (server/Docker runtime), prefer PERSISTENT_GALLERIES
  //    but also merge any new galleries or manual exhibitions added in SRC_GALLERIES.
  let galleries = [];
  const srcGalleries = readJsonArraySafe(SRC_GALLERIES) || [];
  if (process.env.DATA_DIR && fs.existsSync(PERSISTENT_GALLERIES)) {
    galleries = JSON.parse(fs.readFileSync(PERSISTENT_GALLERIES, 'utf-8'));
    const existingIds = new Set(galleries.map((g) => g.id));
    for (const sg of srcGalleries) {
      if (!existingIds.has(sg.id)) {
        galleries.push(sg);
        existingIds.add(sg.id);
      } else {
        const target = galleries.find((g) => g.id === sg.id);
        if (target && Array.isArray(sg.exhibitions)) {
          if (!Array.isArray(target.exhibitions)) target.exhibitions = [];
          for (const mx of sg.exhibitions) {
            if (mx && mx.eventId <= -900000 && !target.exhibitions.some((x) => x.eventId === mx.eventId)) {
              target.exhibitions.unshift(mx);
            }
          }
        }
      }
    }
  } else {
    galleries = srcGalleries;
  }

  // 2. Get all current events. Sources, in order:
  //    --events-file <path>  events sent from a browser in Iran (phone bridge, /api/admin/galleryinfo-import)
  //    galleryinfo.ir API    normal case
  //    Telegram + Darz       automatic fallback when galleryinfo.ir is unreachable from this server
  const argIdx = process.argv.indexOf('--events-file');
  const eventsFile = argIdx > 0 ? process.argv[argIdx + 1] : '';
  let allEvents = [];
  let source = 'galleryinfo';
  let upstreamError = null;
  let tgEvents = null;

  if (eventsFile) {
    source = 'bridge';
    const fromFile = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'));
    if (!Array.isArray(fromFile)) throw fatal('Events file is not a JSON array');
    allEvents = fromFile.filter((e) => e && Number.isFinite(Number(e.Id)) && Number.isFinite(Number(e.GalleryId)));
    console.log(`Using ${allEvents.length} events sent from a browser in Iran (phone bridge).`);
    if (!allEvents.length) throw fatal('The phone bridge sent no usable events');
    // Posters: galleryinfo.ir images are unreachable from here, Telegram has the same posters.
    try {
      tgEvents = await telegram.fetchTelegramEvents();
    } catch (err) {
      console.warn(`[Sync] Telegram (posters only) failed: ${err.message}`);
    }
  } else {
    try {
      let skip = 0;
      const count = 18;
      while (true) {
        console.log(`Fetching events (skip=${skip})...`);
        const batch = await fetchEventsWithRetry(skip, count);
        if (!batch || batch.length === 0) break;
        allEvents.push(...batch);
        if (batch.length < count) break;
        skip += count;
      }
    } catch (err) {
      upstreamError = err;
      allEvents = [];
      console.warn(`[Sync] galleryinfo.ir is unreachable (${err.message}). Falling back to Telegram + Darz...`);
    }

    if (upstreamError) {
      const today = getTodayPersianScore();
      let tgCurrent = [];
      let darzCurrent = [];
      let tgError = null;
      let darzError = null;

      try {
        tgEvents = await telegram.fetchTelegramEvents();
        // Keep the poster URL we already store for known events, so cached images still match.
        const known = new Map((readJsonArraySafe(PERSISTENT_EXHIBITIONS) || readJsonArraySafe(SRC_EXHIBITIONS) || [])
          .filter((x) => x && x.poster).map((x) => [x.eventId, x.poster]));
        tgCurrent = (tgEvents || [])
          .filter((e) => e.SYE * 10000 + e.SME * 100 + e.SDE >= today)
          .map((e) => (known.has(e.Id) ? { ...e, Poster1: known.get(e.Id) } : e));
      } catch (err) {
        tgError = err;
        console.warn(`[Sync] Telegram fallback warning: ${err.message}`);
      }

      try {
        const darzResult = await darz.fetchDarzEvents({ existingGalleries: galleries });
        darzCurrent = (darzResult.events || [])
          .filter((e) => e.SYE * 10000 + e.SME * 100 + e.SDE >= today);
      } catch (err) {
        darzError = err;
        console.warn(`[Sync] Darz fallback warning: ${err.message}`);
      }

      allEvents = mergeFallbackEvents(tgCurrent, darzCurrent);

      if (tgCurrent.length && darzCurrent.length) {
        source = 'telegram+darz';
      } else if (darzCurrent.length) {
        source = 'darz';
      } else if (tgCurrent.length) {
        source = 'telegram';
      } else {
        const parts = [`galleryinfo.ir unreachable (${upstreamError.message})`];
        if (tgError) parts.push(`Telegram failed (${tgError.message})`);
        if (darzError) parts.push(`Darz failed (${darzError.message})`);
        throw fatal(parts.join('; ') + ' and no current exhibitions were found');
      }
    }
  }

  console.log(`Total live events fetched (source: ${source}): ${allEvents.length}`);

  if (allEvents.length === 0) {
    console.warn('[Sync] 0 events fetched from upstream. Preserving existing verified dataset.');
    writeReport({ ok: true, source, count: 0, note: '0 events from upstream, existing data kept' });
    return;
  }

  const galleryMap = new Map();
  galleries.forEach(g => galleryMap.set(g.id, g));

  const allExhibitionsFa = [];
  const todayScore = getTodayPersianScore();

  // Sort events by StartDate descending (preferring positive GalleryInfo IDs on ties)
  allEvents.sort((a, b) => {
    const scoreA = (a.SY || 1400) * 10000 + (a.SM || 1) * 100 + (a.SD || 1);
    const scoreB = (b.SY || 1400) * 10000 + (b.SM || 1) * 100 + (b.SD || 1);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const posA = Number(a.Id) > 0 ? 1 : 0;
    const posB = Number(b.Id) > 0 ? 1 : 0;
    if (posB !== posA) return posB - posA;
    return Number(b.Id || 0) - Number(a.Id || 0);
  });

  for (const e of allEvents) {
    let posterUrl = e.Poster1 ? (e.Poster1.startsWith('http') ? e.Poster1 : `https://galleryinfo.ir${e.Poster1}`) : '';
    let posterSmallUrl = (e._source === 'darz' || darz.isAllowedDarzImageUrl(posterUrl))
      ? posterUrl
      : (posterUrl ? posterUrl.replace('Event_', 'EventSmall_') : '');
    const artist = (e.Names || e.Title2ToShow || '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
    const title = (e.Title || '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
    const galleryName = (e.GalleryName || '').trim();

    const startStr = (e.SD && e.SMN) ? `${e.SD} ${e.SMN} ${e.SY || 1405}` : '۱۵ آبان ۱۴۰۵';
    const endStr = (e.SDE && e.SMNE) ? `${e.SDE} ${e.SMNE} ${e.SYE || e.SY || 1405}` : '';
    const dateRangeStr = endStr ? `${startStr} تا ${endStr}` : `${startStr} تا ادامه نمایشگاه`;
    const hours = (e.StartT && e.EndT) ? `${e.StartT}:۰۰ الی ${e.EndT}:۰۰` : '۱۶:۰۰ الی ۲۰:۰۰';

    const isExpired = parsePersianEndDateToScore(dateRangeStr, endStr) < todayScore;
    const openingDate = e._weekday ? `${e._weekday} ${startStr}` : `جمعه ${startStr}`;
    const eventUrl = e._eventUrl || `https://galleryinfo.ir/Event/fa/${e.Id}`;

    let gallery = galleryMap.get(e.GalleryId);

    // If gallery already holds a positive GalleryInfo eventId for this exact opening date & show,
    // skip adding a duplicate negative Darz placeholder.
    if (gallery && Array.isArray(gallery.exhibitions) && Number(e.Id) < 0) {
      const titleNorm = normalizeEventTitle(title);
      const artistNorm = normalizeEventTitle(artist);
      const openScore = parsePersianSingleDateScore(openingDate, 0);
      const canonicalExisting = gallery.exhibitions.find((x) => {
        if (!x || !(x.eventId > 0)) return false;
        if (parsePersianSingleDateScore(x.openingDate, 0) !== openScore) return false;
        const xTitleNorm = normalizeEventTitle(x.title);
        const xArtistNorm = normalizeEventTitle(x.artist);
        const titleMatch = titleNorm && xTitleNorm && (xTitleNorm === titleNorm || xTitleNorm.includes(titleNorm) || titleNorm.includes(xTitleNorm));
        const artistFallbackMatch = (title.startsWith('نمایشگاه آثار') || xTitleNorm === 'بدونعنوان') && artistNorm && xArtistNorm && (xArtistNorm.includes(artistNorm) || artistNorm.includes(xArtistNorm));
        return titleMatch || artistFallbackMatch;
      });
      if (canonicalExisting) {
        canonicalExisting.isExpired = isExpired;
        if (!canonicalExisting.poster && posterUrl) canonicalExisting.poster = posterUrl;
        if (!canonicalExisting.posterSmall && posterSmallUrl) canonicalExisting.posterSmall = posterSmallUrl;
        if (!isExpired) allExhibitionsFa.push({ ...canonicalExisting, isExpired: false });
        continue;
      }
    }

    // If a manual local poster (/assets/events/manual/...) already exists on disk for this show, keep using it
    if (gallery && Array.isArray(gallery.exhibitions)) {
      const titleNorm = normalizeEventTitle(title);
      const openScore = parsePersianSingleDateScore(openingDate, 0);
      const manualMatch = gallery.exhibitions.find((x) => {
        if (!x || typeof x.poster !== 'string' || !x.poster.startsWith('/assets/events/manual/')) return false;
        if (eventUrl && x.url === eventUrl) return true;
        return titleNorm && normalizeEventTitle(x.title) === titleNorm && parsePersianSingleDateScore(x.openingDate, 0) === openScore;
      });
      if (manualMatch) {
        const localFile = path.join(ROOT_DIR, 'public', manualMatch.poster.replace(/^\//, ''));
        if (fs.existsSync(localFile)) {
          posterUrl = manualMatch.poster;
          posterSmallUrl = manualMatch.posterSmall || manualMatch.poster;
        }
      }
    }

    const exObj = {
      eventId: e.Id,
      galleryId: e.GalleryId,
      title: title,
      artist: artist,
      type: e._type || ((artist.includes('گروهی') || title.includes('گروهی')) ? 'نمایشگاه گروهی' : 'نمایشگاه انفرادی'),
      openingDate,
      fullDateRange: dateRangeStr,
      closingDate: endStr,
      openingHours: hours,
      poster: posterUrl,
      posterSmall: posterSmallUrl,
      url: eventUrl,
      isExpired
    };

    if (!isExpired) {
      allExhibitionsFa.push(exObj);
    }

    if (!gallery && e._source === 'darz') {
      gallery = buildGalleryFromDarz(e, exObj, isExpired);
      if (!gallery) {
        console.warn(`[Sync] Skipping new Darz gallery ${e.GalleryId} (${galleryName}): no location available`);
        continue;
      }
      console.log(`Added new gallery from Darz: ${e.GalleryId} (${galleryName})`);
      galleryMap.set(e.GalleryId, gallery);
      galleries.push(gallery);
      continue;
    }

    if (!gallery && (e._source === 'telegram' || source === 'bridge')) {
      // galleryinfo.ir gallery pages are unreachable in these modes; use the Telegram post's map link.
      const tgPost = e._source === 'telegram' ? e : (tgEvents || []).find((t) => t.GalleryId === e.GalleryId);
      gallery = tgPost ? await buildGalleryFromTelegram({ ...tgPost, GalleryName: galleryName || tgPost.GalleryName }, exObj, isExpired) : null;
      if (!gallery) {
        console.warn(`[Sync] Skipping new gallery ${e.GalleryId} (${galleryName}): no location available`);
        continue;
      }
      console.log(`Added new gallery from Telegram: ${e.GalleryId} (${galleryName})`);
      galleryMap.set(e.GalleryId, gallery);
      galleries.push(gallery);
      continue;
    }

    if (!gallery) {
      console.log(`Discovering new gallery from event: ${e.GalleryId} (${galleryName})...`);
      const html = await fetchHtml(`https://galleryinfo.ir/Gallery/fa/${e.GalleryId}`);
      if (!html) {
        // Without the page we would only have a made-up location; skip rather than pin it wrongly.
        console.warn(`[Sync] Skipping new gallery ${e.GalleryId} (${galleryName}): its page could not be read`);
        continue;
      }
      
      const addrMatch = html.match(/class=["']address["'][^>]*>([\s\S]*?)<\/(?:div|p|span)>/i) ||
                        html.match(/نشانی[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
                        html.match(/<div class="col-sm-8 col-xs-12">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
      const rawAddr = addrMatch ? addrMatch[1] : '';
      const cleanAddr = rawAddr
        ? rawAddr
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&zwnj;/gi, '\u200c')
            .replace(/&amp;/gi, '&')
            .replace(/&[a-zA-Z0-9#]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^(تهران|کرج|مشهد|شیراز|اصفهان|تبریز|کاشان|بجنورد)[،\s]+(تهران|کرج|مشهد|شیراز|اصفهان|تبریز|کاشان|بجنورد)[،\s]+/g, '$1، ')
            .replace(/^(تهران|کرج|مشهد|شیراز|اصفهان|تبریز|کاشان|بجنورد)\s+([^،\s])/g, '$1، $2')
        : 'تهران، مرکز شهر';

      const phoneMatch = html.match(/(?:تلفن|تماس)[\s\S]*?([0-9\-\s+]{7,15})/i);
      const cleanPhone = phoneMatch ? phoneMatch[1].trim() : '۰۲۱';

      const hoursMatch = html.match(/(?:ساعت|بازدید)[\s\S]*?([0-9۰-۹:\s\-الیتا]+)/i);
      const cleanHours = hoursMatch ? hoursMatch[1].trim() : '۱۶:۰۰ تا ۲۰:۰۰';

      const latMatch = html.match(/var\s+lat\s*=\s*([0-9.]+)/i) || html.match(/([3][5-6]\.[0-9]+)/);
      const lngMatch = html.match(/var\s+lng\s*=\s*([0-9.]+)/i) || html.match(/([5][1-2]\.[0-9]+)/);

      const lat = latMatch ? parseFloat(latMatch[1]) : 35.715;
      const lng = lngMatch ? parseFloat(lngMatch[1]) : 51.415;

      const locationInfo = getCityAndNeighborhood(cleanAddr, galleryName, lat);

      gallery = {
        id: e.GalleryId,
        name: galleryName,
        city: locationInfo.city,
        lat,
        lng,
        address: cleanAddr,
        phone: cleanPhone,
        hours: cleanHours,
        website: `https://galleryinfo.ir/Gallery/fa/${e.GalleryId}`,
        instagram: '',
        image: `https://galleryinfo.ir/Images/Galleries/GallerySmall_${e.GalleryId}.jpg`,
        sourceUrl: `https://galleryinfo.ir/Gallery/fa/${e.GalleryId}`,
        exhibitions: [exObj],
        neighborhood: locationInfo.neighborhood,
        nameFa: galleryName,
        cityFa: locationInfo.cityFa,
        neighborhoodFa: locationInfo.neighborhoodFa,
        isInTrafficZone: cleanAddr.includes('مطهری') || cleanAddr.includes('کریم‌خان') || cleanAddr.includes('انقلاب'),
        activeExhibition: isExpired ? null : exObj,
        posterImage: isExpired ? '' : posterUrl,
        posterSmall: isExpired ? '' : posterSmallUrl,
        logoImage: `https://galleryinfo.ir/Images/Galleries/GallerySmall_${e.GalleryId}.jpg`,
        addressFa: cleanAddr,
        hoursFa: cleanHours
      };

      galleryMap.set(e.GalleryId, gallery);
      galleries.push(gallery);
    } else {
      // Update gallery active exhibition using opening-date comparison first, then positive IDs
      if (!isExpired && isNewerExhibitionCandidate(exObj, gallery.activeExhibition, todayScore)) {
        gallery.activeExhibition = exObj;
        gallery.posterImage = posterUrl;
        gallery.posterSmall = posterSmallUrl;
        gallery.updatedAt = new Date().toISOString();
      } else if (isExpired && gallery.activeExhibition?.eventId === exObj.eventId) {
        gallery.activeExhibition = null;
        gallery.posterImage = '';
        gallery.posterSmall = '';
      }

      if (!gallery.exhibitions) gallery.exhibitions = [];
      const titleNorm = normalizeEventTitle(exObj.title);
      const openScore = parsePersianSingleDateScore(exObj.openingDate, 0);
      // Remove any negative placeholder (-90000x or Darz hash) superseded by this canonical event
      gallery.exhibitions = gallery.exhibitions.filter((x) => {
        if (!x || x.eventId === exObj.eventId) return true;
        if (x.eventId >= 0) return true;
        if (exObj.url && x.url === exObj.url) return false;
        if (titleNorm && normalizeEventTitle(x.title) === titleNorm && parsePersianSingleDateScore(x.openingDate, 0) === openScore) {
          return false;
        }
        return true;
      });
      const exIndex = gallery.exhibitions.findIndex(x => x.eventId === exObj.eventId);
      if (exIndex >= 0) {
        gallery.exhibitions[exIndex] = exObj;
      } else {
        gallery.exhibitions.unshift(exObj);
      }
    }
  }

  // Reconcile all galleries: refresh expiration flags and promote the newest non-expired exhibition
  let expiredCleared = 0;
  for (const g of galleries) {
    if (Array.isArray(g.exhibitions)) {
      for (const x of g.exhibitions) {
        if (x) x.isExpired = parsePersianEndDateToScore(x.fullDateRange, x.closingDate) < todayScore;
      }
    }
    const validSubs = (g.exhibitions || []).filter((x) => x && !x.isExpired);
    const activeValid = g.activeExhibition && parsePersianEndDateToScore(g.activeExhibition.fullDateRange, g.activeExhibition.closingDate) >= todayScore;
    let best = activeValid ? g.activeExhibition : null;
    for (const candidate of validSubs) {
      if (!best || isNewerExhibitionCandidate(candidate, best, todayScore)) {
        best = candidate;
      }
    }
    if (best) {
      if (!g.activeExhibition || g.activeExhibition.eventId !== best.eventId) {
        g.activeExhibition = best;
        g.posterImage = best.poster || g.posterImage || '';
        g.posterSmall = best.posterSmall || best.poster || g.posterSmall || '';
      }
    } else if (g.activeExhibition) {
      g.activeExhibition = null;
      g.posterImage = '';
      g.posterSmall = '';
      expiredCleared++;
    }
  }
  if (expiredCleared) console.log(`[Sync] Cleared ${expiredCleared} expired active exhibitions from galleries`);

  // Ensure persistent DATA_DIR exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fallback sources (Telegram / Darz) only cover their respective feeds: keep manual or other current exhibitions.
  if (source === 'telegram' || source === 'darz' || source === 'telegram+darz') {
    const today = getTodayPersianScore();
    const seen = new Set(allExhibitionsFa.map((x) => x.eventId));
    const seenUrls = new Set(allExhibitionsFa.map((x) => x.url).filter(Boolean));
    const seenKeys = new Set(allExhibitionsFa.map((x) => `${x.galleryId}::${normalizeEventTitle(x.title)}::${parsePersianSingleDateScore(x.openingDate, 0)}`));
    const previous = [
      ...((process.env.DATA_DIR && readJsonArraySafe(PERSISTENT_EXHIBITIONS)) || []),
      ...(readJsonArraySafe(SRC_EXHIBITIONS) || [])
    ];
    let kept = 0;
    for (const x of previous) {
      if (!x || seen.has(x.eventId)) continue;
      if (parsePersianEndDateToScore(x.fullDateRange, x.closingDate) < today) continue;
      const key = `${x.galleryId}::${normalizeEventTitle(x.title)}::${parsePersianSingleDateScore(x.openingDate, 0)}`;
      if (x.eventId < 0 && ((x.url && seenUrls.has(x.url)) || seenKeys.has(key))) continue;
      allExhibitionsFa.push({ ...x, isExpired: false });
      seen.add(x.eventId);
      if (x.url) seenUrls.add(x.url);
      seenKeys.add(key);
      kept++;
    }
    console.log(`[Sync] Kept ${kept} current exhibitions from existing dataset (e.g. manual entries)`);
  }

  const photoById = new Map((tgEvents || []).filter((t) => t && t._photo).map((t) => [t.Id, t._photo]));
  const postersCached = await cachePosters(allExhibitionsFa, photoById);

  // Save to persistent database (temp file + rename, so a crash never leaves a half-written file)
  writeJsonAtomic(PERSISTENT_GALLERIES, galleries);
  writeJsonAtomic(PERSISTENT_EXHIBITIONS, allExhibitionsFa);

  // Also sync to src/data if it exists (for repo consistency)
  const srcDataDir = path.join(ROOT_DIR, 'src', 'data');
  if (fs.existsSync(srcDataDir)) {
    writeJsonAtomic(SRC_GALLERIES, galleries);
    writeJsonAtomic(SRC_EXHIBITIONS, allExhibitionsFa);
  }

  writeReport({
    ok: true,
    source,
    count: allExhibitionsFa.length,
    galleries: galleries.length,
    postersCached,
    upstreamError: upstreamError ? upstreamError.message : null
  });

  console.log(`--- Sync Completed Successfully! (source: ${source}) ---`);
  console.log(`Total galleries in dataset: ${galleries.length}`);
  console.log(`Total active exhibitions: ${allExhibitionsFa.length}`);
}

main().catch(err => {
  console.error('[Sync] Sync warning:', err.message);
  writeReport({ ok: false, source: null, error: err.message });
  if (err.fatal) {
    // No source worked: fail loudly (red GitHub job, error status on the server) instead of a fake success.
    console.error('[Sync] FAILED: no source could be read. Existing data is unchanged.');
    process.exit(1);
  }
  if (process.env.STRICT_SYNC === 'true') {
    process.exit(1);
  } else {
    console.warn('[Sync] Non-fatal fallback: Continuing with existing verified database.');
    process.exit(0);
  }
});
