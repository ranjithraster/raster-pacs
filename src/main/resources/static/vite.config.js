import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {
          cornerstone: [
            '@cornerstonejs/core',
            '@cornerstonejs/tools',
            '@cornerstonejs/dicom-image-loader'
          ],
          vtk: ['@kitware/vtk.js'],
          dcmjs: ['dcmjs']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      '@cornerstonejs/core',
      '@cornerstonejs/tools',
      '@cornerstonejs/dicom-image-loader',
      'dicom-parser',
      'gl-matrix'
    ],
    exclude: ['@kitware/vtk.js']
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/dicomweb': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/wado': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },
  define: {
    'process.env': {}
  }
});

