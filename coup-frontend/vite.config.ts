import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      // REST endpoints
      '/api': {
        target: process.env.VITE_API_URL || "https://coup-js-p4xt-git-master-camimcls-projects.vercel.app",
        changeOrigin: true,
      },
      // Socket.IO (WebSocket) endpoint
      '/socket.io': {
        target: process.env.VITE_API_URL || "https://coup-js-p4xt-git-master-camimcls-projects.vercel.app",
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
