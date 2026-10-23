import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),],

  define: {
    "import.meta.env.VITE_ASR_WS_URL": JSON.stringify("ws://localhost:8001/ws"),
  },

  build: {
    cssMinify: "esbuild",
  },

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: false,
      },
    },
  },
});
