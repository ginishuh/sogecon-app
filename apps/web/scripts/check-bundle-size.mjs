#!/usr/bin/env node
import { statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const maxKb = Number(getArg('--max-kb', '1000'));
// Resolve project root relative to this script (apps/web)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = join(__dirname, '..');
const chunksDir = join(projectDir, '.next', 'static', 'chunks');

function listJsSizes(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (name.endsWith('.js')) total += st.size;
    }
  }
  return total;
}

try {
  const totalBytes = listJsSizes(chunksDir);
  const totalKb = Math.round(totalBytes / 1024);
  console.log(`Total JS in .next/static/chunks: ${totalKb} KB (limit ${maxKb} KB)`);
  if (totalKb > maxKb) {
    console.error(`Bundle size exceeds limit by ${totalKb - maxKb} KB`);
    process.exit(1);
  }
} catch (e) {
  console.error('Bundle size check failed:', e.message);
  process.exit(1);
}
