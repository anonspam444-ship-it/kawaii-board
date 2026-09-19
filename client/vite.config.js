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
    watch: {
      // This repo lives on the Windows drive (/mnt/c/...) while the dev server
      // runs under WSL, and inotify events don't cross that boundary
      // reliably — edits were being missed, so the browser kept getting the
      // previous version of a file even on a hard reload. Polling is a little
      // more CPU but makes hot reload actually dependable here.
      usePolling: true,
      interval: 300,
    },
  },
})
