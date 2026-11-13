#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const target = process.argv[2] || process.env.SECURITY_AUDIT_TARGET || 'dist';
const isUrl = /^https?:\/\//i.test(target);
const failures = [];
const warnings = [];

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }
function assertIncludes(value, needle, label) {
  if (!value.includes(needle)) fail(`${label}: missing ${needle}`);
}

async function auditLocal(directory) {
  const root = resolve(directory);
  const index = await readFile(join(root, 'index.html'), 'utf8');
  const jsFiles = [];
  async function collectJs(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await collectJs(path);
      else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(path);
    }
  }
  await collectJs(root);
  const js = (await Promise.all(jsFiles.map((path) => readFile(path, 'utf8')))).join('\n');
  auditHtml(index, `local:${root}`);
  auditBundle(js, `local:${root}`);
}

async function auditRemote(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) fail(`Remote page returned HTTP ${response.status}: ${url}`);
  const index = await response.text();
  auditHtml(index, url);
  const scripts = [...index.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => new URL(match[1], url).href);
  const bundles = [];
  for (const script of scripts) {
    const asset = await fetch(script);
    if (!asset.ok) { fail(`Remote script returned HTTP ${asset.status}: ${script}`); continue; }
    bundles.push(await asset.text());
  }
  auditBundle(bundles.join('\n'), url);

  const headers = Object.fromEntries(response.headers.entries());
  if (!headers['content-security-policy']) warn('Live response has no HTTP Content-Security-Policy header; GitHub Pages only receives the build meta CSP.');
  if (!headers['strict-transport-security']) warn('Live response has no Strict-Transport-Security header.');
  if (!headers['x-content-type-options']) warn('Live response has no X-Content-Type-Options header.');
  if (!headers['x-frame-options']) warn('Live response has no X-Frame-Options header.');
}

function auditHtml(html, label) {
  if (!/<meta[^>]+http-equiv=["']Content-Security-Policy["']/i.test(html)) fail(`${label}: CSP meta tag is missing.`);
  const csp = html.match(/http-equiv=["']Content-Security-Policy["'][^>]+content=(["'])(.*?)\1/i)?.[2] || '';
  assertIncludes(csp, "object-src 'none'", `${label} CSP`);
  assertIncludes(csp, "base-uri 'self'", `${label} CSP`);
  assertIncludes(csp, "form-action 'self'", `${label} CSP`);
  if (/unsafe-eval/i.test(csp)) fail(`${label} CSP permits unsafe-eval.`);
  if (/service_role|SUPABASE_SERVICE_ROLE_KEY|GROQ_API_KEY|sk-[A-Za-z0-9]/i.test(html)) fail(`${label}: private provider credential marker found in HTML.`);
}

function auditBundle(bundle, label) {
  if (!bundle.trim()) { fail(`${label}: no JavaScript bundle was found.`); return; }
  if (/SUPABASE_SERVICE_ROLE_KEY|GROQ_API_KEY|service_role/i.test(bundle)) fail(`${label}: private Supabase/Groq credential marker found in bundle.`);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(bundle)) fail(`${label}: private key material found in bundle.`);
  if (!/hcaptcha/i.test(bundle)) warn(`${label}: hCaptcha marker not found in bundle; verify the build was configured with VITE_HCAPTCHA_SITEKEY.`);
  if (/\beval\s*\(|\bFunction\s*\(/.test(bundle)) warn(`${label}: dynamic code execution marker found; review whether it is isolated to the calculator evaluator.`);
}

try {
  if (isUrl) await auditRemote(target);
  else await auditLocal(target);
} catch (error) {
  fail(`${target}: audit could not complete (${error instanceof Error ? error.message : String(error)}).`);
}

console.log(`Security audit target: ${target}`);
console.log(`Failures: ${failures.length}`);
for (const item of failures) console.log(`FAIL: ${item}`);
console.log(`Warnings: ${warnings.length}`);
for (const item of warnings) console.log(`WARN: ${item}`);
if (failures.length) process.exitCode = 1;
