/**
 * Optimizes image URLs for Core Web Vitals and PageSpeed:
 * 1. On live production servers (artgasht.com / artgasht.ir), routes external galleryinfo.ir images
 *    through our high-speed cached proxy (/api/image-proxy?url=...) which returns immutable 30-day Cache-Control.
 * 2. On GitHub Pages (static), falls back cleanly to direct HTTPS galleryinfo.ir URL.
 */
export function toOptimizedImageUrl(url?: string | null): string {
  if (!url) return '';
  if (typeof window === 'undefined') return url;

  // If already proxied or a relative/local URL, return as-is
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('data:')) {
    return url;
  }

  // Check if we are on a custom server (artgasht.com or artgasht.ir) that supports the proxy
  const hostname = window.location.hostname;
  const isCustomServer = hostname === 'artgasht.com' || hostname.endsWith('.artgasht.com') ||
                         hostname === 'artgasht.ir' || hostname.endsWith('.artgasht.ir') ||
                         hostname === 'localhost' || hostname === '127.0.0.1';

  const shouldProxy =
    url.includes('galleryinfo.ir/') ||
    url.includes('darz-public.s3.ir-thr-at1.arvanstorage.ir/') ||
    url.includes('darz.art/pub/');

  if (isCustomServer && shouldProxy) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}
