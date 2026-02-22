/**
 * 아이콘 생성 스크립트
 *
 * public/favicon.svg (IHS 크레스트)를 원본으로 사용하여
 * PWA용 PNG 아이콘, maskable 아이콘, apple-touch-icon, favicon.ico를 생성합니다.
 *
 * 사용법: node scripts/generate-icons.mjs
 * 의존성: sharp, png-to-ico (devDependencies)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WEB = resolve(ROOT, 'apps/web');
const ICONS_DIR = resolve(WEB, 'public/icons');

/** 원본 크레스트 SVG (62×90 viewBox) */
const crestSvg = readFileSync(resolve(WEB, 'public/favicon.svg'), 'utf-8');

/**
 * 흰색 배경 정사각형 SVG에 크레스트를 중앙 배치한 SVG Buffer를 생성한다.
 * @param {number} size - 정사각형 한 변 길이 (px)
 * @param {number} paddingRatio - 패딩 비율 (0~1). 기본 0.125 (12.5%)
 */
function buildSquareSvg(size, paddingRatio = 0.125) {
  const ORIG_W = 62;
  const ORIG_H = 90;
  const padding = Math.round(size * paddingRatio);
  const available = size - padding * 2;
  const scale = Math.min(available / ORIG_W, available / ORIG_H);
  const scaledW = ORIG_W * scale;
  const scaledH = ORIG_H * scale;
  const tx = (size - scaledW) / 2;
  const ty = (size - scaledH) / 2;

  // crestSvg에서 내부 path 요소만 추출
  const pathsMatch = crestSvg.match(/<path[\s\S]*?\/>/g);
  if (!pathsMatch) throw new Error('원본 SVG에서 path 요소를 찾을 수 없습니다');
  const paths = pathsMatch.join('\n    ');

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(6)})">
    ${paths}
  </g>
</svg>`);
}

/**
 * Maskable 아이콘용 SVG를 생성한다.
 * 안전 영역(중앙 80%) 내에 크레스트를 배치하고, 나머지 영역은 흰색 배경.
 */
function buildMaskableSvg(size) {
  // maskable safe zone: 중앙 80% → 패딩 10%
  return buildSquareSvg(size, 0.15);
}

async function generatePng(svgBuffer, outputPath, size) {
  await sharp(svgBuffer, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`  생성: ${outputPath} (${size}×${size})`);
}

async function main() {
  console.log('아이콘 생성을 시작합니다...\n');

  // 일반 아이콘 PNG
  const sizes = [
    { size: 192, output: resolve(ICONS_DIR, 'icon-192.png') },
    { size: 512, output: resolve(ICONS_DIR, 'icon-512.png') },
    { size: 180, output: resolve(ICONS_DIR, 'apple-touch-icon.png') },
  ];

  console.log('[일반 아이콘]');
  for (const { size, output } of sizes) {
    const svg = buildSquareSvg(size);
    await generatePng(svg, output, size);
  }

  // Maskable 아이콘 PNG
  const maskableSizes = [
    { size: 192, output: resolve(ICONS_DIR, 'icon-192-maskable.png') },
    { size: 512, output: resolve(ICONS_DIR, 'icon-512-maskable.png') },
  ];

  console.log('\n[Maskable 아이콘]');
  for (const { size, output } of maskableSizes) {
    const svg = buildMaskableSvg(size);
    await generatePng(svg, output, size);
  }

  // favicon.ico (32×32 + 16×16)
  console.log('\n[favicon.ico]');
  const svg32 = buildSquareSvg(32, 0.0625);
  const png32 = await sharp(svg32, { density: 300 }).resize(32, 32).png().toBuffer();
  const svg16 = buildSquareSvg(16, 0.0625);
  const png16 = await sharp(svg16, { density: 300 }).resize(16, 16).png().toBuffer();

  const icoBuffer = await pngToIco([png16, png32]);
  const { writeFileSync } = await import('node:fs');
  const icoPath = resolve(WEB, 'public/favicon.ico');
  writeFileSync(icoPath, icoBuffer);
  console.log(`  생성: ${icoPath} (16×16 + 32×32 멀티사이즈)`);

  console.log('\n모든 아이콘 생성 완료!');
}

main().catch((err) => {
  console.error('아이콘 생성 실패:', err);
  process.exit(1);
});
