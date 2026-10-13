/*
 * Offline precache manifest for the service worker (public/sw.js).
 *
 * After `vite build`, the plugin below lists what the game needs offline and
 * writes it into dist/sw.js between the PRECACHE markers:
 *   - core:  the app shell and every emitted JS/CSS bundle (cached at install,
 *            atomically, so one online visit is enough to boot offline);
 *   - media: every public asset the built code or index.html refers to
 *            (arenas, sprites, mini-game art, sounds), fetched in the background
 *            after activation so installation stays quick;
 *   - music: the menu/match music tracks (largest files), skipped on Data Saver.
 * A public asset counts as referenced when its path or file name appears in the
 * built code, or matches a template literal such as `power-icon-${id}.png`.
 * Old sprite versions and unused art that still ship in public/ are left out.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRECACHE_START = '/* precache-manifest */';
export const PRECACHE_END = '/* /precache-manifest */';
const PUBLIC_EXTENSIONS = /\.(png|webp|jpe?g|svg|mp3|ogg|m4a|json|webmanifest)$/i;
const BUNDLE_EXTENSIONS = /\.(js|css)$/i;
const MUSIC = /^assets\/sound\/track[^/]*\.mp3$/i;
const NEVER_PRECACHE = new Set(['sw.js']);

const listFiles = async (directory, prefix = '') => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(path.join(directory, entry.name), relative) : [relative];
  }));
  return files.flat().sort();
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Template literals in built code that name an asset file, e.g.
 * `power-icon-${n}.png` -> /(^|\/)power-icon-[^/]*\.png$/. A template must start
 * with at least three literal characters so `${base}assets/${file}` (which
 * could match anything) is ignored.
 */
export const templateAssetPatterns = (code) => {
  const patterns = [];
  for (const [, body] of code.matchAll(/`([^`]{0,160})`/g)) {
    if (!body.includes('${')) continue;
    const parts = body.split(/\$\{[^}]*\}/);
    const [first] = parts;
    const last = parts.at(-1);
    if (first.length < 3 || first.includes('/') || !PUBLIC_EXTENSIONS.test(last)) continue;
    patterns.push(new RegExp(`(^|/)${parts.map(escapeRegExp).join('[^/]*')}$`));
  }
  return patterns;
};

export const isReferenced = (publicPath, code, patterns) => {
  const withinAssets = publicPath.startsWith('assets/') ? publicPath.slice('assets/'.length) : publicPath;
  return code.includes(withinAssets)
    || code.includes(path.posix.basename(publicPath))
    || patterns.some((pattern) => pattern.test(publicPath));
};

/** Builds the manifest from a finished build directory and the public directory. */
export const buildPrecacheManifest = async ({ outDir, publicDir }) => {
  const distFiles = await listFiles(outDir);
  const publicFiles = new Set(await listFiles(publicDir));
  const bundles = distFiles.filter((file) => !publicFiles.has(file) && BUNDLE_EXTENSIONS.test(file));
  const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const code = [html, ...await Promise.all(bundles.map((file) => readFile(path.join(outDir, file), 'utf8')))].join('\n');
  const patterns = templateAssetPatterns(code);
  const referenced = [...publicFiles]
    .filter((file) => !NEVER_PRECACHE.has(file) && PUBLIC_EXTENSIONS.test(file) && file !== 'manifest.webmanifest')
    .filter((file) => isReferenced(file, code, patterns));

  const core = ['./', 'manifest.webmanifest', ...bundles];
  const media = referenced.filter((file) => !MUSIC.test(file));
  const music = referenced.filter((file) => MUSIC.test(file));
  const sizeOf = async (file) => (await stat(path.join(outDir, file === './' ? 'index.html' : file))).size;
  const sum = async (files) => (await Promise.all(files.map(sizeOf))).reduce((total, size) => total + size, 0);
  const bytes = { core: await sum(core), media: await sum(media), music: await sum(music) };
  const hash = createHash('sha256');
  for (const file of [...core, ...media, ...music]) {
    hash.update(file);
    hash.update(await readFile(path.join(outDir, file === './' ? 'index.html' : file)));
  }
  return { build: hash.digest('hex').slice(0, 12), core, media, music, bytes };
};

export const injectPrecacheManifest = (source, manifest) => {
  const start = source.indexOf(PRECACHE_START);
  const end = source.indexOf(PRECACHE_END);
  if (start < 0 || end < start) throw new Error('sw.js is missing the precache-manifest markers');
  const { build, core, media, music } = manifest;
  return `${source.slice(0, start + PRECACHE_START.length)} ${JSON.stringify({ build, core, media, music })} ${source.slice(end)}`;
};

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** Vite plugin: writes the manifest into dist/sw.js once the build is on disk. */
export const precacheManifestPlugin = () => {
  let config;
  return {
    name: 'joel-football:precache-manifest',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async writeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const workerPath = path.join(outDir, 'sw.js');
      const manifest = await buildPrecacheManifest({ outDir, publicDir: config.publicDir });
      await writeFile(workerPath, injectPrecacheManifest(await readFile(workerPath, 'utf8'), manifest));
      const total = manifest.bytes.core + manifest.bytes.media + manifest.bytes.music;
      config.logger.info(`offline precache ${manifest.build}: core ${manifest.core.length} files ${megabytes(manifest.bytes.core)}, `
        + `media ${manifest.media.length} files ${megabytes(manifest.bytes.media)}, music ${manifest.music.length} files ${megabytes(manifest.bytes.music)}, `
        + `total ${megabytes(total)}`);
    },
  };
};
