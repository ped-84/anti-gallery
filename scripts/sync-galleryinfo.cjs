const fs = require('fs');
const path = require('path');
const https = require('https');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..');
const GALLERIES_FILE = path.join(ROOT_DIR, 'src', 'data', 'galleries.json');
const EXHIBITIONS_FA_FILE = path.join(ROOT_DIR, 'src', 'data', 'exhibitions_fa.json');

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 20000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.d || []);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
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

// Neighborhood detector
function getNeighborhood(address, name) {
  const t = ((address || '') + ' ' + (name || '')).toLowerCase();
  if (t.includes('شیراز') && !t.includes('میرزای شیرازی')) return 'شیراز';
  if (t.includes('اصفهان')) return 'اصفهان';
  if (t.includes('پونک') || t.includes('سعادت‌آباد') || t.includes('سعادت آباد') || t.includes('شهرک غرب') || t.includes('جلال آل احمد') || t.includes('جهان‌آرا')) return 'غرب تهران';
  if (t.includes('امیرآباد') || t.includes('کارگر') || t.includes('انقلاب') || t.includes('فاطمی') || t.includes('وصال') || t.includes('دانشگاه') || t.includes('نوفل‌لوشاتو') || t.includes('نوفل لوشاتو')) return 'مرکز، انقلاب و امیرآباد';
  if (t.includes('مطهری') || t.includes('بهشتی') || t.includes('سهروردی') || t.includes('قائم‌مقام') || t.includes('قائم مقام') || t.includes('میرزای شیرازی') || t.includes('هفت تیر') || t.includes('مفتح')) return 'بهشتی و مطهری';
  if (t.includes('کریمخان') || t.includes('کریم‌خان') || t.includes('سنایی') || t.includes('ایرانشهر') || t.includes('ویلا') || t.includes('سمیه') || t.includes('پورموسی') || t.includes('سپهبد قرنی') || t.includes('حافظ')) return 'کریم‌خان و مرکز';
  if (t.includes('فرشته') || t.includes('الهیه') || t.includes('سام سنتر') || t.includes('آقا بزرگی')) return 'الهیه و فرشته';
  if (t.includes('نیاوران') || t.includes('فرمانیه') || t.includes('اندرزگو') || t.includes('پاسداران') || t.includes('دولت') || t.includes('کامرانیه') || t.includes('آجودانیه') || t.includes('اقدسیه')) return 'نیاوران و شمال تهران';
  if (t.includes('ونک') || t.includes('ملاصدرا') || t.includes('شیخ بهایی') || t.includes('میرداماد') || t.includes('ظفر') || t.includes('گاندی')) return 'ونک، میرداماد و ظفر';
  return 'کریم‌خان و مرکز';
}

async function main() {
  console.log('--- Starting Live Exhibition Sync ---');
  
  // 1. Fetch all current events from upstream ASP.NET API
  let allEvents = [];
  let skip = 0;
  const count = 100;

  while (true) {
    console.log(`Fetching events (skip=${skip})...`);
    const batch = await fetchEventsPage(skip, count);
    if (!batch || batch.length === 0) break;
    allEvents.push(...batch);
    if (batch.length < count) break;
    skip += count;
  }

  console.log(`Total live events fetched from upstream: ${allEvents.length}`);

  // 2. Read local databases
  let galleries = [];
  if (fs.existsSync(GALLERIES_FILE)) {
    galleries = JSON.parse(fs.readFileSync(GALLERIES_FILE, 'utf-8'));
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

      const nFa = getNeighborhood(cleanAddr, galleryName);

      gallery = {
        id: e.GalleryId,
        name: galleryName,
        city: 'Tehran',
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
        neighborhood: nFa,
        nameFa: galleryName,
        cityFa: 'تهران',
        neighborhoodFa: nFa,
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
      // If gallery doesn't have activeExhibition yet or if this exhibition is newer, update it
      const currentScore = gallery.activeExhibition ? 
        ((gallery.activeExhibition.eventId === exObj.eventId) ? 1 : 0) : -1;
      
      // Update gallery active exhibition if this one is from current cycle
      if (!gallery.activeExhibition || exObj.openingDate.includes('15 آبان') || currentScore === 1) {
        gallery.activeExhibition = exObj;
        gallery.posterImage = posterUrl;
        gallery.posterSmall = posterSmallUrl;
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

  // Save files
  fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleries, null, 2), 'utf-8');
  fs.writeFileSync(EXHIBITIONS_FA_FILE, JSON.stringify(allExhibitionsFa, null, 2), 'utf-8');

  console.log(`--- Sync Completed Successfully! ---`);
  console.log(`Total galleries in dataset: ${galleries.length}`);
  console.log(`Total active exhibitions: ${allExhibitionsFa.length}`);
  const openings15Aban = allExhibitionsFa.filter(x => x.openingDate.includes('15 آبان'));
  console.log(`Openings on 15 Aban: ${openings15Aban.length}`);
}

main().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
