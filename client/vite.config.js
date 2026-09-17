import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api → the Express server so the browser only ever
// talks to same-origin URLs. In production, serve the built client statically
// and point VITE_API_BASE at the deployed API (or reverse-proxy /api there).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
