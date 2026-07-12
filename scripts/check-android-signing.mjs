import { readFile } from 'node:fs/promises';

const signingPath = new URL('../android/keystore.properties', import.meta.url);

try {
  const contents = await readFile(signingPath, 'utf8');
  const requiredKeys = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];
  const values = Object.fromEntries(contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
    }));
  const missing = requiredKeys.filter((key) => !values[key] || values[key] === 'replace-me');
  if (missing.length > 0) throw new Error(`Missing signing values: ${missing.join(', ')}`);
} catch (error) {
  process.stderr.write(
    `Android release signing is not configured. Copy android/keystore.properties.example to android/keystore.properties and add the private upload-keystore values.\n${error.message}\n`,
  );
  process.exitCode = 1;
}
