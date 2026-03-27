import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

const MONICA_BUILD = '2026-03-27';

if (import.meta.env.DEV && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

if (new URLSearchParams(window.location.search).has('clear-sw')) {
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
