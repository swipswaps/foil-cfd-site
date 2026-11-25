#!/usr/bin/env node
/**
 * check-bundle-budget.mjs — enforce the recorded JavaScript transfer budget.
 *
 * The foil lab is lazy-loaded, so the meaningful costs are:
 *   - the largest single chunk (currently the vtk.js viewer bundle),
 *   - the lab's initial JavaScript (VTK viewer + Plotly chart + lab shell),
 *   - all JavaScript combined.
 *
 * Gzip is the transfer metric; raw also guards the bundler's 800 kB warning.
 * Limits live in scripts/bundle-budget.json. Exit codes: 0 within budget,
 * 1 over budget, 2 no build to measure.
 *
 * usage: node scripts/check-bundle-budget.mjs [--dir dist] [--budget FILE] [--json]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { dir: join(REPO, 'dist'), budget: join(REPO, 'scripts/bundle-budget.json'), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') out.dir = resolve(argv[++i]);
    else if (a === '--budget') out.budget = resolve(argv[++i]);
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const LAB_PREFIXES = ['CfdVtkViewer-', 'CpPolarChart-', 'CfdLab-'];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function human(bytes) {
  return `${bytes} B (${(bytes / 1024).toFixed(0)} KiB)`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('usage: node scripts/check-bundle-budget.mjs [--dir dist] [--budget FILE] [--json]\n');
    return 0;
  }
  if (!existsSync(args.dir)) {
    process.stderr.write(`status=FAIL reason=no build directory: ${args.dir}\n`);
    return 2;
  }
  const assets = join(args.dir, 'assets');
  if (!existsSync(assets)) {
    process.stderr.write(`status=FAIL reason=no assets directory: ${assets}\n`);
    return 2;
  }
  const budget = readJson(args.budget);
  const limits = budget.limits ?? {};

  const chunks = readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const raw = readFileSync(join(assets, name));
      return { name, raw: raw.length, gzip: gzipSync(raw).length };
    });

  if (chunks.length === 0) {
    process.stderr.write(`status=FAIL reason=no javascript chunks in ${assets}\n`);
    return 2;
  }

  const largestRaw = chunks.reduce((a, b) => (b.raw > a.raw ? b : a));
  const largestGzip = chunks.reduce((a, b) => (b.gzip > a.gzip ? b : a));
  const labInitial = chunks
    .filter((c) => LAB_PREFIXES.some((p) => c.name.startsWith(p)))
    .reduce((sum, c) => sum + c.gzip, 0);
  const totalGzip = chunks.reduce((sum, c) => sum + c.gzip, 0);

  const checks = [
    ['largest chunk raw', largestRaw.raw, limits.largestChunkRawBytes, largestRaw.name],
    ['largest chunk gzip', largestGzip.gzip, limits.largestChunkGzipBytes, largestGzip.name],
    ['lab initial gzip', labInitial, limits.labInitialGzipBytes, 'VTK + Plotly + lab shell'],
    ['total JS gzip', totalGzip, limits.totalJsGzipBytes, `${chunks.length} chunks`],
  ];

  const failed = checks.filter(([, actual, limit]) => Number.isFinite(limit) && actual > limit);

  if (args.json) {
    const rows = checks.map(([metric, actual, limit, detail]) => ({
      metric,
      actual,
      limit: Number.isFinite(limit) ? limit : null,
      detail,
      ok: !Number.isFinite(limit) || actual <= limit,
    }));
    process.stdout.write(`${JSON.stringify({ status: failed.length ? 'FAIL' : 'PASS', rows }, null, 2)}\n`);
  } else {
    for (const [metric, actual, limit, detail] of checks) {
      const ok = !Number.isFinite(limit) || actual <= limit;
      process.stdout.write(
        `${ok ? 'PASS' : 'FAIL'} ${metric}: ${human(actual)} / ${Number.isFinite(limit) ? human(limit) : 'no limit'} [${detail}]\n`,
      );
    }
    process.stdout.write(`budget recorded ${budget.recorded ?? 'unknown'}\n`);
    process.stdout.write(`status=${failed.length ? 'FAIL' : 'PASS'} check-bundle-budget\n`);
  }

  return failed.length ? 1 : 0;
}

process.exit(main());
