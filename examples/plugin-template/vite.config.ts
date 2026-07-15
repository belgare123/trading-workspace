import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: './index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', /^\.\.\/\.\.\/workspace-ui\/src\/runtime\//],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})
