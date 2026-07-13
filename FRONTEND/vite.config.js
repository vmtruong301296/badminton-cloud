import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://badminton-cloud.truong301296.workers.dev',
        changeOrigin: true,
      },
    },
  },
})