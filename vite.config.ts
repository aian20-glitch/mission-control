import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' = relative paths, so the build works on any host or repo name
// (GitHub Pages, itch.io, a USB stick).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
