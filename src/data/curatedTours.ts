import { CuratedTour } from '../types/gallery';

export interface PersianCuratedTour extends CuratedTour {
  titleFa: string;
  subtitleFa: string;
  descriptionFa: string;
  neighborhoodFa: string;
  themeColor: 'darkblue' | 'orange' | 'softblue' | 'gray';
}

export const PERSIAN_CURATED_TOURS: PersianCuratedTour[] = [
  {
    id: 'karimkhan-corridor',
    title: 'Karimkhan Contemporary Corridor',
    subtitle: 'Heart of Tehran Art Scene',
    city: 'Tehran',
    neighborhood: 'Karimkhan & Center',
    titleFa: 'گذر هنر معاصر کریم‌خان',
    subtitleFa: 'قلب گالری‌های هنری تهران',
    neighborhoodFa: 'کریم‌خان و مرکز',
    themeColor: 'darkblue',
    galleryIds: [406, 217, 1025, 486, 666], // 009821 Projects, A Gallery, Bina Gallery, Aban Art House, 009821 2nd floor
    description:
      'Stroll through historic Karimkhan Zand, South Aban, and Kheradmand streets featuring avant-garde photography, experimental installations, and vibrant studio spaces.',
    descriptionFa:
      'پیاده‌روی هنری در خیابان‌های خاطره‌انگیز کریم‌خان زند، آبان جنوبی و خردمند با مجموعه‌ای از عکاسی پیشرو، چیدمان‌های مفهومی و نگارخانه‌های معتبر.',
    estimatedHours: 3.0
  },
  {
    id: 'fereshteh-luxury-walk',
    title: 'Elahiyeh & Fereshteh High-Art Walk',
    subtitle: 'Premier Modern Curations',
    city: 'Tehran',
    neighborhood: 'Elahiyeh & Fereshteh',
    titleFa: 'گشت هنری الهیه و فرشته',
    subtitleFa: 'هنر مدرن و معاصر شمال تهران',
    neighborhoodFa: 'الهیه و فرشته',
    themeColor: 'orange',
    galleryIds: [1023, 28, 225, 1009], // +2 Fereshteh (Sam Center), Dastan Basement, Dastan Did, Melal Boutique Mall
    description:
      'An upscale gallery crawl through Northern Tehran showcases solo master retrospectives, cutting-edge sculpture, and design platforms.',
    descriptionFa:
      'تور بازدید از نگارخانه‌های شاخص فرشته، سام سنتر و خیابان بیدار شامل مرور آثار اساتید تجسمی، مجسمه‌سازی معاصر و فضاهای مدرن طراحی.',
    estimatedHours: 2.5
  },
  {
    id: 'downtown-cultural-trail',
    title: 'Downtown & Enghelab Art Trail',
    subtitle: 'Heritage & Experimental Art',
    city: 'Tehran',
    neighborhood: 'Downtown, Enghelab & Amirabad',
    titleFa: 'مسیر تاریخی مرکز، انقلاب و لولاگر',
    subtitleFa: 'معماری کهن و هنرهای تجربی',
    neighborhoodFa: 'مرکز، انقلاب و امیرآباد',
    themeColor: 'softblue',
    galleryIds: [111, 1020, 63, 212], // Aaran Projects, Aartmaart Space, Ab/Anbar, Delgosha
    description:
      'Immerse in the historic alleys of Lolagar, Neauphle-le-Château, and 12th Farvardin, featuring converted architectural spaces, documentary photography, and conceptual works.',
    descriptionFa:
      'غوطه‌وری در کوچه‌های تاریخی لولاگر، نوفل‌لوشاتو و خیابان انقلاب با ساختمان‌های احیاشده، آثار مستند اجتماعی، چیدمان و هنر مفهومی.',
    estimatedHours: 2.5
  },
  {
    id: 'motahari-beheshti-circuit',
    title: 'Motahari & Beheshti Art Circuit',
    subtitle: 'Modernism & Mixed Media',
    city: 'Tehran',
    neighborhood: 'Beheshti & Motahari',
    titleFa: 'مدار هنری بهشتی و مطهری',
    subtitleFa: 'نقاشی معاصر، طراحی و فضاهای مستقل',
    neighborhoodFa: 'بهشتی و مطهری',
    themeColor: 'gray',
    galleryIds: [496, 226, 467, 25], // 1- Gallery, Negah, Asr, Hoor
    description:
      'A relaxed circuit through Larestan, Motahari, and Mirzay-e Shirazi exploring contemporary painting and solo retrospectives.',
    descriptionFa:
      'گشت‌وگذار پیاده در خیابان‌های لارستان، مطهری و میرزای شیرازی برای تماشای نقاشی فیگوراتیو و انتزاعی معاصر و نمایشگاه‌های انفرادی.',
    estimatedHours: 2.5
  }
];


export const CURATED_TOURS = PERSIAN_CURATED_TOURS;
