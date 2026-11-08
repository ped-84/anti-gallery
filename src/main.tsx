import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Register PWA Service Worker for offline capabilities & Android install prompts
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('آرت‌گشت: PWA Service Worker فعال شد', reg.scope);
        // Promptly check for SW updates
        reg.update();
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration warning:', err);
      });
  });

  // When new SW activates, silently refresh to show latest build without stale cache
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
