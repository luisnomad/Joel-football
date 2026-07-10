import { access, mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, 'source-assets', 'sound');
const destinationRoot = join(projectRoot, 'public', 'assets', 'sound');
const tracks = Array.from({ length: 6 }, (_, index) => `track${index + 1}.mp3`);

const run = (command, args) => new Promise((resolvePromise, reject) => {
  const child = spawn(command, args, { stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code) => {
    if (code === 0) resolvePromise();
    else reject(new Error(`${command} exited with status ${code}`));
  });
});

await mkdir(destinationRoot, { recursive: true });

for (const filename of tracks) {
  const source = join(sourceRoot, filename);
  const destination = join(destinationRoot, filename);
  const temporary = `${destination}.tmp.mp3`;
  await access(source);
  await rm(temporary, { force: true });
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', source,
    '-map', '0:a:0',
    '-vn',
    '-map_metadata', '-1',
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    temporary,
  ]);
  await rename(temporary, destination);
  process.stdout.write(`Optimized ${filename}\n`);
}
