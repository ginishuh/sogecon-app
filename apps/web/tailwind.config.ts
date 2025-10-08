import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#8a1e2d',
          primaryDark: '#6c1722',
          accent: '#f7b267',
          surface: '#f9f5f1'
        },
        neutral: {
          ink: '#1f242d',
          muted: '#5d6673',
          border: '#d8d3cc',
          surface: '#f2eee8'
        }
      },
      fontFamily: {
        heading: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        body: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      fontSize: {
        'display-2xl': ['3.25rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
        'display-xl': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }]
      },
      spacing: {
        15: '3.75rem',
        18: '4.5rem'
      },
      borderRadius: {
        '3xl': '1.75rem'
      },
      boxShadow: {
        soft: '0 24px 60px -32px rgba(18, 25, 38, 0.28)'
      }
    }
  },
  plugins: []
};

export default config;
