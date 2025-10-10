import type { Config } from 'tailwindcss';

// 디자인 시스템 v1 — Phase 1: Semantic Tokens
// - colors: brand scale, text, surface, state
// - spacing: 기본 스케일(4/8/12/16/24/32/40/48는 Tailwind 기본과 일치)
// - radius: sm=4px, md=8px, lg=12px
// - shadow: xs/sm/md/lg
// - container padding: sm:px-4 md:px-6 lg:px-8

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem', // px-4
        sm: '1rem',
        md: '1.5rem', // px-6
        lg: '2rem', // px-8
      },
    },
    extend: {
      colors: {
        // 브랜드: 명도 단계(AA 대비 기준으로 중간~짙은 톤을 기본 상호작용에 사용)
        brand: {
          // 레거시 키(기존 클래스 호환)
          primary: '#8a1e2d',
          primaryDark: '#6c1722',
          accent: '#f4a259',
          surface: '#f9f5f1',
          50: '#fff1f3',
          100: '#ffe4e8',
          200: '#fecdd6',
          300: '#fda4b0',
          400: '#f17888',
          500: '#c94a58',
          600: '#a93443',
          700: '#8a1e2d', // 기존 primary
          800: '#6c1722', // 기존 primaryDark
          900: '#4f0f18',
        },
        text: {
          primary: '#1f242d',
          secondary: '#2b3340',
          muted: '#5d6673',
          inverse: '#ffffff',
        },
        surface: {
          DEFAULT: '#ffffff',
          raised: '#f9f5f1',
          sunken: '#f2eee8',
        },
        state: {
          primary: '#8a1e2d',
          secondary: '#334155',
          success: '#0f766e',
          info: '#2563eb',
          warning: '#ca8a04',
          error: '#b91c1c',
        },
        neutral: {
          ink: '#1f242d',
          muted: '#5d6673',
          border: '#d8d3cc',
        },
      },
      fontFamily: {
        // next/font가 주입하는 CSS 변수 기반 — 전역에서 html.className에 설정
        heading: ['var(--font-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        body: ['var(--font-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      // 모바일 기준 타이포 스케일(글로벌에서 md 이상 확대)
      fontSize: {
        h1: ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 28px
        h2: ['1.375rem', { lineHeight: '1.25' }], // 22px
        h3: ['1.125rem', { lineHeight: '1.3' }], // 18px
        body: ['0.9375rem', { lineHeight: '1.6' }], // 15px
        // 레거시 클래스 호환(about 섹션 등)
        'display-xl': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
        'display-2xl': ['3.25rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        '3xl': '1.75rem',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.05)',
        sm: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        md: '0 8px 24px rgba(0,0,0,0.08)',
        lg: '0 16px 40px rgba(0,0,0,0.12)',
        soft: '0 24px 60px -32px rgba(18, 25, 38, 0.28)', // 기존 유지
      },
      ringColor: {
        DEFAULT: '#f17888', // brand.400
      },
    },
  },
  plugins: [],
};

export default config;
