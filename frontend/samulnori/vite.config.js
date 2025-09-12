import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // 이 부분이 중요합니다!
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          framer: ['framer-motion'],
        },
      },
    },
  },
  server: {
    historyApiFallback: true,
    port: 3000,
    host: true,
  },
  css: {
    postcss: './postcss.config.js',
  },
  optimizeDeps: {
    include: ['tailwindcss'],
  },
})


