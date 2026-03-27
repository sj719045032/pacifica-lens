import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/elfa-api': {
        target: 'https://api.elfa.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elfa-api/, ''),
      },
    },
  },
})
