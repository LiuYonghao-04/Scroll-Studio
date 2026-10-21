import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'public/export-runtime',
    emptyOutDir: true,
    lib: {
      entry: 'src/export/runtime.ts',
      name: 'ScrollStudioPage',
      formats: ['iife'],
      fileName: () => 'runtime.js',
    },
    sourcemap: false,
  },
})
