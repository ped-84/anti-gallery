const fs = require('fs');
const path = require('path');
const https = require('https');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const PERSISTENT_GALLERIES = path.join(DATA_DIR, 'galleries.json');
const PERSISTENT_EXHIBITIONS = path.join(DATA_DIR, 'exhibitions_fa.json');
const SRC_GALLERIES = path.join(ROOT_DIR, 'src', 'data', 'galleries.json');
const SRC_EXHIBITIONS = path.join(ROOT_DIR, 'src', 'data', 'exhibitions_fa.json');

// Helper to make POST requests to GalleryInfo ASP.NET endpoint
function fetchEventsPage(skip, count = 100) {
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

async function fetchEventsWithRetry(skip, count = 100, maxRetries = 3) {
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

async function main() {
  console.log('--- Starting Live Exhibition Sync ---');
  
  // 1. Fetch all current events from upstream ASP.NET API
  let allEvents = [];
  let skip = 0;
  const count = 100;

  while (true) {
    console.log(`Fetching events (skip=${skip})...`);
    const batch = await fetchEventsWithRetry(skip, count);
    if (!batch || batch.length === 0) break;
    allEvents.push(...batch);
    if (batch.length < count) break;
    skip += count;
  }

  console.log(`Total live events fetched from upstream: ${allEvents.length}`);

  if (allEvents.length === 0) {
    console.warn('[Sync] 0 events fetched from upstream. Preserving existing verified dataset.');
    return;
  }

  // 2. Read local databases (prioritize persistent volume if available)
  let galleries = [];
  if (fs.existsSync(PERSISTENT_GALLERIES)) {
    galleries = JSON.parse(fs.readFileSync(PERSISTENT_GALLERIES, 'utf-8'));
  } else if (fs.existsSync(SRC_GALLERIES)) {
    galleries = JSON.parse(fs.readFileSync(SRC_GALLERIES, 'utf-8'));
  }

  const galleryMap = new Map();
  galleries.forEach(g => galleryMap.set(g.id, g));

  const allExhibitionsFa = [];

  // Sort events by StartDate descending so latest exhibitions (e.g. 15 Aban) are processed first
  allEvents.sort((a, b) => {
    const scoreA = (a.SY || 1400) * 10000 + (a.SM || 1) * 100 + (a.SD || 1);
    const scoreB = (b.SY || 1400) * 10000 + (b.SM || 1) * 100 + (b.SD || 1);
    return scoreB - scoreA;
  });

  for (const e of allEvents) {
    const posterUrl = e.Poster1 ? (e.Poster1.startsWith('http') ? e.Poster1 : `https://galleryinfo.ir${e.Poster1}`) : '';
    const posterSmallUrl = posterUrl ? posterUrl.replace('Event_', 'EventSmall_') : '';
    const artist = (e.Names || e.Title2ToShow || '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
    const title = (e.Title || '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
    const galleryName = (e.GalleryName || '').trim();
    
    const startStr = (e.SD && e.SMN) ? `${e.SD} ${e.SMN} ${e.SY || 1405}` : '۱۵ آبان ۱۴۰۵';
    const endStr = (e.SDE && e.SMNE) ? `${e.SDE} ${e.SMNE} ${e.SYE || e.SY || 1405}` : '';
    const dateRangeStr = endStr ? `${startStr} تا ${endStr}` : `${startStr} تا ادامه نمایشگاه`;
    const hours = (e.StartT && e.EndT) ? `${e.StartT}:۰۰ الی ${e.EndT}:۰۰` : '۱۶:۰۰ الی ۲۰:۰۰';

    const exObj = {
      eventId: e.Id,
      galleryId: e.GalleryId,
      title: title,
      artist: artist,
      type: (artist.includes('گروهی') || title.includes('گروهی')) ? 'نمایشگاه گروهی' : 'نمایشگاه انفرادی',
      openingDate: `جمعه ${startStr}`,
      fullDateRange: dateRangeStr,
      closingDate: endStr,
      openingHours: hours,
      poster: posterUrl,
      posterSmall: posterSmallUrl,
      url: `https://galleryinfo.ir/Event/fa/${e.Id}`
    };

    allExhibitionsFa.push(exObj);

    let gallery = galleryMap.get(e.GalleryId);

    if (!gallery) {
      console.log(`Discovering new gallery from event: ${e.GalleryId} (${galleryName})...`);
      const html = await fetchHtml(`https://galleryinfo.ir/Gallery/fa/${e.GalleryId}`);
      
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
        activeExhibition: exObj,
        posterImage: posterUrl,
        posterSmall: posterSmallUrl,
        logoImage: `https://galleryinfo.ir/Images/Galleries/GallerySmall_${e.GalleryId}.jpg`,
        addressFa: cleanAddr,
        hoursFa: cleanHours
      };

      galleryMap.set(e.GalleryId, gallery);
      galleries.push(gallery);
    } else {
      // Update gallery active exhibition if this one is newer or from the latest event cycle
      const currentEventId = gallery.activeExhibition?.eventId || 0;
      if (!gallery.activeExhibition || exObj.eventId >= currentEventId) {
        gallery.activeExhibition = exObj;
        gallery.posterImage = posterUrl;
        gallery.posterSmall = posterSmallUrl;
        gallery.updatedAt = new Date().toISOString();
      }

      if (!gallery.exhibitions) gallery.exhibitions = [];
      const exIndex = gallery.exhibitions.findIndex(x => x.eventId === exObj.eventId);
      if (exIndex >= 0) {
        gallery.exhibitions[exIndex] = exObj;
      } else {
        gallery.exhibitions.unshift(exObj);
      }
    }
  }

  // Ensure persistent DATA_DIR exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Save to persistent database
  fs.writeFileSync(PERSISTENT_GALLERIES, JSON.stringify(galleries, null, 2), 'utf-8');
  fs.writeFileSync(PERSISTENT_EXHIBITIONS, JSON.stringify(allExhibitionsFa, null, 2), 'utf-8');

  // Also sync to src/data if it exists (for repo consistency)
  const srcDataDir = path.join(ROOT_DIR, 'src', 'data');
  if (fs.existsSync(srcDataDir)) {
    fs.writeFileSync(SRC_GALLERIES, JSON.stringify(galleries, null, 2), 'utf-8');
    fs.writeFileSync(SRC_EXHIBITIONS, JSON.stringify(allExhibitionsFa, null, 2), 'utf-8');
  }

  console.log(`--- Sync Completed Successfully! ---`);
  console.log(`Total galleries in dataset: ${galleries.length}`);
  console.log(`Total active exhibitions: ${allExhibitionsFa.length}`);
}

main().catch(err => {
  console.error('[Sync] Sync warning:', err.message);
  if (process.env.STRICT_SYNC === 'true') {
    process.exit(1);
  } else {
    console.warn('[Sync] Non-fatal fallback: Continuing with existing verified database.');
    process.exit(0);
  }
});
