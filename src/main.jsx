import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { migrateStorageKeys } from './utils/migrateStorageKey.js'

// A deploy replaces the hashed chunks, so a tab opened on the old build fails to lazy-load a panel
// ("Failed to fetch dynamically imported module") and showed "Something went wrong". Reload once
// to pick up the new build; the timestamp guard stops a loop if the chunk is really missing.
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem('epiphany_chunk_reload')) || 0; } catch { /* private mode */ }
  if (Date.now() - last < 30000) return;
  try { sessionStorage.setItem('epiphany_chunk_reload', String(Date.now())); } catch { /* private mode */ }
  event.preventDefault();
  window.location.reload();
});

window.__EPIPHANY_BUILD__ = __EPIPHANY_BUILD__;

migrateStorageKeys();

// One-time cleanup of stale SWs/caches from opticon -> epiphany rename
if (!localStorage.getItem('epiphany_sw_cleared')) {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  localStorage.setItem('epiphany_sw_cleared', '1');
}

if (new URLSearchParams(window.location.search).has('clear-sw')) {
  localStorage.removeItem('epiphany_sw_cleared');
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  window.location.replace('/');
}

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Missing #root element in index.html');
  }

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  console.error('Failed to render app:', err);

  const wrapper = document.createElement('div');
  wrapper.style.padding = '40px';
  wrapper.style.background = '#1a1a1a';
  wrapper.style.color = '#ff6b6b';
  wrapper.style.fontFamily = 'monospace';

  const title = document.createElement('h1');
  title.textContent = 'Render Error';

  const details = document.createElement('pre');
  details.textContent = err?.stack || err?.message || 'Unknown render error';

  wrapper.append(title, details);
  document.body.replaceChildren(wrapper);
}
