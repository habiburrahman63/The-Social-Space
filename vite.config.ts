import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      // Proxy API calls to the Backend during development so the app
      // also works if VITE_API_URL is left unset (same-origin requests).
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      // Split the rarely-changing vendor code (React, the router and the icon
      // set) into its own hashed chunk, so app/route chunks can be updated on
      // redeploy without making returning users re-download React itself.
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
