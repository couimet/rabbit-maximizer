import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // The Express production mount serves this directory, which sits outside the
    // Vite root, so Vite leaves it in place unless emptyOutDir is explicit.
    emptyOutDir: true,
    outDir: '../dist/dashboard/dist',
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
