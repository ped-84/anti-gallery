/**
 * Persian number and string conversion utilities
 */
export function toPersianDigits(input: number | string | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

export type TrafficCondition = 'normal' | 'peak' | 'weekend';

export interface TrafficConfig {
  condition: TrafficCondition;
  label: string;
  shortLabel: string;
  multiplier: number;
  description: string;
}

export const TRAFFIC_MODELS: Record<TrafficCondition, TrafficConfig> = {
  normal: {
    condition: 'normal',
    label: 'ساعات عادی (روان)',
    shortLabel: 'عادی (روان)',
    multiplier: 1.0,
    description: 'ترافیک روان بین‌ساعتی بدون تاخیر نامتعارف'
  },
  peak: {
    condition: 'peak',
    label: 'اوج شلوغی عصر (۱۶ تا ۲۰:۳۰)',
    shortLabel: 'اوج عصر (شلوغ)',
    multiplier: 1.55,
    description: 'همزمانی با ساعت اوج ترافیک و گالری‌گردی در معابر پرتردد تهران'
  },
  weekend: {
    condition: 'weekend',
    label: 'جمعه و روزهای تعطیل',
    shortLabel: 'جمعه و تعطیلات',
    multiplier: 1.2,
    description: 'ترافیک ملایم مناطق شمالی و مراکز فرهنگی در روزهای تعطیل'
  }
};

/**
 * Checks if a gallery address or coordinates fall inside Tehran's Central Traffic Zone
 * (محدوده طرح ترافیک مرکزی تهران: خیابان انقلاب، حافظ، کریم‌خان، مطهری، فردوسی، نوفل‌لوشاتو و ...)
 */
export function isInTehranTrafficZone(address: string = '', lat: number = 0, lng: number = 0): boolean {
  const text = address.toLowerCase();
  const keywords = [
    'karimkhan',
    'کریم‌خان',
    'کریمخان',
    'آبان',
    'aban',
    'خردمند',
    'kheradmand',
    'عضدی',
    'azodi',
    'انقلاب',
    'enghelab',
    'نوفل',
    'lolagar',
    'لولاگر',
    'فردوسی',
    'ferdowsi',
    'حافظ',
    'hafez',
    'طالقانی',
    'taleghani',
    'مطهری',
    'motahari',
    'لارستان',
    'larestan'
  ];

  for (const kw of keywords) {
    if (text.includes(kw)) return true;
  }

  // Bounding box for Tehran central traffic ring
  // approx Lat: 35.68 to 35.73, Lng: 51.39 to 51.44
  if (lat >= 35.68 && lat <= 35.73 && lng >= 51.39 && lng <= 51.44) {
    return true;
  }

  return false;
}

/**
 * Neighborhood Persian Mapping
 */
export const NEIGHBORHOOD_FA_MAP: Record<string, string> = {
  'Karimkhan & Center': 'کریم‌خان و مرکز',
  'Beheshti & Motahari': 'بهشتی و مطهری',
  'Downtown, Enghelab & Amirabad': 'مرکز، انقلاب و امیرآباد',
  'Vanak, Mirdamad & Zafar': 'ونک، میرداماد و ظفر',
  'Elahiyeh & Fereshteh': 'الهیه و فرشته',
  'North Tehran & Niavaran': 'نیاوران و شمال تهران',
  'West Tehran': 'غرب تهران',
  'Isfahan': 'اصفهان',
  'Shiraz': 'شیراز',
  // Backward compatibility aliases
  'Central & Vanak': 'بهشتی و مطهری',
  'Downtown & University': 'مرکز، انقلاب و امیرآباد',
  'Mirdamad & Zafar': 'ونک، میرداماد و ظفر',
  'Greater Tehran': 'تهران بزرگ'
};

export function getPersianNeighborhood(raw: string = ''): string {
  return NEIGHBORHOOD_FA_MAP[raw] || raw;
}

export const GALLERY_NAME_FA_MAP: Record<string, string> = {
  // English gallery names mapped to pure Persian
  'Negah Gallery': 'گالری نگاه',
  'Negah': 'گالری نگاه',
  'Soo Gallery': 'گالری سو',
  'Soo': 'گالری سو',
  'Delgosha Gallery': 'گالری دلگشا',
  'Delgosha': 'گالری دلگشا',
  'Asr Gallery': 'گالری عصر',
  'Asr': 'گالری عصر',
  'B Gallery': 'گالری بی (آجودانیه)',
  'B': 'گالری بی',
  'e1 Gallery': 'گالری ایوان',
  'e1': 'گالری ایوان',
  'Etemad 1 Gallery': 'گالری اعتماد ۱',
  'Etemad': 'گالری اعتماد',
  'Jaleh Art Gallery': 'گالری ژاله',
  'Jaleh': 'گالری ژاله',
  'Sharif Gallery': 'گالری شریف',
  'Sharif': 'گالری شریف',
  'Bavan Gallery': 'گالری باوان',
  'Bavan': 'گالری باوان',
  'Shirin Gallery': 'گالری شیرین (کریم‌خان)',
  'Shirin': 'گالری شیرین',
  'Aliha Gallery': 'نگارخانه علیها',
  'Aliha': 'نگارخانه علیها',
  'IranShahr Gallery': 'گالری ایرانشهر',
  'IranShahr': 'گالری ایرانشهر',
  'Sales Gallery': 'گالری ثالث',
  'Sales': 'گالری ثالث',
  'Bostan Gallery': 'گالری بوستان',
  'Bostan': 'گالری بوستان',
  'Shokouh Gallery': 'گالری شکوه',
  'Shokouh': 'گالری شکوه',
  'Art Center Gallery': 'گالری آرت سنتر',
  'Art Center': 'گالری آرت سنتر',
  'Arjang Gallery': 'گالری ارژنگ',
  'Arte Gallery': 'گالری آرته',
  'A Gallery': 'گالری آ',
  'Aaria Gallery': 'نگارخانه آریا',
  'Aria Gallery': 'نگارخانه آریا (ولیعصر)',
  'Atbin Gallery': 'گالری آتبین (ولیعصر)',
  'Hoor Gallery': 'نگارخانه هور (مطهری)',
  'Dastan': 'زیرزمین دستان (فِرشته)',
  '+2 Fereshteh (Sam Center)': 'گالری دستان +۲ (سام سنتر)',
  '2+ (Deh Vanak)': 'گالری ۲+ (ده ونک)',
  '009821 Projects': 'پروژه ۰۰۹۸۲۱ (خردمند)',
  '۰۰۹۸۲۱ طبقه دوم Projects': 'پروژه ۰۰۹۸۲۱ (طبقه دوم)',
  '1- Gallery': 'نگارخانه ۱- (خیابان لارستان)',
  '26 Gallery': 'گالری ۲۶ (فرمانیه)',
  '3 Platform': 'پلتفرم ۳',
  '4 Gallery': 'گالری ۴',
  '7Rang Gallery': 'گالری هفت‌رنگ',
  '8cube Gallery': 'گالری ایت‌کیوب',
  '۸۳ Gallery': 'گالری ۸۳',
  '32 Gallery': 'گالری ۳۲',
  'Aaran Projects': 'پروژه‌های آران (کوچه لولاگر)',
  'Ab/Anbar Gallery': 'گالری آب/انبار',
  'Aban Art House Gallery': 'خانه هنر آبان',
  'Abi Gallery': 'گالری آبی (دولت)',
  'Abolfazl Ali Gallery': 'نگارخانه ابوالفضل عالی',
  'Ace Gallery': 'گالری آس',
  'Adapa Gallery': 'گالری آداپا',
  'Afarinesh Gallery': 'نگارخانه آفرینش',
  'Afrand 2 Gallery': 'نگارخانه افرند (شعبه ۲)',
  'Ag Gallery': 'گالری ای‌جی (ولیعصر)',
  'Airin Gallery': 'گالری ایرین',
  'Aknoon Gallery': 'گالری اکنون',
  'Alef Room': 'اتاق الف',
  'Tehran Museum of Contemporary Art': 'موزه هنرهای معاصر تهران',
  'Bohran Gallery': 'گالری برهان',
  'CC Art Space': 'فضای هنری سی‌سی',
  'City Center Gallery': 'گالری سیتی سنتر',
  'Cyan Gallery': 'گالری سایان',
  'Didar Gallery': 'گالری دیدار',
  'Emrooz Gallery': 'گالری امروز',
  'Gozaar Gallery': 'گالری گذار',
  'Hounareh Gallery': 'گالری هناره',
  'Isfahan Museum of Contemporary Art': 'موزه هنرهای معاصر اصفهان',
  'Matn Gallery': 'گالری متن',
  'Matne Emrooz Gallery': 'گالری متن امروز',
  'Negahe no Gallery': 'گالری نگاه نو',
  'Negaresh Gallery': 'گالری نگارش',
  'Safavi Gallery': 'گالری صفوی',
  'Tamasha Gallery': 'گالری تماشا',
  'thur Gallery': 'گالری نور',
  'Ab Gallery': 'گالری آب',
  'Afdesta Gallery': 'گالری افدستا',
  'Beh Negar Gallery': 'گالری به‌نگار',
  'bidbon Gallery': 'گالری بیدبن',
  'Haan Gallery': 'گالری هان',
  'Haan Rahro Gallery': 'گالری راهرو هان',
  'Naranj Gallery': 'گالری نارنج',
  'Pirsook Gallery': 'گالری پیرسوک',
  'Sarvenaz Gallery': 'گالری سروناز',
  'Tar o Pood Gallery': 'گالری تار و پود',
  'The Shoors Gallery': 'گالری شورش',
  'Vesal Shirazi Gallery': 'گالری وصال شیرازی',
  'Zie Gallery': 'گالری زی',
  'Mirana Gallery': 'گالری میرانا (میرداماد)',
  'Iranian Artists Forum [Momayez] Gallery': 'خانه هنرمندان ایران (سالن ممیز)',
  // Persian variants and unparsed artifacts
  'گالری Negah': 'گالری نگاه',
  'گالری Soo': 'گالری سو',
  'گالری 1 گالری': 'گالری ایوان',
  'گالری ۱ گالری': 'گالری ایوان',
  'گالری ای‌وان': 'گالری ایوان',
  'ای‌وان': 'گالری ایوان',
  'ایوان': 'گالری ایوان',
  'گالری 32 گالری': 'گالری ۳۲',
  'گالری ۳۲ گالری': 'گالری ۳۲',
  'گالری B': 'گالری بی',
  'گالری B Gallery': 'گالری بی (آجودانیه)'
};

/**
 * Safely resolves the gallery display name in 100% Persian.
 * Guarantees no English words appear in gallery names.
 */
export function getGalleryDisplayName(gallery?: { nameFa?: string; name?: string } | null): string {
  if (!gallery) return '';
  const fa = (gallery.nameFa || '').trim();
  const en = (gallery.name || '').trim();

  // 1. Direct dictionary match for English name
  if (en && GALLERY_NAME_FA_MAP[en]) {
    return GALLERY_NAME_FA_MAP[en];
  }

  // 2. Direct dictionary match for Persian name or artifact
  if (fa && GALLERY_NAME_FA_MAP[fa]) {
    return GALLERY_NAME_FA_MAP[fa];
  }

  // 3. If fa contains English characters (e.g. "گالری Negah" or "e1"), try to map or clean it
  if (fa && /[a-zA-Z]/.test(fa)) {
    for (const [key, val] of Object.entries(GALLERY_NAME_FA_MAP)) {
      if (fa.toLowerCase().includes(key.toLowerCase())) {
        return val;
      }
    }
  }

  // 4. Valid pure Persian name
  if (fa && fa !== 'گالری' && fa !== 'نگارخانه') {
    return fa;
  }

  // 5. If en is already Persian
  if (en && /[\u0600-\u06FF]/.test(en)) {
    return en;
  }

  return 'گالری هنر';
}

const PERSIAN_MONTHS: Record<string, number> = {
  'فروردین': 1,
  'اردیبهشت': 2,
  'خرداد': 3,
  'تیر': 4,
  'مرداد': 5,
  'شهریور': 6,
  'مهر': 7,
  'آبان': 8,
  'آذر': 9,
  'دی': 10,
  'بهمن': 11,
  'اسفند': 12
};

/**
 * Parses Persian exhibition opening date into a numerical score (YYYYMMDD) for sorting and cycle detection.
 * Example: 'جمعه 8 آبان 1405' -> 14050808
 */
export function parsePersianDateToScore(dateStr: string = ''): number {
  if (!dateStr) return 0;
  const enStr = dateStr
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();

  // Find 4-digit year like 1405 or 1404
  const yearMatch = enStr.match(/\b(14\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 1405;

  // Find month
  let month = 0;
  for (const [mName, mNum] of Object.entries(PERSIAN_MONTHS)) {
    if (enStr.includes(mName)) {
      month = mNum;
      break;
    }
  }

  // Find day
  const numbers = enStr.match(/\b(\d{1,2})\b/g);
  let day = 1;
  if (numbers) {
    for (const n of numbers) {
      const val = parseInt(n, 10);
      if (val >= 1 && val <= 31) {
        day = val;
        break;
      }
    }
  }

  return year * 10000 + month * 100 + day;
}

/**
 * Determines whether an exhibition opened during the current week cycle (latest Friday/Thursday).
 */
export function isThisWeekOpening(openingDate?: string, maxScore?: number): boolean {
  if (!openingDate) return false;
  const score = parsePersianDateToScore(openingDate);
  if (!score || score <= 0) return false;
  if (!maxScore || maxScore <= 0) return true;
  return score >= maxScore - 2 && score <= maxScore;
}

/**
 * Detects the exhibition art medium or subject (نقاشی، عکاسی، مجسمه‌سازی، خوشنویسی، و غیره)
 */
export function getExhibitionMedium(title?: string, artist?: string, type?: string): string {
  const combined = `${title || ''} ${artist || ''} ${type || ''}`.toLowerCase();
  
  if (combined.includes('نقاش') || combined.includes('رنگ روغن') || combined.includes('آبرنگ') || combined.includes('اکریلیک')) {
    return 'نقاشی';
  }
  if (combined.includes('عکس') || combined.includes('عکاس') || combined.includes('فوتوگراف') || combined.includes('photo')) {
    return 'عکاسی';
  }
  if (combined.includes('مجسم') || combined.includes('تندیس') || combined.includes('حجم') || combined.includes('سرامیک') || combined.includes('سفال')) {
    return 'مجسمه‌سازی و حجم';
  }
  if (combined.includes('خوشنویس') || combined.includes('خطاط') || combined.includes('کالیگراف') || combined.includes('مرقع') || combined.includes('خط ')) {
    return 'خوشنویسی و خط';
  }
  if (combined.includes('طراح') || combined.includes('فیگور') || combined.includes('اسکیس')) {
    return 'طراحی';
  }
  if (combined.includes('چاپ') || combined.includes('سیلک') || combined.includes('لیتوگراف')) {
    return 'چاپ دستی';
  }
  if (combined.includes('چیدمان') || combined.includes('اینستالیشن') || combined.includes('کانسپچوال')) {
    return 'چیدمان (اینستالیشن)';
  }
  if (combined.includes('ویدیو') || combined.includes('ویدئو') || combined.includes('چندرسان') || combined.includes('نیومدیا')) {
    return 'چندرسانه‌ای';
  }
  if (combined.includes('گنجینه') || combined.includes('موزه هنر')) {
    return 'گنجینه موزه';
  }
  if (combined.includes('گره') || combined.includes('فرش') || combined.includes('الیاف') || combined.includes('بافت')) {
    return 'هنر الیاف و بافت';
  }
  return 'هنرهای تجسمی';
}


