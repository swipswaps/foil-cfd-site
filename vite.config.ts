import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: '/foil-cfd-site/',
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
