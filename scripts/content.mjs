// Runs scripts/content-cli.ts: bundled with esbuild, so the game's own TypeScript rules are used.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const out = join('out-tsc', 'content-cli.mjs');
await build({ entryPoints: ['scripts/content-cli.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: out, logLevel: 'warning' });
const run = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(run.status ?? 1);
