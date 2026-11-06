import { CuratedTour, Gallery } from '../types/gallery';
import { parsePersianDateToScore, isThisWeekOpening } from '../utils/persianUtils';

export interface PersianCuratedTour extends CuratedTour {
  titleFa: string;
  subtitleFa: string;
  descriptionFa: string;
  neighborhoodFa: string;
  themeColor: 'darkblue' | 'orange' | 'softblue' | 'gray';
  isOpeningThisWeek?: boolean;
}

/**
 * Curated Tours of exhibitions opening THIS WEEK (یا امروز)
 * All galleries in these tours have an active opening in the current cycle.
 */
export const PERSIAN_CURATED_TOURS: PersianCuratedTour[] = [
  {
    id: 'openings-karimkhan',
    title: 'Karimkhan Contemporary Openings Circuit',
    subtitle: 'This Week Openings in Karimkhan',
    city: 'Tehran',
    neighborhood: 'Karimkhan & Center',
    titleFa: 'گذر افتتاحیه‌های معاصر کریم‌خان',
    subtitleFa: 'افتتاحیه این هفته در قلب پایتخت',
    neighborhoodFa: 'کریم‌خان و مرکز',
    themeColor: 'darkblue',
    isOpeningThisWeek: true,
    galleryIds: [406, 65, 24, 443], // 009821 Kheradmand, O Gallery, Homa Gallery, Ev Gallery
    description:
      'A curated walking tour of brand new exhibitions opening this week around historic Karimkhan, South Kheradmand, and Sanai streets.',
    descriptionFa:
      'پیاده‌روی اختصاصی بین نگارخانه‌هایی که این هفته در محله خاطره‌انگیز کریم‌خان، خردمند و سنایی نمایشگاه تازه افتتاح کرده‌اند.',
    estimatedHours: 3.0
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
    galleryIds: [938, 8, 41, 755], // Boostan Gallery, Arya Gallery, Vista Gallery, Didar Gallery
    description:
      'Explore fresh solo and group exhibitions opening this week across Motahari, Beheshti, and Mirzay-e Shirazi art circuit.',
    descriptionFa:
      'گشت پیاده و فشرده بین گالری‌های شاخص خیابان مطهری، بهشتی و میرزای شیرازی با افتتاحیه‌های تازه و داغ این هفته.',
    estimatedHours: 3.0
  },
  {
    id: 'openings-central',
    title: 'Museum & Downtown Historic Trail',
    subtitle: 'Contemporary Museum & Downtown Openings',
    city: 'Tehran',
    neighborhood: 'Downtown, Enghelab & Amirabad',
    titleFa: 'مسیر طلایی موزه معاصر، انقلاب و مرکز',
    subtitleFa: 'افتتاحیه این هفته در محور فرهنگ و لاله',
    neighborhoodFa: 'مرکز، انقلاب و امیرآباد',
    themeColor: 'softblue',
    isOpeningThisWeek: true,
    galleryIds: [263, 405, 43], // Tehran Museum of Contemporary Art, In/Ja Gallery, Laleh Gallery
    description:
      'A cultural journey visiting new exhibition openings at the prestigious Tehran Museum of Contemporary Art, In/Ja, and Laleh Gallery.',
    descriptionFa:
      'بازدید از افتتاحیه‌های برجسته این هفته در موزه هنرهای معاصر تهران، گالری این/جا (نوفل‌لوشاتو) و نگارخانه لاله.',
    estimatedHours: 2.5
  },
  {
    id: 'openings-north',
    title: 'North, Elahiyeh & Niavaran Openings',
    subtitle: 'New Curations in Northern Tehran',
    city: 'Tehran',
    neighborhood: 'Elahiyeh & Fereshteh',
    titleFa: 'گشت افتتاحیه‌های شمال، الهیه و نیاوران',
    subtitleFa: 'افتتاحیه این هفته در شمال تهران',
    neighborhoodFa: 'الهیه، فرشته و نیاوران',
    themeColor: 'gray',
    isOpeningThisWeek: true,
    galleryIds: [1005, 1019, 497], // Kyman Gallery, Bazdid Gallery, Ba Gallery
    description:
      'A refined tour visiting contemporary openings this week in Elahiyeh, Fereshteh, and Niavaran.',
    descriptionFa:
      'مسیر گالری‌گردی در نگارخانه‌های مدرن الهیه، فرشته و نیاوران که این هفته نمایشگاه جدید افتتاح کرده‌اند.',
    estimatedHours: 2.5
  },
  {
    id: 'openings-vanak',
    title: 'Vanak & Zafar Contemporary Circuit',
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
      'A focused gallery walk covering newly opened solo exhibitions in Vanak, Khodami, and Dastgerdi (Zafar) streets.',
    descriptionFa:
      'بازدید متمرکز از نگارخانه‌های فعال با افتتاحیه جدید این هفته در محدوده ونک، خیابان خدامی و دستگردی (ظفر).',
    estimatedHours: 1.5
  }
];

export const CURATED_TOURS = PERSIAN_CURATED_TOURS;

/**
 * Dynamically clusters and generates curated tours exclusively from galleries
 * that have an exhibition opening THIS WEEK (یا امروز) in the current cycle.
 */
export function getCuratedOpeningTours(allGalleries: Gallery[]): PersianCuratedTour[] {
  if (!allGalleries || allGalleries.length === 0) {
    return PERSIAN_CURATED_TOURS;
  }

  const tehranGalleries = allGalleries.filter(
    (g) => g.city === 'Tehran' || !g.city || g.cityFa === 'تهران'
  );

  const scores = tehranGalleries
    .map((g) => parsePersianDateToScore(g.activeExhibition?.openingDate))
    .filter((s) => s > 0);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  const thisWeekGalleries = tehranGalleries.filter((g) =>
    isThisWeekOpening(g.activeExhibition?.openingDate, maxScore)
  );

  if (thisWeekGalleries.length === 0) {
    return PERSIAN_CURATED_TOURS;
  }

  interface ClusterDef {
    id: string;
    title: string;
    titleFa: string;
    subtitleFa: string;
    neighborhoodFa: string;
    themeColor: 'darkblue' | 'orange' | 'softblue' | 'gray';
    descriptionFa: string;
    targetNeighs: string[];
    galleries: Gallery[];
  }

  const clusters: Record<string, ClusterDef> = {
    karimkhan: {
      id: 'openings-karimkhan',
      title: 'Karimkhan Contemporary Openings Circuit',
      titleFa: 'گذر افتتاحیه‌های معاصر کریم‌خان',
      subtitleFa: 'افتتاحیه این هفته در قلب پایتخت',
      neighborhoodFa: 'کریم‌خان و مرکز',
      themeColor: 'darkblue',
      descriptionFa:
        'پیاده‌روی اختصاصی بین نگارخانه‌هایی که این هفته در محله خاطره‌انگیز کریم‌خان، خردمند و سنایی نمایشگاه تازه افتتاح کرده‌اند.',
      targetNeighs: ['کریم‌خان و مرکز'],
      galleries: []
    },
    beheshti: {
      id: 'openings-beheshti',
      title: 'Beheshti & Motahari New Openings',
      titleFa: 'مدار افتتاحیه‌های بهشتی و مطهری',
      subtitleFa: 'افتتاحیه این هفته در محور مطهری و بهشتی',
      neighborhoodFa: 'بهشتی و مطهری',
      themeColor: 'orange',
      descriptionFa:
        'گشت پیاده و فشرده بین گالری‌های شاخص خیابان مطهری، بهشتی و میرزای شیرازی با افتتاحیه‌های تازه و داغ این هفته.',
      targetNeighs: ['بهشتی و مطهری'],
      galleries: []
    },
    central: {
      id: 'openings-central',
      title: 'Museum & Downtown Historic Trail',
      titleFa: 'مسیر طلایی موزه معاصر، انقلاب و مرکز',
      subtitleFa: 'افتتاحیه این هفته در محور فرهنگ و لاله',
      neighborhoodFa: 'مرکز، انقلاب و امیرآباد',
      themeColor: 'softblue',
      descriptionFa:
        'بازدید از افتتاحیه‌های برجسته این هفته در موزه هنرهای معاصر تهران، گالری این/جا (نوفل‌لوشاتو) و نگارخانه لاله.',
      targetNeighs: ['مرکز، انقلاب و امیرآباد'],
      galleries: []
    },
    north: {
      id: 'openings-north',
      title: 'North, Elahiyeh & Niavaran Openings',
      titleFa: 'گشت افتتاحیه‌های شمال، الهیه و نیاوران',
      subtitleFa: 'افتتاحیه این هفته در شمال تهران',
      neighborhoodFa: 'الهیه، فرشته و نیاوران',
      themeColor: 'gray',
      descriptionFa:
        'مسیر گالری‌گردی در نگارخانه‌های مدرن الهیه، فرشته و نیاوران که این هفته نمایشگاه جدید افتتاح کرده‌اند.',
      targetNeighs: ['الهیه و فرشته', 'نیاوران و شمال تهران'],
      galleries: []
    },
    vanak: {
      id: 'openings-vanak',
      title: 'Vanak & Zafar Contemporary Circuit',
      titleFa: 'محور افتتاحیه‌های ونک و ظفر',
      subtitleFa: 'افتتاحیه این هفته در ونک و ظفر',
      neighborhoodFa: 'ونک، میرداماد و ظفر',
      themeColor: 'darkblue',
      descriptionFa:
        'بازدید متمرکز از نگارخانه‌های فعال با افتتاحیه جدید این هفته در محدوده ونک، خیابان خدامی و دستگردی (ظفر).',
      targetNeighs: ['ونک، میرداماد و ظفر'],
      galleries: []
    }
  };

  thisWeekGalleries.forEach((g) => {
    const n = g.neighborhoodFa || g.neighborhood || '';
    let matched = false;
    for (const c of Object.values(clusters)) {
      if (c.targetNeighs.some((tn) => n.includes(tn) || tn.includes(n))) {
        c.galleries.push(g);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.karimkhan.galleries.push(g);
    }
  });

  const generated = Object.values(clusters)
    .filter((c) => c.galleries.length >= 2)
    .map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitleFa,
      city: 'Tehran',
      neighborhood: c.neighborhoodFa,
      titleFa: c.titleFa,
      subtitleFa: c.subtitleFa,
      neighborhoodFa: c.neighborhoodFa,
      themeColor: c.themeColor,
      isOpeningThisWeek: true,
      galleryIds: c.galleries.map((g) => g.id),
      description: c.descriptionFa,
      descriptionFa: c.descriptionFa,
      estimatedHours: Math.round((c.galleries.length * 0.6 + 0.5) * 2) / 2
    }));

  return generated.length > 0 ? generated : PERSIAN_CURATED_TOURS;
}
