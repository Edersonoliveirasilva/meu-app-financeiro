import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Nome exato da pasta/repositório
base: '/'
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NexusFin',
        short_name: 'Nexus',
        description: 'Controle Financeiro Seguro',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/5501/5501375.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})