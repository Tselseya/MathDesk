import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist');
const indexPath = resolve(root, 'index.html');

function fail(message) {
  console.error(`Build verification failed: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(indexPath)) {
  fail('dist/index.html is missing. Run npm run build first.');
  process.exit();
}

const html = readFileSync(indexPath, 'utf8');
const assetReferences = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"?#]+)"/g)].map((match) => match[1]);

if (!assetReferences.length) fail('dist/index.html does not reference a compiled asset.');
for (const reference of assetReferences) {
  if (!existsSync(resolve(root, reference))) fail(`Referenced asset is missing: ${reference}`);
}

for (const requiredFile of ['site.webmanifest', 'sw.js']) {
  if (!existsSync(resolve(root, requiredFile))) fail(`Required deployment file is missing: ${requiredFile}`);
}

const forbidden = /(?:ngrok|api\.groq\.com|webhook\/mathdesk-ai)/i;
if (forbidden.test(html)) fail('Generated index contains a retired provider or webhook reference.');

const jsFiles = assetReferences.filter((reference) => reference.endsWith('.js'));
for (const jsFile of jsFiles) {
  const content = readFileSync(resolve(root, jsFile), 'utf8');
  if (forbidden.test(content)) fail(`Generated JavaScript contains a retired provider or webhook reference: ${jsFile}`);
}

if (!html.includes('Content-Security-Policy')) {
  fail('Generated index is missing the production Content-Security-Policy meta tag.');
}

for (const origin of ['https://js.hcaptcha.com', 'https://*.hcaptcha.com']) {
  if (!html.includes(origin)) fail(`Generated CSP is missing the hCaptcha origin: ${origin}`);
}

if (!process.exitCode) {
  console.log(`Build artifact verified: ${assetReferences.length} compiled assets, manifest, service worker, CSP, and endpoint exposure checks passed.`);
}
