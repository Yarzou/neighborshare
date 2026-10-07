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
        // Refonte « Verre et Cèdre », couleurs Apple (2026-10-07) : fond gris clair,
        // cartes blanches, texte presque noir. Demande utilisateur : « des couleurs
        // à la Apple, pas de teinte de vert ». Les gris sont donc les gris système
        // d'iOS, neutres (plus aucun gris verdâtre). Toutes les classes `gray-*`
        // basculent d'un coup ; le mode sombre garde son bloc de surcharges en hex.
        // gray-50 est le fond de page, gray-100 les remplissages (champs), gray-200
        // les séparateurs et la piste des contrôles segmentés.
        // `white` est un blanc pur : c'est la couleur des cartes.
        white: '#ffffff',
        gray: {
          50:  '#f2f2f7',
          100: '#e9e9ee',
          200: '#e3e3e8',
          300: '#d1d1d6',
          400: '#8e8e93',
          500: '#6c6c70',
          600: '#545458',
          700: '#3a3a3c',
          800: '#2c2c2e',
          900: '#1c1c1e',
        },
        // Vert « système » d'Apple, en version contrastée : le vert reste la base de
        // l'appli (actions, icônes), mais en aplat franc. brand-600 #23843b est le
        // vert des boutons (blanc dessus : 4,7:1) ; brand-400 est le vert système.
        // ⚠️ brand-50 à brand-300 sont volontairement NEUTRES (gris système) : ils
        // servaient de fonds et de bordures vert pâle dans toute l'appli (sélection,
        // survol, pastilles), et l'utilisateur ne veut plus de vert pâle.
        brand: {
          50:  '#f2f2f7',
          100: '#e9e9ee',
          200: '#d1d1d6',
          300: '#c7c7cc',
          400: '#34c759',
          500: '#2aa14b',
          600: '#23843b',
          700: '#1d7032',
          800: '#175a28',
          900: '#11441e',
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
        // Verre blanc des éléments flottants (menu latéral, barre du haut) :
        // toujours avec `backdrop-blur`, voir la classe `.glass` de globals.css.
        glass: 'var(--glass)',
        // Barre d'onglets et sa bulle, repris de l'app Fridge (2026-10-06) : verre
        // très transparent, bulle gris système translucide. Voir globals.css.
        tabbar: {
          DEFAULT: 'var(--tabbar)',
          edge: 'var(--tabbar-edge)',
          // Doigt posé sur la barre : elle se densifie (2026-10-07)
          strong: 'var(--tabbar-strong)',
        },
        // Fond de la loupe de la barre d'onglets
        'lens-fill': 'var(--lens-fill)',
        bubble: {
          DEFAULT: 'var(--bubble)',
          edge: 'var(--bubble-edge)',
        },
        // Pastille soulevée par le doigt (contrôle segmenté) : verre clair
        lens: 'var(--lens)',
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
      // « Goutte d'eau » de la barre d'onglets et des contrôles segmentés (repris
      // de Fridge) : la bulle s'étire en partant, se tasse, puis se pose.
      keyframes: {
        bubble: {
          '0%': { transform: 'scale(1, 1)' },
          '30%': { transform: 'scale(1.24, 0.84)' },
          '62%': { transform: 'scale(0.95, 1.06)' },
          '100%': { transform: 'scale(1, 1)' },
        },
      },
      animation: {
        bubble: 'bubble 560ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      boxShadow: {
        // Barre d'onglets : ombre portée + reflet sur l'arête haute
        tabbar: 'var(--shadow-float), inset 0 1px 0 var(--tabbar-highlight)',
        bubble: 'inset 0 0 0 0.5px var(--bubble-edge), 0 2px 10px rgba(0, 0, 0, 0.1)',
        // Pastille soulevée par le doigt : plus d'ombre, pour se détacher d'une piste grise
        lifted: 'inset 0 0 0 0.5px var(--bubble-edge), 0 3px 12px rgba(0, 0, 0, 0.2)',
        lift: 'var(--shadow-lift)',
        float: 'var(--shadow-float)',
        // Loupe de la barre d'onglets : arête claire, ombre interne en bas, portée douce
        lens: 'inset 0 0 0 0.5px var(--bubble-edge), inset 0 1px 1px rgba(255, 255, 255, 0.9), inset 0 -2px 6px rgba(0, 0, 0, 0.08), 0 8px 22px rgba(0, 0, 0, 0.18)',
      },
    },
  },
  plugins: [],
}
export default config
