import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function originOf(value: string | undefined) {
  try {
    return value ? new URL(value).origin : '';
  } catch {
    return '';
  }
}

/**
 * GitHub Pages cannot send security headers, so the production build embeds a Content-Security-Policy <meta> tag.
 * It is generated from the same VITE_* values the app is built with, so the allowed network hosts always match.
 * (Production build only: the dev server needs inline scripts, so it is left alone.)
 */
function contentSecurityPolicy(env: Record<string, string>): Plugin {
  const supabase = originOf(env.VITE_SUPABASE_URL);
  const supabaseSocket = supabase.replace(/^https:/, 'wss:');
  const ai = [originOf(env.VITE_MATHDESK_API_URL), originOf(env.VITE_N8N_WEBHOOK_URL)];
  const connect = ["'self'", supabase, supabaseSocket, ...ai].filter(Boolean);
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(new Set(connect)).join(' ')}`,
    "frame-src https://www.geogebra.org https://*.geogebra.org",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'mathdesk-content-security-policy',
    apply: 'build',
    transformIndexHtml(html: string) {
      // First thing in <head>, so it is in force before any script or stylesheet is requested.
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    root: 'app',
    publicDir: '../public',
    plugins: [react(), contentSecurityPolicy(env)],
    base: './',
    build: { outDir: '../dist', emptyOutDir: true },
  };
});
