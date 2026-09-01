import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'CropAI Maharashtra', short_name: 'CropAI', description: 'Secure crop disease and pest decision support',
      theme_color: '#264830', background_color: '#f7f4ee', display: 'standalone', start_url: '/', scope: '/',
      icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    workbox: {
      navigateFallback: '/index.html',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json,txt}'],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    },
  })],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
          charts: ['recharts'],
        },
      },
    },
  },
})
