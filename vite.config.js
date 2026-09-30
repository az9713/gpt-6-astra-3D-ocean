import { defineConfig } from 'vite';
export default defineConfig({
  // Relative assets support both / locally and /gpt-6-astra-3D-ocean/ on Pages.
  base: './',
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { rollupOptions: { input: ['index.html', 'journey/index.html', 'learn/index.html'], output: { manualChunks: { three: ['three'] } } } },
});
