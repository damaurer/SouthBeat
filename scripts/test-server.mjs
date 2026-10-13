// Runs the server tests (src/**/*.test.ts) in Node, where `ws` and `http` exist.
// Each test file is bundled with esbuild and handed to Node's built-in test runner.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { globSync, mkdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

const out = join('out-tsc', 'server-tests');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = globSync('src/**/*.test.ts');
await build({
  entryPoints: files,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outdir: out,
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const run = spawnSync(process.execPath, ['--test', ...files.map((f) => join(out, basename(f).replace(/\.ts$/, '.mjs')))], { stdio: 'inherit' });
process.exit(run.status ?? 1);
