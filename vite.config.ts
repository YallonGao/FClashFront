import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Relative base so the same build works at a domain root, under a path, or
// from the FastAPI catch-all that serves it next to the API.
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    // Bind every interface so a phone on the same network can open the console.
    host: true,
    port: 5180,
    proxy: {
      '/api': 'http://127.0.0.1:8780',
    },
  },
})
