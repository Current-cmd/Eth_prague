import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#0a1330',
        panel:  '#131e44',
        rule:   '#1f2c5d',
        rule2:  '#2e3e7a',
        paper:  '#e8edf6',
        paper2: '#a3b1c9',
        paper3: '#6e7d99',
        amber:  '#682eb3',
        amber2: '#7c3fc7',
        alert:  '#7dd3fc',
        verify: '#86efac',
      },
      fontFamily: {
        serif: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans:  ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        mono:  ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
