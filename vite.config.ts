import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // '/' porque no EasyPanel o app roda na raiz do domínio.
  // Com './' as rotas aninhadas (ex.: /login) quebram ao carregar os assets.
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Funil de Vendas',
        short_name: 'Funil',
        description: 'Gestao diaria do funil de vendas',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#080808',
        theme_color: '#080808',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // env.js e chamadas ao Supabase nunca podem vir do cache
        navigateFallbackDenylist: [/^\/env\.js$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/env.js',
            handler: 'NetworkOnly'
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
})
