// Runs scripts/readme-images.ts: bundled with esbuild like the content CLI.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const out = join('out-tsc', 'readme-images.mjs');
await build({ entryPoints: ['scripts/readme-images.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: out, logLevel: 'warning' });
const run = spawnSync(process.execPath, [out], { stdio: 'inherit' });
process.exit(run.status ?? 1);
