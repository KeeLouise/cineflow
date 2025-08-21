import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // allows use of  '@' for src imports - KR 21/08/2025
    },
  },
  server: {
    proxy: {
      "/api": {               
        target: "http://127.0.0.1:8000", // Django backend - KR 19/08/2025
        changeOrigin: true,
      },
    },
  },
});