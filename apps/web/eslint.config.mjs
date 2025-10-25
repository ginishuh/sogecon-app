// ESLint v9 flat config that wraps existing .eslintrc-style settings
// via FlatCompat, so we can keep rules while migrating.
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
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

  // JS config files (no type info) — relax TS unsafe rules here only
  {
    files: ['**/*.config.js', 'next.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // 사용하지 않는 변수는 경고가 아닌 에러로 취급(가드레일 준수)
      '@typescript-eslint/no-unused-vars': ['error', { "argsIgnorePattern": "^_" }],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },

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
  // test 전용: 타입 인식 린트(별도 프로젝트)
  {
    files: ['__tests__/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // 테스트 코드는 런타임 안전성보다 가독성과 서드파티 타입 한계를 고려
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off'
    }
  },

  // e2e 전용: 타입 인식 린트(별도 프로젝트) — #29 e2e 엄격 린트 복구
  {
    files: ['e2e/**/*.{ts,tsx}', '**/*.e2e.{ts,tsx}', 'vitest.config.e2e.ts'],
    languageOptions: {
      // compat 블록들과의 병합 순서와 무관하게 의도를 명확히 하기 위해 parser 명시
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      },
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      // 테스트 로깅 허용(프리커밋 --max-warnings=0 보호)
      'no-console': 'off'
    }
  }
];
