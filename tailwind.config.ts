import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: '#111118',
        'border-col': '#1e1e2e',
        cyan: { DEFAULT: '#00e5ff' },
        purple: { DEFAULT: '#7c3aed' },
        amber: { DEFAULT: '#f59e0b' },
        'text-col': '#e2e8f0',
        muted: '#64748b',
      },
      fontFamily: {
        mono: ['var(--font-jetbrains)', 'monospace'],
        heading: ['var(--font-syne)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
