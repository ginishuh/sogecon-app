import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve(process.cwd(), 'scripts/check-bundle-size.mjs');
const fixtures: string[] = [];

function createFixture(manifestSource: string): string {
  const fixture = mkdtempSync(join(tmpdir(), 'sogecon-bundle-'));
  fixtures.push(fixture);
  const chunksDir = join(fixture, '.next/static/chunks');
  const appChunksDir = join(chunksDir, 'app/posts/[id]');
  const manifestDir = join(fixture, '.next/server/app/posts/[id]');
  mkdirSync(appChunksDir, { recursive: true });
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(chunksDir, 'root.js'), 'root');
  writeFileSync(join(appChunksDir, 'page.js'), 'route');
  writeFileSync(
    join(fixture, '.next/build-manifest.json'),
    JSON.stringify({ polyfillFiles: [], rootMainFiles: ['static/chunks/root.js'] }),
  );
  writeFileSync(
    join(manifestDir, 'page_client-reference-manifest.js'),
    manifestSource,
  );
  return fixture;
}

function runBundleCheck(fixture: string) {
  return spawnSync(
    process.execPath,
    [scriptPath, '--project-dir', fixture, '--max-kb', '1'],
    { encoding: 'utf8' },
  );
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe('Next 16 번들 크기 스크립트', () => {
  it('clientModules 청크와 URL 인코딩 동적 경로를 계측한다', () => {
    const payload = {
      clientModules: {
        route: {
          chunks: ['1', 'static/chunks/app/posts/%5Bid%5D/page.js'],
        },
      },
    };
    const fixture = createFixture(
      `globalThis.__RSC_MANIFEST["/posts/[id]/page"]=${JSON.stringify(payload)};`,
    );

    const result = runBundleCheck(fixture);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Measurement mode: next16-client-reference-manifest');
    expect(result.stdout).toContain('Measured JS chunks: 2');
  });

  it('손상된 client manifest를 성공으로 처리하지 않는다', () => {
    const fixture = createFixture('globalThis.__RSC_MANIFEST["/posts/[id]/page"]={};');

    const result = runBundleCheck(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Next 16 clientModules가 없습니다');
  });

  it('매니페스트에 기록된 물리 청크가 없으면 실패한다', () => {
    const payload = {
      clientModules: {
        route: { chunks: ['static/chunks/missing.js'] },
      },
    };
    const fixture = createFixture(
      `globalThis.__RSC_MANIFEST["/posts/[id]/page"]=${JSON.stringify(payload)};`,
    );

    const result = runBundleCheck(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing.js');
  });
});
