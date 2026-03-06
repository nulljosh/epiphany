import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const PROD_API = 'https://opticon.heyitsmejosh.com';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Opticon',
        short_name: 'Opticon',
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
