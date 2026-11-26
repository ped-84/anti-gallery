'use strict';

// ========================================================
// Darz (darz.art) Fallback Exhibition Source
// Used alongside Telegram (@galleryinfo_ir) when galleryinfo.ir
// is unreachable from outside Iran (e.g., GitHub Actions / EU VPS).
// ========================================================

const DARZ_ORIGIN = 'https://darz.art';
const DARZ_TEHRAN_URL = `${DARZ_ORIGIN}/fa/shows?group=tehran`;
const DARZ_UPCOMING_URL = `${DARZ_ORIGIN}/fa/shows-upcoming?group=tehran`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

// Canonical mapping from Darz organization.slug to existing artgasht gallery IDs.
// Preserves curated neighborhood tags, coordinates, and Telegram/GalleryInfo linkage.
// IDs 1031-1034 are assigned deterministically for verified Tehran galleries sourced from Darz.
const SLUG_TO_GALLERY_ID = {
  'plus-2': 1023,
  '009821-projects': 406,
  'aaran-projects': 111,
  'hoor-art-gallery': 25,
  'dastan-outside-projects': 225,
  'dastans-basement': 28,
  'bavan-gallery': 468,
  'negah-gallery': 226,
  'inja-gallery': 405,
  'bazdid-art-gallery': 1019,
  'soo-contemporary': 487,
  'shirin-gallery': 18,
  'didar-art-gallery': 755, // Note: id 329 in galleries.json is Isfahan Didar Gallery
  'doost-art-gallery': 937,
  'parallel-circuit': 551,
  'etemad-gallery': 301,
  'bina-art-gallery': 1025,
  'yafteh-gallery': 834,
  'shamis-gallery': 429,
  'ev-art-gallery': 443,
  'o-gallery': 65,
  'bostan-art-gallery': 938,
  'iranshahr-gallery': 196,
  'sharif-gallery': 485,
  'sheydaei-art-gallery': 484,
  'tmoca-4': 263,
  'delgosha-gallery': 212,
  'lajevardi-foundation': 103,
  'kama-art-gallery': 325,
  'vali-art-gallery': 26,
  'b-gallery': 1027,
  'assart-gallery': 16,
  'azad-art-gallery': 45,
  'mah-art-gallery': 19,
  'seyhoun-art-gallery': 5,
  'tarrahan-azad-gallery': 22,
  'golestan-gallery': 11,
  'ag-gallery': 474,
  'a-gallery': 217,
  'ab-anbar-gallery': 63,
  'dena-gallery': 120,
  'aftab-art-gallery': 117,
  'saless-gallery': 14,
  'sarban-gallery': 64,
  'mirdamad-gallery': 1024,
  'west-gallery': 997,
  // New Darz-discovered Tehran galleries with deterministic positive IDs > 1030
  'emkan-gallery': 1031,
  'dot-art-gallery': 1032,
  'artchive': 1033,
  'iris-contemporary-space': 1034,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashString32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function darzShowUuidToEventId(uuid) {
  // Reserve -900001..-900999 for manual data entries; Darz uses -899999..-100000
  const mod = hashString32(String(uuid || '')) % 799999;
  return -(100000 + mod);
}

function darzSlugToFallbackGalleryId(slug) {
  return 100000 + (hashString32(String(slug || '')) % 800000);
}

function normalizeFa(text) {
  return String(text || '')
    .replace(/[\u200c\u200f\s]+/g, ' ')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[«»"'()\-–_|/\\:،,.\u200b]+/g, ' ')
    .replace(/گالری|نگارخانه|مجموعه هنری|مجموعهی معاصر|مجموعه معاصر|فضای معاصر|تالار|پروژههای|پروژه های/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractRscChunks(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`));
    } catch {
      // Skip malformed chunk
    }
  }
  return chunks.join('');
}

function extractShowsFromHtml(html) {
  const full = extractRscChunks(html);
  const idx = full.indexOf('"shows":[');
  if (idx < 0) return [];

  const start = full.indexOf('[', idx);
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < full.length; i++) {
    const ch = full[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end <= start) return [];
  try {
    const parsed = JSON.parse(full.slice(start, end));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJalaliSlashDate(str) {
  const m = String(str || '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d, mn: MONTHS[month - 1] };
}

function getPersianWeekday(isoDate) {
  if (!isoDate) return 'جمعه';
  try {
    const dt = new Date(`${isoDate}T12:00:00+03:30`);
    if (Number.isNaN(dt.getTime())) return 'جمعه';
    const w = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', timeZone: 'Asia/Tehran' }).format(dt);
    return w || 'جمعه';
  } catch {
    return 'جمعه';
  }
}

function resolveGalleryIdForShow(show, existingGalleries) {
  const slug = show?.organization?.slug || '';
  if (slug && SLUG_TO_GALLERY_ID[slug]) {
    return SLUG_TO_GALLERY_ID[slug];
  }

  const orgFa = normalizeFa(show?.organization?.name?.fa);
  const orgEn = String(show?.organization?.name?.en || '').trim().toLowerCase();

  const tehranExisting = (existingGalleries || []).filter((g) => g && g.city === 'Tehran');
  for (const g of tehranExisting) {
    if (orgFa && normalizeFa(g.nameFa) === orgFa) return g.id;
    if (orgEn && String(g.name || '').trim().toLowerCase() === orgEn) return g.id;
  }

  return darzSlugToFallbackGalleryId(slug || orgFa || orgEn || show?.id);
}

async function fetchShowVenueDetails(showId) {
  const url = `${DARZ_ORIGIN}/fa/shows/${showId}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(12000)
    });
    if (res.status === 429 && attempt === 0) {
      await sleep(5000);
      continue;
    }
    if (!res.ok) return null;
    const html = await res.text();
    const latlng =
      html.match(/https:\/\/www\.google\.com\/maps\?q=([0-9.]+)(?:%2C|,)([0-9.]+)/i) ||
      html.match(/"lat":([0-9.]+),"lng":([0-9.]+)/);
    const addrMatch = html.match(/<address[^>]*>([^<]+)<\/address>/);
    const phoneMatch = html.match(/(?:href="tel:|">)(\+?98[^<"]+|021[0-9\-\s]+)/);

    const lat = latlng ? parseFloat(latlng[1]) : NaN;
    const lng = latlng ? parseFloat(latlng[2]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Tehran bounding box guard
    if (lat < 35.4 || lat > 35.95 || lng < 51.0 || lng > 51.85) return null;

    const rawAddr = addrMatch ? addrMatch[1].replace(/\s*\|\s*/g, '، ').replace(/^ایران،\s*/, '').trim() : '';
    const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : '';
    return {
      lat,
      lng,
      address: rawAddr,
      phone
    };
  }
  return null;
}

async function fetchPageShows(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    throw new Error(`Darz HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  return extractShowsFromHtml(html);
}

/**
 * Fetches current and upcoming Tehran exhibitions from darz.art,
 * formatted in the same GetMoreEvents-compatible object shape expected by sync-galleryinfo.cjs.
 * For galleries not yet present in `existingGalleries`, gently resolves venue location from the show page.
 */
async function fetchDarzEvents({ existingGalleries = [] } = {}) {
  const rawShows = [];
  const urls = [DARZ_TEHRAN_URL, DARZ_UPCOMING_URL];
  let succeededPages = 0;

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(1200);
    try {
      const items = await fetchPageShows(urls[i]);
      succeededPages++;
      rawShows.push(...items);
    } catch (err) {
      console.warn(`[Darz] Warning reading ${urls[i]}: ${err.message}`);
    }
  }

  if (succeededPages === 0) {
    throw new Error('Could not reach any Darz exhibition listing page');
  }

  // Filter Tehran shows and deduplicate by show UUID first
  const byUuid = new Map();
  for (const s of rawShows) {
    if (!s || !s.id) continue;
    const isTehran = s.group === 'tehran' || String(s.city?.name?.en || '').toLowerCase() === 'tehran';
    if (!isTehran) continue;
    if (!byUuid.has(s.id)) byUuid.set(s.id, s);
  }

  // Deduplicate identical shows listed twice under slightly different UUIDs (e.g. plus-2)
  const existingIdSet = new Set((existingGalleries || []).map((g) => g.id));
  const dedupMap = new Map();

  for (const s of byUuid.values()) {
    const start = parseJalaliSlashDate(s.starts_on_fa);
    const end = parseJalaliSlashDate(s.ends_on_fa);
    if (!start || !end) continue;

    const galleryId = resolveGalleryIdForShow(s, existingGalleries);
    const artistsList = (s.artists || []).map((a) => a?.name?.fa?.trim()).filter(Boolean);
    const artistsStr = artistsList.join('، ');
    const rawTitle = (s.title?.fa || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const title = rawTitle || (artistsStr ? `نمایشگاه آثار ${artistsStr}` : 'نمایشگاه');

    const dedupKey = `${galleryId}::${normalizeFa(title)}::${s.starts_on_fa}`;
    const prev = dedupMap.get(dedupKey);
    if (prev && prev._artistsCount >= artistsList.length) {
      continue;
    }

    const posterUrl = s.poster?.url || '';
    const orgFa = (s.organization?.name?.fa || '').trim();
    const orgEn = (s.organization?.name?.en || '').trim();
    const slug = s.organization?.slug || '';
    const weekday = getPersianWeekday(s.starts_on);

    dedupMap.set(dedupKey, {
      Id: darzShowUuidToEventId(s.id),
      GalleryId: galleryId,
      GalleryName: orgFa || orgEn || 'گالری',
      GalleryNameEn: orgEn || orgFa || 'Gallery',
      Title: title,
      Names: artistsStr || (s.is_solo ? 'نمایشگاه انفرادی' : 'نمایشگاه گروهی'),
      SD: start.d,
      SM: start.m,
      SMN: start.mn,
      SY: start.y,
      SDE: end.d,
      SME: end.m,
      SMNE: end.mn,
      SYE: end.y,
      StartT: 16,
      EndT: 20,
      Poster1: posterUrl,
      _source: 'darz',
      _artistsCount: artistsList.length,
      _darzUuid: s.id,
      _darzSlug: slug,
      _weekday: weekday,
      _type: s.is_solo === false || artistsList.length > 1 ? 'نمایشگاه گروهی' : 'نمایشگاه انفرادی',
      _eventUrl: `${DARZ_ORIGIN}${s.urls?.fa || `/fa/shows/${s.id}`}`,
      _galleryUrl: slug ? `${DARZ_ORIGIN}/fa/galleries/${slug}` : DARZ_ORIGIN,
      _venueDetails: null
    });
  }

  // Gently resolve venue details ONLY for galleries not already present in galleries.json
  const detailCache = new Map();
  let fetchedDetails = 0;
  for (const ev of dedupMap.values()) {
    if (existingIdSet.has(ev.GalleryId)) continue;
    const cacheKey = ev._darzSlug || String(ev.GalleryId);
    if (detailCache.has(cacheKey)) {
      ev._venueDetails = detailCache.get(cacheKey);
      continue;
    }
    if (fetchedDetails > 0) await sleep(2300);
    fetchedDetails++;
    try {
      const details = await fetchShowVenueDetails(ev._darzUuid);
      detailCache.set(cacheKey, details);
      ev._venueDetails = details;
    } catch (err) {
      console.warn(`[Darz] Could not fetch venue details for ${ev._darzSlug}: ${err.message}`);
      detailCache.set(cacheKey, null);
    }
  }

  const events = Array.from(dedupMap.values());
  console.log(`[Darz] Parsed ${events.length} unique Tehran exhibitions (${fetchedDetails} new venue lookups).`);
  return { events };
}

function isAllowedDarzImageUrl(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('https://darz-public.s3.ir-thr-at1.arvanstorage.ir/') ||
      url.startsWith('https://darz.art/'))
  );
}

async function downloadDarzImage(url) {
  if (!isAllowedDarzImageUrl(url)) return null;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('image/')) return null;
  return Buffer.from(await res.arrayBuffer());
}

module.exports = {
  DARZ_TEHRAN_URL,
  DARZ_UPCOMING_URL,
  SLUG_TO_GALLERY_ID,
  isAllowedDarzImageUrl,
  fetchDarzEvents,
  downloadDarzImage
};
