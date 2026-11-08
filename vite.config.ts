import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { landing: 'landing.html', app: 'app.html' },
      output: { manualChunks: id => id.includes('three') ? 'three' : id.includes('firebase') ? 'firebase' : undefined },
    },
  },
});
