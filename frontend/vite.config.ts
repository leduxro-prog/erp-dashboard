import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const rawApiUrl = process.env.VITE_API_URL || '';
const proxyTargetFromApiUrl = rawApiUrl.startsWith('http')
  ? rawApiUrl.replace(/\/api\/v1\/?$/, '')
  : '';
const proxyTarget =
  process.env.VITE_API_PROXY_TARGET || proxyTargetFromApiUrl || 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    // alias: handled by tsconfigPaths
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',
    minify: 'terser',
    target: 'es2020',
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false,
    },
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }

          if (id.includes('/node_modules/@tanstack/react-query/')) {
            return 'vendor-query';
          }

          if (id.includes('/node_modules/zustand/')) {
            return 'vendor-zustand';
          }

          return undefined;
        },
      },
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
});
