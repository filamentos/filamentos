import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        page:     '#0f1623',
        surface:  '#151e30',
        elevated: '#1e2a3e',
        input:    '#1a2436',

        // Accent — Indigo / Purple
        accent: {
          DEFAULT: '#818cf8',
          strong:  '#6366f1',
          subtle:  '#1e2a3e',
          muted:   '#3d4a6e',
        },

        // Text
        ink: {
          primary:   '#cdd6f4',
          secondary: '#8896b8',
          tertiary:  '#4a5a7a',
        },

        // Borders
        border: {
          DEFAULT: '#1e2a3e',
          strong:  '#2e3e58',
        },

        // Semantic status
        success: '#4ade80',
        'success-bg': '#172a20',
        warning: '#fbbf24',
        'warning-bg': '#1e1a10',
        danger:  '#f87171',
        'danger-bg':  '#2a1515',
        info:    '#60a5fa',
        'info-bg':    '#1a2436',

        // Swatch ring
        'swatch-ring': '#2e3e58',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        'xxs': ['11px', { lineHeight: '16px' }],
        'xs':  ['12px', { lineHeight: '16px' }],
        'sm':  ['13px', { lineHeight: '20px' }],
        'md':  ['14px', { lineHeight: '20px' }],
        'lg':  ['16px', { lineHeight: '24px' }],
        'xl':  ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
      },

      borderRadius: {
        sm:   '6px',
        md:   '8px',
        lg:   '10px',
        xl:   '14px',
        full: '9999px',
      },

      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
      },
    },
  },
  plugins: [],
} satisfies Config
