import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Register PWA Service Worker with no-cache check & auto-refresh on new version
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        console.log('آرت‌گشت: PWA Service Worker فعال شد', reg.scope);
        // Force an immediate update check over network
        reg.update().catch(() => {});

        // Re-check for new versions when user returns to the tab/app
        window.addEventListener('focus', () => {
          reg.update().catch(() => {});
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration warning:', err);
      });

    // When the service worker updates and takes control, auto-reload once to display latest version
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

if (typeof window !== 'undefined') {
  (window as any).__artgasht_mounted = true;
  try {
    sessionStorage.removeItem('__artgasht_auto_reloaded');
  } catch (e) {}
}
