// Configuration ESLint « flat config » (ESLint 9+).
//
// Remplace l'ancien .eslintrc.json : `next lint` a été supprimé dans Next 16 et
// ESLint 9 n'accepte plus le format .eslintrc.
// eslint-config-next 16 exporte directement des tableaux de flat configs.
//
// Usage : npm run lint  ·  npm run lint:fix

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'public/**',
      '.idea/**',
      // Edge Functions Deno : runtime et imports par URL incompatibles avec la
      // config Next/Node — également exclues du tsconfig.json
      'supabase/functions/**',
    ],
  },

  ...nextCoreWebVitals,

  {
    rules: {
      // `react-hooks/set-state-in-effect` est apparu avec eslint-plugin-react-hooks 7
      // (règles issues du React Compiler) : il signale 16 emplacements de code
      // pré-existant, essentiellement de l'initialisation d'état côté client
      // (localStorage, navigator, session Supabase) qui ne peut pas s'évaluer au
      // rendu serveur. Passé en avertissement pour garder une base verte et rendre
      // visibles les vraies régressions ; à traiter progressivement.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default config
