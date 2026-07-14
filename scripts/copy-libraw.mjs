/**
 * Vendor the libraw-wasm runtime into `public/libraw/` (M5 — RAW support).
 *
 * Why: Turbopack deadlocks trying to bundle libraw-wasm's `new Worker(new
 * URL('./worker.js', import.meta.url))` + its 1.4MB wasm during `next build`.
 * Serving worker.js / libraw.js / libraw.wasm as static assets from /public and
 * spawning the worker from the fixed path `/libraw/worker.js` (see
 * src/lib/libraw-client.ts) keeps the bundler out of it entirely. The worker
 * resolves the wasm via `new URL('libraw.wasm', import.meta.url)`, so the three
 * files must sit together — which they do here.
 *
 * Runs on `postinstall` and `prebuild` so a fresh `npm ci` always re-vendors the
 * files matching the installed version. Idempotent.
 */
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'libraw-wasm', 'dist');
const dest = join(root, 'public', 'libraw');
const FILES = ['worker.js', 'libraw.js', 'libraw.wasm'];

if (!existsSync(join(src, 'worker.js'))) {
  console.warn('[copy-libraw] libraw-wasm not installed yet; skipping.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const f of FILES) {
  const to = join(dest, f);
  if (f.endsWith('.js')) {
    // Strip the sourceMappingURL so the browser doesn't 404 on the (unshipped) map.
    const code = readFileSync(join(src, f), 'utf8').replace(
      /\n?\/\/# sourceMappingURL=.*$/m,
      '',
    );
    writeFileSync(to, code);
  } else {
    copyFileSync(join(src, f), to);
  }
}
console.log('[copy-libraw] vendored libraw runtime → public/libraw/');
