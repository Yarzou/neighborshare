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
        // Palette claire « B2 » (2026-10-02) : les gris Tailwind sont remplacés par
        // une gamme ardoise, gris bleuté. Toutes les classes `gray-*` de l'app
        // (fond de page, bordures, textes secondaires) basculent d'un coup, sans
        // toucher au mode sombre, dont le bloc de surcharges emploie des hex.
        // gray-50 est le fond de page, gray-100 les zones en retrait, gray-200 les
        // bordures. Trois niveaux depuis le 2026-10-02 : page #e9edf2 < volets
        // #f1f4f7 < cartes #f9fafb (cf. `white` ci-dessus et les tokens de globals.css).
        // Plus aucun blanc pur : `bg-white` (cartes, lignes, formulaires) devient un
        // gris à peine teinté, sur toutes les pages d'un coup. `text-white` sur les
        // boutons verts en hérite sans différence perceptible.
        white: '#f9fafb',
        gray: {
          50:  '#e9edf2',
          100: '#e2e8f0',
          200: '#d7dee6',
          300: '#b7c1cd',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
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
          // Volets latéraux (Quartier, Demandes, Messages, Profil) et barre de navigation
          pane: 'var(--surface-pane)',
          header: 'var(--surface-header)',
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
        // Pile système, plus GeistMono : la police monospace pesait 71 Ko de
        // woff2 chargés sur chaque page pour un seul mot de l'interface (le
        // « SUPPRIMER » à recopier dans la modale de suppression de compte).
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
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
