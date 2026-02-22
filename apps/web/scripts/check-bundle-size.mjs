#!/usr/bin/env node
import { statSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function getArgs(name) {
  const args = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] !== name) continue;
    const value = process.argv[i + 1];
    if (value) args.push(value);
  }
  return args;
}

const maxKb = Number(getArg('--max-kb', '1000'));
// Resolve project root relative to this script (apps/web)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = join(__dirname, '..');
const chunksDir = join(projectDir, '.next', 'static', 'chunks');
const rawExcludePrefixes = getArgs('--exclude-prefix');

function normalizeRelPath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function normalizePrefix(prefix) {
  let out = normalizeRelPath(prefix).replace(/^\//, '');
  if (out && !out.endsWith('/')) out = `${out}/`;
  return out;
}

const excludePrefixes = rawExcludePrefixes.map(normalizePrefix).filter(Boolean);

function shouldExclude(relPath) {
  if (excludePrefixes.length === 0) return false;
  const rel = normalizeRelPath(relPath);
  return excludePrefixes.some((prefix) => rel.startsWith(prefix));
}

function routeStartsWithPrefix(route, routePrefix) {
  const prefix = routePrefix.endsWith('/') ? routePrefix.slice(0, -1) : routePrefix;
  return route === prefix || route.startsWith(routePrefix);
}

function toRoutePrefix(prefix) {
  if (!prefix.startsWith('app/')) return null;
  const pathPart = prefix.slice('app/'.length).replace(/\/$/, '');
  if (!pathPart) return '/';
  return `/${pathPart}/`;
}

function getExcludedSharedChunks() {
  if (excludePrefixes.length === 0) return new Set();
  const routePrefixes = excludePrefixes
    .map(toRoutePrefix)
    .filter((value) => typeof value === 'string');
  if (routePrefixes.length === 0) return new Set();

  const appManifestPath = join(projectDir, '.next', 'app-build-manifest.json');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(appManifestPath, 'utf8'));
  } catch {
    return new Set();
  }

  const pages = (parsed && typeof parsed === 'object' && 'pages' in parsed)
    ? parsed.pages
    : parsed;

  if (!pages || typeof pages !== 'object') return new Set();

  const chunkConsumers = new Map();
  for (const [route, assets] of Object.entries(pages)) {
    if (typeof route !== 'string' || !Array.isArray(assets)) continue;
    for (const asset of assets) {
      if (typeof asset !== 'string') continue;
      if (!asset.startsWith('static/chunks/') || !asset.endsWith('.js')) continue;
      const relFile = normalizeRelPath(asset.slice('static/chunks/'.length));
      const consumers = chunkConsumers.get(relFile);
      if (consumers) consumers.add(route);
      else chunkConsumers.set(relFile, new Set([route]));
    }
  }

  const excludedShared = new Set();
  for (const [relFile, consumers] of chunkConsumers.entries()) {
    if (consumers.size === 0) continue;
    const excludedOnly = Array.from(consumers).every((route) =>
      routePrefixes.some((routePrefix) => routeStartsWithPrefix(route, routePrefix))
    );
    if (excludedOnly) excludedShared.add(relFile);
  }
  return excludedShared;
}

function listJsSizes(dir) {
  let total = 0;
  const excludedSharedChunks = getExcludedSharedChunks();
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const relDir = normalizeRelPath(relative(chunksDir, d));
    if (relDir && shouldExclude(`${relDir}/`)) continue;
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (name.endsWith('.js')) {
        const relFile = normalizeRelPath(relative(chunksDir, p));
        if (shouldExclude(relFile)) continue;
        if (excludedSharedChunks.has(relFile)) continue;
        total += st.size;
      }
    }
  }
  return total;
}

try {
  const totalBytes = listJsSizes(chunksDir);
  const totalKb = Math.round(totalBytes / 1024);
  console.log(`Total JS in .next/static/chunks: ${totalKb} KB (limit ${maxKb} KB)`);
  if (excludePrefixes.length > 0) {
    console.log(`Excluded prefixes: ${excludePrefixes.join(', ')}`);
  }
  if (totalKb > maxKb) {
    console.error(`Bundle size exceeds limit by ${totalKb - maxKb} KB`);
    process.exit(1);
  }
} catch (e) {
  console.error('Bundle size check failed:', e.message);
  process.exit(1);
}
