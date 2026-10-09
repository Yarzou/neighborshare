'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Dernières données connues des pages-onglets (Accueil, Carte, Agenda, Messages,
 * Quartier, Demandes), pour qu'un retour sur un onglet s'affiche tout de suite :
 * la page part de ce qu'elle montrait la dernière fois, puis se rafraîchit en
 * arrière-plan (stale-while-revalidate). Le premier affichage, lui, ne change pas.
 *
 * Même principe que les magasins de module de `lib/hooks.ts` : de la mémoire
 * seulement, jamais de localStorage. Un rechargement de la page repart de zéro.
 *
 * ⚠️ Tout ce qui est ici a été lu sous RLS avec la session courante : les
 * annonces, les événements et les infos du lotissement sont réservés aux comptes
 * connectés (migration 030), les messages et les demandes sont personnels. Le
 * cache est donc **vidé dès que l'utilisateur change**, déconnexion comprise, et
 * il n'accepte plus rien tant qu'on est déconnecté : une requête partie avant la
 * déconnexion et revenue après ne le remplit pas. Les clés des données
 * personnelles portent en plus l'identifiant de l'utilisateur.
 */
const entries = new Map<string, unknown>()

/** Utilisateur courant : `undefined` tant que la session n'est pas connue, `null` déconnecté. */
let owner: string | null | undefined

// Posé dès le chargement du module, donc avant la première requête d'une page.
// Le premier événement (INITIAL_SESSION) fixe l'utilisateur ; tout changement
// ensuite vide le cache. Un simple rafraîchissement de jeton garde le même
// identifiant et ne touche à rien.
if (typeof window !== 'undefined') {
  createClient().auth.onAuthStateChange((_event, session) => {
    const uid = session?.user?.id ?? null
    if (uid !== owner) entries.clear()
    owner = uid
  })
}

/**
 * Dernière valeur connue pour `key`, ou `undefined`.
 *
 * Toujours `undefined` côté serveur : ce module y est aussi évalué (rendu SSR des
 * composants client), et une `Map` de module y serait partagée entre toutes les
 * requêtes, donc entre tous les voisins. Le premier rendu reste ainsi identique
 * à celui du serveur, sans écart d'hydratation.
 */
export function readPageCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  return entries.get(key) as T | undefined
}

/** Mémorise la valeur affichée pour `key` (navigateur seulement, et pas déconnecté). */
export function writePageCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || owner === null) return
  entries.set(key, value)
}
