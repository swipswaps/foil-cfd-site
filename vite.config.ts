import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/foil-cfd-site/',
  define: { global: 'globalThis' },
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        hydro: resolve(__dirname, 'hydro.html'),
      },
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three-vendor';
          if (id.includes('node_modules/@react-three/')) return 'r3f-vendor';
          return undefined;
        },
      },
    },
  },
});
