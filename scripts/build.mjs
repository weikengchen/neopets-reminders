import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
mkdirSync(join(dist, 'assets'), { recursive: true });

const shared = {
  bundle: true,
  format: 'esm',
  target: ['chrome120'],
  sourcemap: true,
  logLevel: 'info',
  platform: 'browser',
};

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/background/service-worker.ts')],
  outfile: join(dist, 'service-worker.js'),
});

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/content/observe.ts')],
  outfile: join(dist, 'observe-content.js'),
});

await esbuild.build({
  ...shared,
  entryPoints: [join(root, 'src/popup/popup.ts')],
  outfile: join(dist, 'popup.js'),
});

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

cpSync(join(root, 'src/popup/index.html'), join(dist, 'popup.html'));
cpSync(join(root, 'src/popup/popup.css'), join(dist, 'popup.css'));

for (const size of [16, 32, 48, 128]) {
  cpSync(
    join(root, `src/assets/icon-${size}.png`),
    join(dist, 'assets', `icon-${size}.png`),
  );
}

console.log('Build complete → dist/');
