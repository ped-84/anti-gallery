import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Lock,
  Plus,
  Edit3,
  Trash2,
  Search,
  Upload,
  Check,
  AlertCircle,
  Calendar,
  MapPin,
  Sparkles,
  Image as ImageIcon,
  Building2,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { Gallery, Exhibition } from '../types/gallery';
import { toPersianDigits } from '../utils/persianUtils';
import { ClayDropdown } from './ClayDropdown';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  galleries: Gallery[];
  onGalleriesUpdated: (updatedList: Gallery[]) => void;
  isDarkMode?: boolean;
  adminEnabled?: boolean;
  serverRole?: string;
  isStandalone?: boolean;
}

const MEDIUM_OPTIONS = [
  { value: 'نقاشی', label: 'نقاشی' },
  { value: 'عکاسی', label: 'عکاسی' },
  { value: 'مجسمه‌سازی و حجم', label: 'مجسمه‌سازی و حجم' },
  { value: 'خوشنویسی و خط', label: 'خوشنویسی و خط' },
  { value: 'طراحی', label: 'طراحی' },
  { value: 'چاپ دستی', label: 'چاپ دستی' },
  { value: 'چیدمان (اینستالیشن)', label: 'چیدمان (اینستالیشن)' },
  { value: 'هنر معاصر و چندرسانه‌ای', label: 'هنر معاصر و چندرسانه‌ای' },
  { value: 'هنر الیاف و بافت', label: 'هنر الیاف و بافت' },
  { value: 'گنجینه موزه', label: 'گنجینه موزه' },
  { value: 'هنرهای تجسمی', label: 'هنرهای تجسمی (عمومی)' }
];

const NEIGHBORHOOD_OPTIONS = [
  { value: 'نیاوران و شمال تهران', label: 'نیاوران و شمال تهران' },
  { value: 'الهیه و فرشته', label: 'الهیه و فرشته' },
  { value: 'ونک، میرداماد و ظفر', label: 'ونک، میرداماد و ظفر' },
  { value: 'بهشتی و مطهری', label: 'بهشتی و مطهری' },
  { value: 'کریم‌خان و مرکز', label: 'کریم‌خان و مرکز' },
  { value: 'مرکز، انقلاب و امیرآباد', label: 'مرکز، انقلاب و امیرآباد' },
  { value: 'غرب تهران', label: 'غرب تهران' }
];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  galleries,
  onGalleriesUpdated,
  isDarkMode = false,
  adminEnabled = true,
  serverRole = 'primary',
  isStandalone = false
}) => {
  // Token state: persist in sessionStorage
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return sessionStorage.getItem('artgasht_admin_token') || null;
  });

  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [editingGallery, setEditingGallery] = useState<Gallery | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    artist: '',
    medium: 'نقاشی',
    openingDate: '',
    closingDate: '',
    neighborhood: 'کریم‌خان و مرکز',
    address: '',
    phone: '',
    hours: '۱۶ الی ۲۰',
    closedDays: 'شنبه‌ها',
    lat: '35.72',
    lng: '51.41',
    posterUrl: ''
  });

  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Filter galleries for admin search (declared unconditionally at top level per React Hook rules)
  const filteredGalleries = useMemo(() => {
    if (!searchQuery.trim()) return galleries.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return galleries.filter((g) => {
      const name = (g.name || '').toLowerCase();
      const artist = (g.activeExhibition?.artist || '').toLowerCase();
      const title = (g.activeExhibition?.title || '').toLowerCase();
      return name.includes(q) || artist.includes(q) || title.includes(q);
    });
  }, [galleries, searchQuery]);

  // Handle ESC key to close modal (declared unconditionally at top level)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok && data.success && data.token) {
        sessionStorage.setItem('artgasht_admin_token', data.token);
        setAuthToken(data.token);
        setPassword('');
      } else {
        setLoginError(data.error || 'رمز عبور مدیریت نادرست است');
      }
    } catch (err: any) {
      setLoginError('ارتباط با سرور برقرار نشد. لطفاً از اتصال سرور مطمئن شوید.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('artgasht_admin_token');
    setAuthToken(null);
    setEditingGallery(null);
    setIsCreatingNew(false);
  };

  // Open Edit Form
  const startEdit = (gallery: Gallery) => {
    setEditingGallery(gallery);
    setIsCreatingNew(false);
    setStatusMessage(null);

    const ex = gallery.activeExhibition;
    setFormData({
      name: gallery.name || '',
      title: ex?.title || '',
      artist: ex?.artist || '',
      medium: ex?.medium || 'نقاشی',
      openingDate: ex?.openingDate || '',
      closingDate: ex?.closingDate || '',
      neighborhood: gallery.neighborhoodFa || gallery.neighborhood || 'کریم‌خان و مرکز',
      address: gallery.addressFa || gallery.address || '',
      phone: gallery.phone || '',
      hours: gallery.hoursFa || gallery.hours || '۱۶ الی ۲۰',
      closedDays: 'شنبه‌ها',
      lat: String(gallery.lat || '35.72'),
      lng: String(gallery.lng || '51.41'),
      posterUrl: ex?.poster || gallery.posterImage || ''
    });
  };

  // Open Create Form
  const startCreate = () => {
    setIsCreatingNew(true);
    setEditingGallery(null);
    setStatusMessage(null);
    setFormData({
      name: '',
      title: '',
      artist: '',
      medium: 'نقاشی',
      openingDate: 'جمعه جاری',
      closingDate: 'جمعه آینده',
      neighborhood: 'کریم‌خان و مرکز',
      address: 'تهران، ',
      phone: '',
      hours: '۱۶ الی ۲۰',
      closedDays: 'شنبه‌ها',
      lat: '35.72',
      lng: '51.41',
      posterUrl: ''
    });
  };

  // Image Upload Handler (reads file as Base64, sends to /api/admin/upload)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!authToken) {
      setStatusMessage({ text: 'لطفاً ابتدا وارد شوید', isError: true });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ filename: file.name, base64Data })
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setFormData((prev) => ({ ...prev, posterUrl: data.url }));
          setStatusMessage({ text: 'تصویر پوستر با موفقیت روی سرور ذخیره شد' });
        } else {
          setStatusMessage({ text: data.error || 'خطا در آپلود تصویر', isError: true });
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setStatusMessage({ text: 'خطا در پردازش فایل: ' + err.message, isError: true });
      setIsUploading(false);
    }
  };

  // Save changes (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    setStatusMessage(null);
    const parsedLat = parseFloat(formData.lat) || 35.72;
    const parsedLng = parseFloat(formData.lng) || 51.41;

    const exhibition: Exhibition = {
      title: formData.title || 'نمایشگاه گروهی',
      artist: formData.artist,
      medium: formData.medium,
      openingDate: formData.openingDate,
      closingDate: formData.closingDate,
      poster: formData.posterUrl,
      posterSmall: formData.posterUrl
    };

    const payload: Partial<Gallery> = {
      name: formData.name,
      nameFa: formData.name,
      city: 'tehran',
      cityFa: 'تهران',
      lat: parsedLat,
      lng: parsedLng,
      address: formData.address,
      addressFa: formData.address,
      phone: formData.phone,
      hours: formData.hours,
      hoursFa: formData.hours,
      neighborhood: formData.neighborhood,
      neighborhoodFa: formData.neighborhood,
      posterImage: formData.posterUrl,
      posterSmall: formData.posterUrl,
      activeExhibition: formData.title ? exhibition : null,
      sourceUrl: editingGallery?.sourceUrl || '#'
    };

    try {
      if (isCreatingNew) {
        const res = await fetch('/api/admin/galleries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        const created = await res.json();
        if (res.ok) {
          const updated = [created, ...galleries];
          onGalleriesUpdated(updated);
          setIsCreatingNew(false);
          setStatusMessage({ text: `نگارخانه "${created.name}" با موفقیت اضافه شد` });
        } else {
          setStatusMessage({ text: created.error || 'خطا در ثبت نگارخانه', isError: true });
        }
      } else if (editingGallery) {
        const res = await fetch(`/api/admin/galleries/${editingGallery.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        const updatedItem = await res.json();
        if (res.ok) {
          const updated = galleries.map((g) => (g.id === editingGallery.id ? updatedItem : g));
          onGalleriesUpdated(updated);
          setEditingGallery(null);
          setStatusMessage({ text: `تغییرات نگارخانه "${updatedItem.name}" با موفقیت ذخیره شد` });
        } else {
          setStatusMessage({ text: updatedItem.error || 'خطا در ویرایش نگارخانه', isError: true });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: 'خطا در ذخیره داده‌ها: ' + err.message, isError: true });
    }
  };

  // Delete Gallery
  const handleDelete = async (id: number, name: string) => {
    if (!authToken) return;
    if (!window.confirm(`آیا از حذف نگارخانه "${name}" اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`/api/admin/galleries/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        const updated = galleries.filter((g) => g.id !== id);
        onGalleriesUpdated(updated);
        setStatusMessage({ text: `نگارخانه "${name}" حذف شد` });
      } else {
        setStatusMessage({ text: data.error || 'خطا در حذف نگارخانه', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: 'خطا در ارتباط با سرور: ' + err.message, isError: true });
    }
  };

  // Early return if modal is not open (STRICTLY placed after all React hooks)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="clay-card clay-base w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800 transition-all my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl clay-button clay-orange text-white flex items-center justify-center">
              <Lock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                سامانه مدیریت نمایشگاه‌ها و گالری‌ها
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                ویرایش مستقیم پایگاه داده محلی بدون نیاز به بیلد یا کدنویسی مجدد
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authToken && (
              <button
                onClick={handleLogout}
                title="خروج از حساب مدیریت"
                className="clay-button clay-base px-2.5 py-1.5 text-xs text-stone-600 dark:text-stone-300 flex items-center gap-1.5 rounded-xl cursor-pointer hover:text-red-500"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            )}
            <button
              onClick={onClose}
              title="بستن پنجره"
              className="clay-button clay-base w-8 h-8 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 rounded-xl cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Status notification banner */}
        {statusMessage && (
          <div
            className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 ${
              statusMessage.isError
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-b border-rose-200 dark:border-rose-900'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-900'
            }`}
          >
            {statusMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 text-sm text-stone-800 dark:text-stone-200">
          {!adminEnabled ? (
            /* Mirror Read-Only Notice */
            <div className="max-w-md mx-auto py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl clay-card clay-base flex items-center justify-center text-amber-500">
                <Lock className="w-8 h-8 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                پنل مدیریت روی سرور آینه (Mirror) غیرفعال است
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed text-justify">
                این سرور (<span className="font-ubuntu font-bold">artgasht.ir</span>) به عنوان <strong>سرور آینه (Mirror)</strong> پیکربندی شده و داده‌های آن به صورت خودکار هر ۵ دقیقه از سرور اصلی آلمان همگام‌سازی می‌شوند. به منظور جلوگیری از تداخل داده‌ها، ویرایش تنها بر روی سرور اصلی آلمان مجاز است.
              </p>
              <div className="clay-card clay-base p-3.5 rounded-2xl text-right text-xs space-y-1.5 border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>دسترسی اضطراری در شرایط قطعی اینترنت (STANDALONE):</span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-400">
                  اگر به دلیل قطعی اینترنت بین‌الملل ارتباط با سرور آلمان قطع است، در ترمینال سرور ایران دستور زیر را اجرا کنید تا پنل مدیریت بلافاصله فعال شود:
                </p>
                <pre className="text-[11px] bg-stone-900 text-stone-100 p-2 rounded-lg">sudo /opt/artgasht/scripts/mirror-mode.sh standalone</pre>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="clay-button clay-base px-6 py-2 rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          ) : !authToken ? (
            /* Login Screen */
            <div className="max-w-md mx-auto py-10">
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl clay-button clay-softblue text-[#10335e] dark:text-[#cde0f3] flex items-center justify-center">
                  <Lock className="w-7 h-7 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-1">ورود به پنل مدیریت سرور</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  رمز عبور مدیریت تنظیم‌شده در متغیر محیطی <code className="font-ubuntu text-[11px] bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5 rounded">ADMIN_PASSWORD</code> را وارد کنید:
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    رمز عبور مدیریت:
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز عبور..."
                    autoFocus
                    required
                    className="clay-input w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {loginError && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="clay-button clay-orange text-white w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>ورود به سامانه</span>
                </button>
              </form>
            </div>
          ) : editingGallery || isCreatingNew ? (
            /* Create / Edit Form */
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span>{isCreatingNew ? 'افزودن نمایشگاه و نگارخانه جدید' : `ویرایش نگارخانه: ${formData.name}`}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGallery(null);
                    setIsCreatingNew(false);
                  }}
                  className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold cursor-pointer"
                >
                  انصراف و بازگشت
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gallery Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام نگارخانه: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: گالری اثر"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                {/* Exhibition Title */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    عنوان نمایشگاه جاری:
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: بازتاب سکوت"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                {/* Artist Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    نام هنرمند / کیوریتور:
                  </label>
                  <input
                    type="text"
                    value={formData.artist}
                    onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                    placeholder="مثال: سهراب سپهری"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                {/* Medium (ClayDropdown mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    مدیوم / تکنیک اثر:
                  </label>
                  <ClayDropdown
                    value={formData.medium}
                    options={MEDIUM_OPTIONS}
                    onChange={(val) => setFormData({ ...formData, medium: val })}
                    className="w-full"
                  />
                </div>

                {/* Opening Date */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تاریخ افتتاحیه:
                  </label>
                  <input
                    type="text"
                    value={formData.openingDate}
                    onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                    placeholder="مثال: جمعه ۱۵ آبان ۱۴۰۵"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                {/* Closing Date */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تاریخ اختتامیه:
                  </label>
                  <input
                    type="text"
                    value={formData.closingDate}
                    onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                    placeholder="مثال: دوشنبه ۲۵ آبان ۱۴۰۵"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                {/* Neighborhood (ClayDropdown mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    محله تهران (۷ منطقه رسمی):
                  </label>
                  <ClayDropdown
                    value={formData.neighborhood}
                    options={NEIGHBORHOOD_OPTIONS}
                    onChange={(val) => setFormData({ ...formData, neighborhood: val })}
                    className="w-full"
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تلفن تماس نگارخانه:
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="مثال: 02188821424"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-ubuntu"
                  />
                </div>

                {/* Visiting Hours */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    ساعات بازدید:
                  </label>
                  <input
                    type="text"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    placeholder="مثال: ۱۶ الی ۲۰"
                    className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                {/* Lat & Lng */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      عرض جغرافیایی (Lat):
                    </label>
                    <input
                      type="text"
                      value={formData.lat}
                      onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                      placeholder="35.72"
                      className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-ubuntu"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      طول جغرافیایی (Lng):
                    </label>
                    <input
                      type="text"
                      value={formData.lng}
                      onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                      placeholder="51.41"
                      className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-ubuntu"
                    />
                  </div>
                </div>
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  نشانی کامل نگارخانه:
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="تهران، خیابان کریمخان زند، خیابان خردمند جنوبی..."
                  className="clay-input w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 resize-none"
                />
              </div>

              {/* Poster Image File Upload */}
              <div className="clay-card clay-base p-4 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-500" />
                    <span>پوستر نمایشگاه (آپلود فایل به سرور محلی):</span>
                  </label>
                  {isUploading && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      در حال ذخیره روی سرور...
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-900">
                    {formData.posterUrl ? (
                      <img src={formData.posterUrl} alt="پوستر" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-stone-400" />
                    )}
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="block w-full text-xs text-stone-500 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.posterUrl}
                      onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                      placeholder="یا آدرس مستقیم تصویر (مثلاً /uploads/poster_123.jpg)"
                      className="clay-input w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-ubuntu"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingGallery(null);
                    setIsCreatingNew(false);
                  }}
                  className="clay-button clay-base px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="clay-button clay-orange text-white px-6 py-2 text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all shadow-md"
                >
                  ذخیره تغییرات در دیتابیس سرور
                </button>
              </div>
            </form>
          ) : (
            /* Gallery & Exhibition List Manager */
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجو در نگارخانه‌ها یا هنرمندان..."
                    className="clay-input w-full pr-9 pl-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className="text-xs text-stone-500 font-medium">
                    مجموع گالری‌ها: {toPersianDigits(galleries.length)}
                  </span>
                  <button
                    onClick={startCreate}
                    className="clay-button clay-orange text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>افزودن نمایشگاه جدید</span>
                  </button>
                </div>
              </div>

              {/* Galleries Table / List */}
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {filteredGalleries.map((gallery) => {
                  const ex = gallery.activeExhibition;
                  return (
                    <div
                      key={gallery.id}
                      className="clay-card clay-base p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-stone-200/60 dark:border-stone-800/60 hover:border-amber-400/50 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-200 dark:bg-stone-800 flex items-center justify-center">
                          {ex?.poster || gallery.posterImage ? (
                            <img
                              src={ex?.poster || gallery.posterImage}
                              alt={gallery.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-6 h-6 text-stone-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                              {gallery.name}
                            </h4>
                            {ex?.title && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                {ex.medium || 'نمایشگاه فعال'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                            {ex?.title ? `«${ex.title}» اثر ${ex.artist || 'هنرمند'}` : 'بدون نمایشگاه جاری ثبت‌شده'}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-1">
                            <span>{gallery.neighborhoodFa || gallery.neighborhood || 'تهران'}</span>
                            {ex?.openingDate && <span>· افتتاحیه: {toPersianDigits(ex.openingDate)}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => startEdit(gallery)}
                          title="ویرایش"
                          className="clay-button clay-base px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#3D5B99] dark:text-[#A3C2E4] flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ویرایش</span>
                        </button>
                        <button
                          onClick={() => handleDelete(gallery.id, gallery.name)}
                          title="حذف"
                          className="clay-button clay-base px-2 py-1.5 rounded-xl text-xs text-rose-500 hover:text-rose-700 flex items-center cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
