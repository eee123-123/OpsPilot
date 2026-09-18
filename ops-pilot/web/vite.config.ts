import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/actuator': 'http://localhost:8080',
      '/api': 'http://localhost:8080',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
