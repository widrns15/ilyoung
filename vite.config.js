import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '두리 — 둘이 쓰는 캘린더 가계부',
        short_name: '두리',
        description: '일정과 가계부를 둘이 함께, 하나의 캘린더에서',
        lang: 'ko',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#F5F6F8',
        theme_color: '#F5F6F8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html'
      }
    })
  ]
})
