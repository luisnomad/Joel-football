import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copies the production build into the sibling ARKD BOX site repository, at
// public/builds/joel-football/ (served at https://arkdbox.com/builds/joel-football/;
// the playable page is https://arkdbox.com/play/joel-football/).
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const websiteRoot = resolve(
  process.env.JOEL_FOOTBALL_WEBSITE_DIR
    ?? process.env.SKYHEAD_WEBSITE_DIR
    ?? join(projectRoot, '..', 'arkdbox'),
);
const source = join(projectRoot, 'dist');
const destination = join(websiteRoot, 'public', 'builds', 'joel-football');

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
if (websitePackage.name !== 'arkdbox') {
  throw new Error(`Refusing to publish into an unexpected project: ${websiteRoot}`);
}

await rm(destination, { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });

process.stdout.write(`Published Joel Football to ${destination}\n`);
process.stdout.write('Commit that generated folder in the arkdbox repository to deploy it.\n');
process.stdout.write('Raw build: https://arkdbox.com/builds/joel-football/ · Play page: https://arkdbox.com/play/joel-football/\n');
