import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { precacheManifestPlugin } from './scripts/precache-manifest.mjs';

// Phaser build flags. Phaser tests them as `typeof FLAG` and its own webpack
// build replaces that whole expression (esbuild's `define` cannot), so the
// same substitution runs as a transform over Phaser's sources: in Rollup for
// production and in esbuild's dependency pre-bundling for the dev server.
// The game uses the Canvas renderer, Matter physics and its own HTML audio
// (services/ArcadeAudio.js), so WebGL, the 3D / Instant Games plugins and
// Phaser's sound manager are compiled out. See src/vendor/phaserCustom.js.
const PHASER_FLAGS = Object.freeze({
  CANVAS_RENDERER: true,
  WEBGL_RENDERER: false,
  WEBGL_DEBUG: false,
  EXPERIMENTAL: false,
  PLUGIN_3D: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
  FEATURE_SOUND: false,
});
const PHASER_FLAG_PATTERN = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
const PHASER_SOURCE = /[\\/]node_modules[\\/]phaser[\\/]src[\\/].*\.js$/;
const applyPhaserFlags = (code) => code.replace(PHASER_FLAG_PATTERN, (_, flag) => String(PHASER_FLAGS[flag]));

// `phaser` resolves to Phaser's own source entry, whose contents are swapped
// for the trimmed entry. Keeping the engine behind that single module (rather
// than aliasing to a project file that deep-imports phaser/src/*) keeps it one
// pre-bundled dependency in dev instead of ~70 separate modules.
const phaserSourceEntry = fileURLToPath(new URL('./node_modules/phaser/src/phaser.js', import.meta.url));
const phaserCustomEntry = fileURLToPath(new URL('./src/vendor/phaserCustom.js', import.meta.url));
const phaserGameObjects = fileURLToPath(new URL('./src/vendor/phaserGameObjects.js', import.meta.url));
const isPhaserSourceEntry = (id) => id.split('?')[0] === phaserSourceEntry;
// The swapped-in code is resolved from Phaser's directory, so its one
// project-relative import is made absolute.
const loadPhaserCustomEntry = async () => (await readFile(phaserCustomEntry, 'utf8'))
  .replace("'./phaserGameObjects.js'", JSON.stringify(phaserGameObjects));

const phaserCustomPlugin = {
  name: 'joel-football:phaser-custom',
  enforce: 'pre',
  load(id) {
    return isPhaserSourceEntry(id) ? loadPhaserCustomEntry() : null;
  },
  transform(code, id) {
    if (!PHASER_SOURCE.test(id.split('?')[0]) || !code.includes('typeof ')) return null;
    return { code: applyPhaserFlags(code), map: null };
  },
};

const phaserCustomEsbuildPlugin = {
  name: 'joel-football:phaser-custom',
  setup(build) {
    build.onLoad({ filter: PHASER_SOURCE }, async ({ path }) => ({
      contents: applyPhaserFlags(isPhaserSourceEntry(path) ? await loadPhaserCustomEntry() : await readFile(path, 'utf8')),
      loader: 'js',
    }));
  },
};

export default defineConfig({
  // Keep the game portable when copied below another site's public directory.
  base: './',
  plugins: [phaserCustomPlugin, precacheManifestPlugin()],
  resolve: {
    // Only the bare specifier; deep phaser/src/* imports resolve normally.
    alias: [{ find: /^phaser$/, replacement: phaserSourceEntry }],
  },
  optimizeDeps: {
    esbuildOptions: { plugins: [phaserCustomEsbuildPlugin] },
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser changes far less often than game code. A stable vendor chunk
        // lets repeat visitors retain the engine when gameplay code changes.
        manualChunks: (id) => (
          id.includes('/node_modules/phaser/') || id.includes('/src/vendor/phaser')
            ? 'phaser'
            : undefined
        ),
      },
    },
  },
});
