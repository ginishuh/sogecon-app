// ESLint v9 flat config that wraps existing .eslintrc-style settings
// via FlatCompat, so we can keep rules while migrating.
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // 임시(반드시 원복): e2e 린트 제외 — glm-4.6 자동 변경 우회; see #29; remove by 2025-10-31
  // Ignore build output and E2E sources entirely from lint
  { ignores: ['**/.next/**', '**/e2e/**', 'vitest.config.e2e.ts', '**/*.e2e.*', 'playwright.config.*'] },
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
  })
  ,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname
      }
    }
  }
];
