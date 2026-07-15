import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the game portable when copied below another site's public directory.
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Phaser changes far less often than game code. A stable vendor chunk
        // lets repeat visitors retain the engine when gameplay code changes.
        manualChunks: (id) => (id.includes('/node_modules/phaser/') ? 'phaser' : undefined),
      },
    },
  },
});
