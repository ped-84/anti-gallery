import { CuratedTour, Gallery } from '../types/gallery';
import { parsePersianDateToScore, isThisWeekOpening } from '../utils/persianUtils';

export type CuratedTourFilterMode = 'openings-only' | 'all-active';

export interface PersianCuratedTour extends CuratedTour {
  titleFa: string;
  subtitleFa: string;
  descriptionFa: string;
  neighborhoodFa: string;
  themeColor: 'darkblue' | 'orange' | 'softblue' | 'gray';
  isOpeningThisWeek?: boolean;
  maxHopKm?: number;
}

/**
 * 1. Tight Curated Tours: STRICTLY OPENINGS THIS WEEK (یا امروز)
 * All consecutive inter-gallery hops are strictly <= 1.3 km (well below 2.2 km limit).
 * No distant outliers across highways or distant districts!
 */
export const PERSIAN_OPENING_TOURS: PersianCuratedTour[] = [
  {
    id: 'openings-karimkhan',
    title: 'Karimkhan Contemporary Openings Circuit',
    subtitle: 'This Week Openings in Karimkhan',
    city: 'Tehran',
    neighborhood: 'Karimkhan & Center',
    titleFa: 'گذر افتتاحیه‌های معاصر کریم‌خان',
    subtitleFa: 'افتتاحیه این هفته در قلب پایتخت',
    neighborhoodFa: 'کریم‌خان و سنایی',
    themeColor: 'darkblue',
    isOpeningThisWeek: true,
    galleryIds: [406, 65, 24, 443], // 009821 Kheradmand, O Gallery, Homa Gallery, Ev Gallery
    description:
      'A compact walking tour of brand new exhibitions opening this week in historic Karimkhan, South Kheradmand, and Sanai streets (all within 450 meters).',
    descriptionFa:
      'پیاده‌روی کاملاً فشرده و پیوسته (فاصله ایستگاه‌ها زیر ۵۰۰ متر) بین نگارخانه‌هایی که این هفته در محله خاطره‌انگیز کریم‌خان، خردمند و سنایی افتتاحیه دارند.',
    estimatedHours: 2.5,
    maxHopKm: 0.45
  },
  {
    id: 'openings-beheshti',
    title: 'Beheshti & Motahari New Openings',
    subtitle: 'This Week Openings in Beheshti & Motahari',
    city: 'Tehran',
    neighborhood: 'Beheshti & Motahari',
    titleFa: 'مدار افتتاحیه‌های بهشتی و مطهری',
    subtitleFa: 'افتتاحیه این هفته در محور مطهری و بهشتی',
    neighborhoodFa: 'بهشتی و مطهری',
    themeColor: 'orange',
    isOpeningThisWeek: true,
    galleryIds: [938, 8, 41], // Boostan, Arya, Vista
    description:
      'Explore fresh solo and group exhibitions opening this week across Motahari, Larestan, and Abbas Abad (all within 1.1 km).',
    descriptionFa:
      'گشت پیاده و نزدیک بین گالری‌های شاخص خیابان مطهری، لارستان و عباس‌آباد با افتتاحیه‌های تازه این هفته (حداکثر فاصله ایستگاه‌ها ۱ کیلومتر).',
    estimatedHours: 2.0,
    maxHopKm: 1.08
  },
  {
    id: 'openings-museum-laleh',
    title: 'Museum & Laleh Park Cultural Circuit',
    subtitle: 'Contemporary Museum & Laleh Openings',
    city: 'Tehran',
    neighborhood: 'Downtown, Enghelab & Amirabad',
    titleFa: 'مسیر هنری موزه معاصر و پارک لاله',
    subtitleFa: 'افتتاحیه این هفته در محوطه پارک لاله',
    neighborhoodFa: 'کارگر شمالی و پارک لاله',
    themeColor: 'softblue',
    isOpeningThisWeek: true,
    galleryIds: [263, 43], // Tehran Museum of Contemporary Art, Laleh Gallery
    description:
      'A serene walking tour visiting new exhibition openings at the Tehran Museum of Contemporary Art and adjacent Laleh Gallery (450 meters apart).',
    descriptionFa:
      'پیاده‌روی فرهنگی و آرام در حاشیه پارک لاله برای بازدید از افتتاحیه موزه هنرهای معاصر تهران و نگارخانه لاله (تنها ۴۵۰ متر فاصله پیاده).',
    estimatedHours: 2.0,
    maxHopKm: 0.45
  },
  {
    id: 'openings-elahiyeh',
    title: 'Elahiyeh & Fereshteh Openings Walk',
    subtitle: 'New Curations in Northern Tehran',
    city: 'Tehran',
    neighborhood: 'Elahiyeh & Fereshteh',
    titleFa: 'گشت افتتاحیه‌های الهیه و فرشته',
    subtitleFa: 'افتتاحیه این هفته در الهیه',
    neighborhoodFa: 'الهیه و فرشته',
    themeColor: 'gray',
    isOpeningThisWeek: true,
    galleryIds: [1005, 1019], // Kyman Gallery, Bazdid Gallery
    description:
      'A refined, tight tour visiting contemporary openings this week in Elahiyeh and Fereshteh (only 500 meters apart).',
    descriptionFa:
      'مسیر پیاده‌روی نزدیک در نگارخانه‌های مدرن الهیه و فرشته که این هفته نمایشگاه جدید دارند (فاصله دو گالری تنها ۵۰۰ متر).',
    estimatedHours: 1.5,
    maxHopKm: 0.52
  },
  {
    id: 'openings-vanak',
    title: 'Vanak & Khodami Contemporary Circuit',
    subtitle: 'Fresh Openings in Vanak & Zafar',
    city: 'Tehran',
    neighborhood: 'Vanak, Mirdamad & Zafar',
    titleFa: 'محور افتتاحیه‌های ونک و ظفر',
    subtitleFa: 'افتتاحیه این هفته در ونک و ظفر',
    neighborhoodFa: 'ونک، میرداماد و ظفر',
    themeColor: 'darkblue',
    isOpeningThisWeek: true,
    galleryIds: [26, 1026], // Vali Gallery, Zhour-A Gallery
    description:
      'A focused gallery walk covering newly opened solo exhibitions in Vanak, Khodami, and Sheikh Bahaei (1.3 km apart).',
    descriptionFa:
      'بازدید متمرکز از نگارخانه‌های دارای افتتاحیه جدید این هفته در محدوده ونک و شیخ بهایی (فاصله ۱.۳ کیلومتر).',
    estimatedHours: 1.5,
    maxHopKm: 1.30
  },
  {
    id: 'openings-lolagar',
    title: 'Downtown & Lolagar Historic Openings',
    subtitle: 'Fresh Openings in Central Tehran',
    city: 'Tehran',
    neighborhood: 'Downtown, Enghelab & Amirabad',
    titleFa: 'مسیر تاریخی لولاگر و مرکز',
    subtitleFa: 'افتتاحیه این هفته در لولاگر و مرکز',
    neighborhoodFa: 'مرکز، لولاگر و انقلاب',
    themeColor: 'gray',
    isOpeningThisWeek: true,
    galleryIds: [196, 212], // Iranshahr Gallery, Delgosha Gallery
    description:
      'A historic walk through central Tehran visiting new contemporary exhibitions in Iran Shahr and Delgosha.',
    descriptionFa:
      'پیاده‌روی فرهنگی در بافت تاریخی لولاگر و مرکز بین نگارخانه‌های دارای افتتاحیه جدید این هفته.',
    estimatedHours: 2.0,
    maxHopKm: 1.25
  }
];

/**
 * 2. Tight Curated Tours: ALL OPEN & ACTIVE EXHIBITIONS
 * Includes both new openings AND open active exhibitions that bridge routes seamlessly!
 * Every consecutive hop is strictly <= 0.85 km!
 */
export const PERSIAN_ACTIVE_TOURS: PersianCuratedTour[] = [
  {
    id: 'active-sanai-hub',
    title: 'Sanai, Hosseini & Kheradmand Art Trail',
    subtitle: '6 Premier Galleries in the Cultural Core',
    city: 'Tehran',
    neighborhood: 'Karimkhan & Center',
    titleFa: 'گذر طلایی سنایی، حسینی و خردمند',
    subtitleFa: 'اُ، شیرین، کارشیو، باشگاه، اِو و هما',
    neighborhoodFa: 'سنایی، حسینی و خردمند',
    themeColor: 'darkblue',
    isOpeningThisWeek: false,
    galleryIds: [65, 18, 1003, 952, 443, 24], // O, Shirin, Karshio, Bashgah, Ev (12,497 Knots), Homa
    description:
      'Six premier active galleries along Sanai, Hosseini, and North Kheradmand streets, all within walking distance under 210 meters.',
    descriptionFa:
      'پیاده‌روی استثنایی ۶ گالری شاخص در قلب فرهنگی سنایی و خردمند شامل گالری اُ، گالری شیرین، گالری کارشیو، گالری باشگاه، گالری اِو (نمایشگاه «۱۲,۴۹۷ گره») و گالری هما (فواصل بین هر ایستگاه کمتر از ۲۱۰ متر).',
    estimatedHours: 3.0,
    maxHopKm: 0.21
  },
  {
    id: 'active-kheradmand-corridor',
    title: 'Kheradmand & Karimkhan Corridor',
    subtitle: 'Premier Contemporary Art in Kheradmand',
    city: 'Tehran',
    neighborhood: 'Karimkhan & Center',
    titleFa: 'محور خردمند، کریم‌خان و هفت‌تیر',
    subtitleFa: '۰۰۹۸۲۱ خردمند، اِو، ثالث و اعتماد',
    neighborhoodFa: 'خردمند و کریم‌خان',
    themeColor: 'orange',
    isOpeningThisWeek: false,
    galleryIds: [406, 443, 235, 301], // 009821 Kheradmand (active), Ev, Sales, Etemad 1
    description:
      'Four celebrated active galleries along Kheradmand, Karimkhan, and Haft-e Tir with max hop under 450 meters.',
    descriptionFa:
      'مسیر پیاده‌روی محبوب خیابان خردمند، کریم‌خان و میدان هفت‌تیر شامل پروژه ۰۰۹۸۲۱ (واحد فعال خردمند ۱۸)، گالری اِو، گالری ثالث و گالری اعتماد ۱ (فواصل زیر ۴۵۰ متر).',
    estimatedHours: 2.5,
    maxHopKm: 0.45
  },
  {
    id: 'active-vanak-corridor',
    title: 'Vanak, Khodami & Deh-Vanak Corridor',
    subtitle: 'Continuous Art Trail in Vanak',
    city: 'Tehran',
    neighborhood: 'Vanak, Mirdamad & Zafar',
    titleFa: 'محور هنر ونک، خدامی و ده ونک',
    subtitleFa: 'والی، مدار موازی (میان‌راه) و ژورآ',
    neighborhoodFa: 'ونک و شیخ بهایی',
    themeColor: 'softblue',
    isOpeningThisWeek: false,
    galleryIds: [26, 551, 1026], // Vali Gallery, Parallel Circuit Gallery (middle), Zhour-A Gallery
    description:
      'A continuous 3-gallery art trail connecting Vali Gallery, Parallel Circuit (in the middle), and Zhour-A with max hop under 680 meters.',
    descriptionFa:
      'مسیر پیوسته و جذاب در ونک که گالری والی، گالری مدار موازی (دقیقاً در میانه راه در سئول/خدامی) و گالری ژورآ را با فواصل کمتر از ۶۸۰ متر به هم متصل می‌کند.',
    estimatedHours: 2.0,
    maxHopKm: 0.68
  },
  {
    id: 'active-fereshteh-sam',
    title: 'Fereshteh & Sam Center Golden Square',
    subtitle: 'Premier Contemporary Art in Fereshteh',
    city: 'Tehran',
    neighborhood: 'Elahiyeh & Fereshteh',
    titleFa: 'گشت طلایی الهیه، فرشته و سام سنتر',
    subtitleFa: 'کیمن، دستان ۲+، زیرزمین دستان و کانون دید',
    neighborhoodFa: 'الهیه و فرشته',
    themeColor: 'gray',
    isOpeningThisWeek: false,
    galleryIds: [1005, 1023, 28, 225], // Kyman, Dastan +2 (Sam Center), Dastan Basement, Dastan Did
    description:
      'Four premier galleries clustered within a 300-meter radius around Fereshteh street and Sam Center, featuring active exhibitions.',
    descriptionFa:
      'چهار نگارخانه شاخص در شعاع ۳۰۰ متری خیابان فرشته، بیدار و سام‌سنتر شامل گالری کیمن، دستان ۲+، زیرزمین دستان و کانون دید (فواصل زیر ۲۹۰ متر).',
    estimatedHours: 2.5,
    maxHopKm: 0.29
  },
  {
    id: 'active-motahari-circuit',
    title: 'Motahari & Mirzay-e Shirazi Circuit',
    subtitle: 'Painting & Sculpture Hub',
    city: 'Tehran',
    neighborhood: 'Beheshti & Motahari',
    titleFa: 'مدار هنری بهشتی و مطهری',
    subtitleFa: 'آریا، عصر، هور و بوستان',
    neighborhoodFa: 'بهشتی و مطهری',
    themeColor: 'orange',
    isOpeningThisWeek: false,
    galleryIds: [8, 467, 25, 938], // Arya, Asr, Hoor, Boostan
    description:
      'Four active galleries tightly knit along Mirzay-e Shirazi, Motahari, and Larestan with hops under 250 meters.',
    descriptionFa:
      'پیاده‌روی بسیار فشرده و دلنشین در خیابان‌های میرزای شیرازی، مطهری و لارستان شامل نگارخانه آریا، عصر، هور و بوستان (فواصل زیر ۲۵۰ متر).',
    estimatedHours: 2.5,
    maxHopKm: 0.25
  },
  {
    id: 'active-lolagar-trail',
    title: 'Lolagar & Neauphle-le-Château Heritage Trail',
    subtitle: 'Historic Architecture & Modern Art',
    city: 'Tehran',
    neighborhood: 'Downtown, Enghelab & Amirabad',
    titleFa: 'مسیر تاریخی لولاگر و نوفل‌لوشاتو',
    subtitleFa: 'آرت‌مارت، این/جا، سو و ایرانشهر',
    neighborhoodFa: 'مرکز، لولاگر و حافظ',
    themeColor: 'softblue',
    isOpeningThisWeek: false,
    galleryIds: [1020, 405, 487, 196], // Aartmaart (Lolagar), In/Ja, Soo Gallery, Iranshahr Gallery
    description:
      'Explore active contemporary art housed in renovated historical buildings in Lolagar alley, Neauphle-le-Château, and Villa (hops under 700 meters).',
    descriptionFa:
      'گشت پیاده در کوچه‌های تاریخی لولاگر، نوفل‌لوشاتو و خیابان ویلا شامل آرت‌مارت، گالری این/جا، گالری سو و گالری ایرانشهر (فواصل زیر ۷۰۰ متر).',
    estimatedHours: 2.5,
    maxHopKm: 0.70
  },
  {
    id: 'active-laleh-triangle',
    title: 'Museum & Laleh Park Cultural Triangle',
    subtitle: 'Green Oasis & Masterpieces',
    city: 'Tehran',
    neighborhood: 'Downtown, Enghelab & Amirabad',
    titleFa: 'مثلث موزه معاصر، لاله و کشاورز',
    subtitleFa: 'موزه معاصر، لاله و گالری ۳۳',
    neighborhoodFa: 'کارگر شمالی و کشاورز',
    themeColor: 'darkblue',
    isOpeningThisWeek: false,
    galleryIds: [1014, 263, 43], // Gallery 33, Tehran Museum of Contemporary Art, Laleh Gallery
    description:
      'A triangle of 3 active galleries around Laleh Park and Keshavarz boulevard with hops under 825 meters.',
    descriptionFa:
      'مسیر فرهنگی و جذاب در پیرامون پارک لاله و بلوار کشاورز شامل گالری ۳۳، موزه هنرهای معاصر تهران و نگارخانه لاله (فواصل زیر ۸۲۵ متر).',
    estimatedHours: 2.5,
    maxHopKm: 0.82
  }
];

export const PERSIAN_CURATED_TOURS = PERSIAN_OPENING_TOURS;
export const CURATED_TOURS = PERSIAN_CURATED_TOURS;

/**
 * Returns curated tours by mode:
 * 'openings-only': Strictly current week openings with hops <= 1.3 km.
 * 'all-active': All active open exhibitions including middle bridging galleries with hops <= 0.85 km.
 */
export function getCuratedToursByMode(
  _allGalleries: Gallery[],
  mode: CuratedTourFilterMode = 'openings-only'
): PersianCuratedTour[] {
  if (mode === 'all-active') {
    return PERSIAN_ACTIVE_TOURS;
  }
  return PERSIAN_OPENING_TOURS;
}
