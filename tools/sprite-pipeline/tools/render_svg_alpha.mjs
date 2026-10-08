/*
 * Rasterises SVG files to transparent PNGs at an exact size with Chromium.
 *   node render_svg_alpha.mjs OUT_DIR file.svg:WIDTHxHEIGHT [...]
 * Used to measure where existing vector art sits inside its load box, so a
 * replacement raster can occupy exactly the same box (collision alignment).
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { chromium } from 'playwright';

const [outDir, ...specs] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
try {
  for (const spec of specs) {
    const [file, size] = spec.split(':');
    const [width, height] = size.split('x').map(Number);
    const page = await browser.newPage({ viewport: { width, height } });
    const data = readFileSync(file).toString('base64');
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <img src="data:image/svg+xml;base64,${data}" style="display:block;width:${width}px;height:${height}px"></body></html>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${outDir}/${basename(file, '.svg')}.png`, omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
