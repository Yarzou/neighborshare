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
        // Refonte « Verre et Cèdre » (2026-10-06, maquette validée) : fond gris très
        // clair, cartes blanches, texte presque noir, et le vert réservé aux actions,
        // aux icônes et à la sélection. Les gris sont neutres, à peine teintés de
        // vert, sur le modèle des gris système d'iOS. Toutes les classes `gray-*`
        // basculent d'un coup ; le mode sombre n'est pas touché, son bloc de
        // surcharges emploie des hex.
        // gray-50 est le fond de page, gray-100 les zones en retrait et les
        // remplissages (champs, contrôles segmentés), gray-200 les bordures.
        // `white` redevient un blanc pur : c'est la couleur des cartes.
        white: '#ffffff',
        gray: {
          50:  '#f2f5f3',
          100: '#eef1ef',
          200: '#e1e5e2',
          300: '#c9cecb',
          400: '#a3a8a5',
          500: '#6c6c70',
          600: '#545458',
          700: '#3a3a3c',
          800: '#2c2c2e',
          900: '#1c1c1e',
        },
        // Vert Cèdre : brand-600 #1f6f47 est la couleur des actions (blanc dessus : 6,3:1).
        brand: {
          50:  '#eef6f1',
          100: '#e4eee9',
          200: '#c6ddd0',
          300: '#95c1a7',
          400: '#5c9d77',
          500: '#2f8257',
          600: '#1f6f47',
          700: '#185c3a',
          800: '#134a2f',
          900: '#0f3b26',
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
          // En-tête d'accordéon ouvert (profil) — pastel du vert du titre
          accent: 'var(--surface-accent)',
        },
        // Verre blanc des éléments flottants (barre d'onglets, menu latéral) :
        // toujours avec `backdrop-blur`, voir la classe `.glass` de globals.css.
        glass: 'var(--glass)',
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
