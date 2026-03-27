import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

window.__MONICA_BUILD__ = __MONICA_BUILD__;

// One-time cleanup of stale SWs/caches from opticon -> monica rename (2026-03-26)
if (!localStorage.getItem('monica_sw_cleared')) {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  localStorage.setItem('monica_sw_cleared', '1');
}

if (new URLSearchParams(window.location.search).has('clear-sw')) {
  localStorage.removeItem('monica_sw_cleared');
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
