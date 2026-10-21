import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'
import { readFileSync } from 'node:fs'
import { getStatementsPayload } from './server/api/statements-data.js'

const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

const PROD_API = 'https://epiphany.jaybulb.com';

function localStatementsPlugin() {
  return {
    name: 'local-statements-api',
    configureServer(server) {
      server.middlewares.use('/api/statements', async (req, res, next) => {
        const url = new URL(req.url || '/api/statements', 'http://127.0.0.1');
        if (url.searchParams.get('action') !== 'scan-local') return next();
        if ((req.method || 'GET').toUpperCase() !== 'GET') return next();

        try {
          const filename = url.searchParams.get('filename') || undefined;
          const statementsDir = url.searchParams.get('dir') || undefined;
          const payload = await getStatementsPayload({ filename, statementsDir });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        } catch {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ exists: false, statements: [] }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    '__EPIPHANY_BUILD__': JSON.stringify(new Date().toISOString()),
    '__APP_VERSION__': JSON.stringify(APP_VERSION),
  },
  build: {
    rollupOptions: {
      output: {
        // Maps and charts in their own chunks so the shell paints before they download.
        manualChunks: {
          maplibre: ['maplibre-gl', 'supercluster'],
          charts: ['recharts', 'lightweight-charts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    localStatementsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        cacheId: 'epiphany',
        // Offline: the map keeps its last tiles and pins when the network drops.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9.-]*cartocdn\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tiles', expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 3600 } },
          },
          {
            urlPattern: /\/api\/(flights|traffic|incidents|earthquakes|weather-alerts|wildfires|aqi|crime|local-events|stocks-free|commodities|crypto)\b/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 6, expiration: { maxEntries: 100, maxAgeSeconds: 24 * 3600 } },
          },
        ],
      },
      manifest: {
        name: 'Epiphany',
        short_name: 'Epiphany',
        description: 'Financial terminal',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api/markets': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => '/markets?closed=false&limit=50&order=volume24hr&ascending=false'
      },
      '/api/stocks-free': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/stocks': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/commodities': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/latest': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api/history': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
      '/api': {
        target: PROD_API,
        changeOrigin: true,
        secure: true,
      },
    }
  }
})
