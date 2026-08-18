import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const rootDir = import.meta.dirname;
  const backendUrl = process.env.VITE_BACKEND_URL || 'https://localhost:5026';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
        '@src': path.resolve(rootDir, 'src'),
        '@components': path.resolve(rootDir, 'src/components'),
        '@utils': path.resolve(rootDir, 'src/utils'),
        '@i18n': path.resolve(rootDir, 'src/i18n'),
        '@services': path.resolve(rootDir, 'src/services'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/openapi': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/scalar': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
