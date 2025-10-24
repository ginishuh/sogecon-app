// ESLint v9 flat config that wraps existing .eslintrc-style settings
// via FlatCompat, so we can keep rules while migrating.
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // 빌드 산출물만 무시
  { ignores: ['**/.next/**'] },

  // Load equivalent of our .eslintrc.json
  ...compat.config({
    extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'import', 'promise'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' }
      ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'complexity': ['error', { max: 10 }],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: false }],
      'import/no-cycle': ['error', { maxDepth: 1 }],
      'promise/catch-or-return': 'error'
    }
  }),

  // 일반 TS 파일: 앱 소스는 기본 tsconfig
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname
      }
    }
  },

  // e2e 전용: 타입 인식 린트(별도 프로젝트) — #29 e2e 엄격 린트 복구
  {
    files: ['e2e/**/*.{ts,tsx}', '**/*.e2e.{ts,tsx}', 'vitest.config.e2e.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      }
    }
  }
];
