import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const websiteRoot = resolve(
  process.env.JOEL_FOOTBALL_WEBSITE_DIR
    ?? process.env.SKYHEAD_WEBSITE_DIR
    ?? join(projectRoot, '..', 'luisnomad.com'),
);
const source = join(projectRoot, 'dist');
const destination = join(websiteRoot, 'public', 'games', 'joel-football');
const legacyDestination = join(websiteRoot, 'public', 'games', 'head-soccer');

const requirePath = async (path, message) => {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`${message}: ${path}`);
  }
};

await requirePath(join(source, 'index.html'), 'Build output is missing; run npm run build first');
await requirePath(join(websiteRoot, 'public'), 'Website public directory was not found');
await requirePath(join(websiteRoot, 'package.json'), 'Website package.json was not found');

const websitePackage = JSON.parse(await readFile(join(websiteRoot, 'package.json'), 'utf8'));
if (websitePackage.name !== 'landing') {
  throw new Error(`Refusing to publish into an unexpected project: ${websiteRoot}`);
}

await rm(destination, { recursive: true, force: true });
await rm(legacyDestination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
await mkdir(legacyDestination, { recursive: true });
await writeFile(join(legacyDestination, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0; url=../joel-football/" />
    <link rel="canonical" href="../joel-football/" />
    <title>Joel Football</title>
  </head>
  <body>
    <p><a href="../joel-football/">Play Joel Football</a></p>
    <script>location.replace('../joel-football/' + location.search + location.hash);</script>
  </body>
</html>
`);

process.stdout.write(`Published Joel Football to ${destination}\n`);
process.stdout.write(`Preserved the previous URL with a redirect at ${legacyDestination}\n`);
process.stdout.write('Commit that generated folder in the luisnomad.com repository to deploy it with Netlify.\n');
