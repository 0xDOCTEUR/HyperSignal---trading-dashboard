/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false,
    /** Ouvre le navigateur dès que le serveur est prêt */
    open: true,
    proxy: {
      // Évite les blocages CORS du navigateur vers l'API Hyperliquid en dev
      '/hyperliquid-info': {
        target: 'https://api.hyperliquid.xyz',
        changeOrigin: true,
        rewrite: () => '/info',
      },
    },
  },
})
