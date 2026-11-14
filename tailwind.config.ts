import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA',
        surface: {
          DEFAULT: '#FFFFFF',
          dim: '#F5F5F5',
          container: '#EFEDED',
          border: '#EEEEEE',
          darkBorder: '#333333',
          containerLow: '#F5F3F3',
          containerLowest: '#FFFFFF',
          containerHigh: '#E9E8E7',
          containerHighest: '#E3E2E2',
        },
        primary: {
          DEFAULT: '#212121',
          hover: '#383838',
          container: '#212121',
          fixed: '#E5E2E1',
          fixedDim: '#C8C6C5',
        },
        accent: {
          DEFAULT: '#FF7759',
          hover: '#E66346',
        },
        coral: {
          DEFAULT: '#FF7759',
          deep: '#E66346',
        },
        secondary: {
          DEFAULT: '#A83820',
          hover: '#8E2E18',
          container: '#FC7557',
          fixed: '#FFDAD3',
          fixedDim: '#FFB4A4',
        },
        graphite: {
          DEFAULT: '#212121',
          card: '#2A2A2A',
          muted: '#757575',
        },
        muted: {
          DEFAULT: '#757575',
          light: '#9E9E9E',
        },
        border: {
          DEFAULT: '#EEEEEE',
          hover: '#E0E0E0',
        },
        state: {
          error: '#BA1A1A',
          success: '#1B7A43',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Manrope', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'sans-serif'],
        numeric: ['var(--font-numeric)', 'Geist', 'monospace'],
        mono: ['var(--font-numeric)', 'Geist', 'monospace'],
      },
      borderRadius: {
        sm: '0.25rem', // 4px
        DEFAULT: '0.5rem', // 8px
        md: '0.5rem', // 8px
        lg: '1rem', // 16px
        xl: '1.5rem', // 24px
        full: '9999px',
      },
      boxShadow: {
        'level-1': '0 2px 8px -2px rgba(33, 33, 33, 0.04), 0 1px 3px -1px rgba(33, 33, 33, 0.02)',
        'level-2': '0 12px 24px -6px rgba(33, 33, 33, 0.06), 0 4px 8px -2px rgba(33, 33, 33, 0.03)',
        'level-3': '0 24px 48px -12px rgba(33, 33, 33, 0.12)',
      },
      maxWidth: {
        canvas: '1440px',
      },
    },
  },
  plugins: [],
};

export default config;
