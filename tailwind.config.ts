import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warm: {
          50:  '#fefce8',
          100: '#fef9c3',
          400: '#facc15',
          500: '#eab308',
        },
        // Tokens sémantiques adossés aux variables CSS de globals.css.
        // Ils basculent seuls en thème sombre : un composant qui les utilise n'a
        // rien à déclarer dans le bloc d'overrides `!important`.
        // À privilégier pour tout nouveau composant — voir globals.css.
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        edge: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        content: {
          DEFAULT: 'var(--text)',
          soft: 'var(--text-soft)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
export default config
