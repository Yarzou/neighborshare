'use client'

import { useEffect } from 'react'
import { registerFirebaseSW } from '@/lib/firebase'

/**
 * Enregistre le Service Worker Firebase Messaging au chargement de l'app.
 * Doit être inclus dans le layout racine (côté client uniquement).
 */
export default function FirebaseSWRegister() {
  useEffect(() => {
    registerFirebaseSW()
  }, [])

  return null
}
