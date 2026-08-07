'use client'

import { useEffect } from 'react'

/**
 * Enregistre le Service Worker Firebase Messaging au chargement de l'app.
 * Doit être inclus dans le layout racine (côté client uniquement).
 *
 * ⚠️ `import()` dynamique et non import statique : ce composant est monté par
 * le layout racine, donc sur **toutes** les routes. Un import statique tirait
 * `firebase/app` + `firebase/messaging` (~44 Ko) dans le bundle partagé de
 * chaque page — y compris `/infos`, `/achats` ou `/prestataires`, qui n'ont
 * rien à voir avec le push. Le module n'est ici chargé qu'après le premier
 * rendu, hors du chemin critique.
 */
export default function FirebaseSWRegister() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { registerFirebaseSW } = await import('@/lib/firebase')
      if (!cancelled) await registerFirebaseSW()
    })()
    return () => { cancelled = true }
  }, [])

  return null
}
