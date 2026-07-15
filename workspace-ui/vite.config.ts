import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:9121',
      '/ws': {
        target: 'ws://127.0.0.1:9121',
        ws: true,
      },
    },
  },
})
