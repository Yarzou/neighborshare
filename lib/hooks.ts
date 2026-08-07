'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

/** Abonnement Realtime déclaré par un compteur. */
interface CounterWatch {
  event: 'INSERT' | 'UPDATE'
  table: string
  filter?: string
}

/** État partagé d'un compteur, pour un utilisateur donné. */
interface CounterStore {
  value: number
  listeners: Set<(value: number) => void>
  channel: RealtimeChannel | null
  /** Nombre de composants montés qui observent ce compteur. */
  refs: number
  /** Chargement en cours, réutilisé au lieu d'en lancer un second. */
  inFlight: Promise<void> | null
}

const counterStores = new Map<string, CounterStore>()

interface CurrentUserState {
  userId: string | null
  /** Référent du lotissement (`profiles.is_referent`, migration 033) */
  isReferent: boolean
  /**
   * `false` tant que la session n'est pas connue. Toujours attendre `resolved`
   * avant d'afficher un état « déconnecté » : sinon l'interface clignote pour un
   * utilisateur connecté le temps que `getUser()` réponde.
   */
  resolved: boolean
}

/**
 * Session courante + rôle référent, pour les pages qui doivent adapter leur
 * interface (bouton de publication réservé aux référents, encart de connexion).
 *
 * Ne remplace pas les policies : le RLS reste le seul verrou, ce hook ne sert
 * qu'à ne pas proposer une action qui échouerait.
 */
export function useCurrentUser(): CurrentUserState {
  const supabase = createClient()
  const [state, setState] = useState<CurrentUserState>({
    userId: null,
    isReferent: false,
    resolved: false,
  })

  useEffect(() => {
    let cancelled = false

    const load = async (uid: string | null) => {
      if (!uid) {
        if (!cancelled) setState({ userId: null, isReferent: false, resolved: true })
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_referent')
        .eq('id', uid)
        .single()
      if (!cancelled) {
        setState({ userId: uid, isReferent: data?.is_referent === true, resolved: true })
      }
    }

    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user?.id ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

/**
 * Identifiant de l'utilisateur connecté, `null` sinon.
 *
 * Base commune de `useUnreadCount` et `usePendingRequests`, sans la lecture de
 * `profiles` dont les compteurs n'ont pas besoin.
 *
 * `getSession()` et non `getUser()` : la session est lue depuis le stockage
 * local, sans appel réseau — deux hooks montés côte à côte ajoutaient sinon
 * autant d'allers-retours `/auth/v1/user` par page. L'identifiant ne sert ici
 * qu'à construire une requête dont le RLS reste l'arbitre : rien ne repose sur
 * la validité du jeton côté client. Même raisonnement que `proxy.ts`.
 */
function useUserId(): string | null {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data.session?.user?.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return userId
}

/**
 * Compteur d'application partagé entre tous les composants qui l'affichent.
 *
 * Pourquoi un magasin de module et pas un état par composant : la navbar et le
 * tableau de bord affichent **les mêmes** pastilles et sont montés en même temps
 * sur `/accueil`. Deux instances indépendantes lanceraient les mêmes requêtes en
 * double et ouvriraient deux canaux Realtime sur le même sujet — ce que le client
 * Supabase ne gère pas proprement. Ici, la première instance montée crée le canal,
 * la dernière démontée le ferme, et un chargement déjà en vol est réutilisé.
 *
 * @param key    identifie le compteur (`unread`, `pending`)
 * @param load   calcule la valeur pour un utilisateur
 * @param watches abonnements Realtime qui déclenchent un recalcul
 */
function useSharedCounter(
  key: string,
  load: (uid: string) => Promise<number>,
  watches: (uid: string) => CounterWatch[],
): number {
  const supabase = createClient()
  const pathname = usePathname()
  const userId = useUserId()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!userId) return

    const storeKey = `${key}:${userId}`
    let store = counterStores.get(storeKey)
    if (!store) {
      store = { value: 0, listeners: new Set(), channel: null, refs: 0, inFlight: null }
      counterStores.set(storeKey, store)
    }
    const current = store

    current.refs += 1
    current.listeners.add(setValue)
    // Faux positif set-state-in-effect : c'est la lecture initiale d'un magasin
    // externe au moment où l'on s'y abonne — le cas que la règle décrit comme
    // légitime — et non un état dérivé du rendu. Sans elle, un composant monté
    // après les autres afficherait 0 jusqu'au prochain rafraîchissement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(current.value)

    const refresh = () => {
      // Un rafraîchissement déjà en cours sert tout le monde : sans ça, deux
      // composants montés ensemble déclencheraient deux fois la même requête.
      if (current.inFlight) return current.inFlight
      current.inFlight = load(userId).then(next => {
        current.value = next
        current.listeners.forEach(notify => notify(next))
      }).finally(() => { current.inFlight = null })
      return current.inFlight
    }

    void refresh()

    if (!current.channel) {
      const channel = supabase.channel(`counter:${storeKey}`)
      watches(userId).forEach(w => {
        channel.on('postgres_changes',
          { event: w.event, schema: 'public', table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
          () => { void refresh() })
      })
      current.channel = channel.subscribe()
    }

    return () => {
      current.listeners.delete(setValue)
      current.refs -= 1
      if (current.refs === 0) {
        if (current.channel) supabase.removeChannel(current.channel)
        counterStores.delete(storeKey)
      }
    }
    // `pathname` : filet de sécurité si le websocket Realtime est indisponible.
  }, [userId, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dérivé plutôt que remis à zéro dans l'effet : à la déconnexion la pastille
  // doit retomber immédiatement, sans passer par un rendu supplémentaire.
  return userId ? value : 0
}

/**
 * Nombre de messages non lus, tous fils confondus — la pastille de la navbar et
 * de la tuile « Messages » du tableau de bord.
 *
 * Deux requêtes au total, quel que soit le nombre de conversations. La version
 * précédente (dupliquée dans `Navbar` et `DashboardClient`) faisait un `count`
 * par conversation, rejoué à chaque navigation.
 *
 * ⚠️ Les conversations supprimées (`deleted_at`) et l'historique antérieur à une
 * suppression (`visible_from`) sont exclus, comme le fait `MessagesClient`. Sans
 * ça la pastille comptait des messages d'un fil que l'utilisateur ne peut plus
 * ouvrir — donc un badge impossible à faire retomber.
 */
export function useUnreadCount(): number {
  const supabase = createClient()

  const load = useCallback(async (uid: string) => {
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, visible_from')
      .eq('user_id', uid)
      .is('deleted_at', null)

    if (!parts || parts.length === 0) return 0

    // Borne basse commune à toutes les conversations : le plus ancien
    // `last_read_at`. Elle permet de ne ramener que les messages susceptibles
    // d'être non lus, en une seule requête.
    const sinceMs = Math.min(...parts.map(p => new Date(p.last_read_at).getTime()))

    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', parts.map(p => p.conversation_id))
      .neq('sender_id', uid)
      .gt('created_at', new Date(sinceMs).toISOString())

    if (!msgs) return 0

    // Comparaisons en millisecondes et non lexicographiques : `visible_from` est
    // écrit côté client (`toISOString()`, suffixe « Z ») alors que les colonnes
    // de la base reviennent en « +00:00 » — deux formats qui ne se comparent pas
    // comme des chaînes.
    const cutoffs = new Map(parts.map(p => [p.conversation_id, {
      lastRead: new Date(p.last_read_at).getTime(),
      visibleFrom: p.visible_from ? new Date(p.visible_from).getTime() : null,
    }]))

    return msgs.reduce((total, m) => {
      const cutoff = cutoffs.get(m.conversation_id)
      if (!cutoff) return total
      const at = new Date(m.created_at).getTime()
      if (at <= cutoff.lastRead) return total
      if (cutoff.visibleFrom !== null && at < cutoff.visibleFrom) return total
      return total + 1
    }, 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return useSharedCounter('unread', load, uid => [
    { event: 'INSERT', table: 'messages' },
    // `mark_conversation_read` met à jour `last_read_at` : la pastille retombe
    // dès que la conversation est ouverte, sans attendre une navigation.
    { event: 'UPDATE', table: 'conversation_participants', filter: `user_id=eq.${uid}` },
  ])
}

/**
 * Nombre de demandes actives (`en_cours` + `validee`) où l'utilisateur est
 * propriétaire de l'annonce ou répondant — la pastille « Demandes ».
 */
export function usePendingRequests(): number {
  const supabase = createClient()

  const load = useCallback(async (uid: string) => {
    const [{ count: asOwner }, { count: asResponder }] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).in('status', ['en_cours', 'validee']),
      supabase.from('listings').select('id', { count: 'exact', head: true })
        .eq('responder_id', uid).in('status', ['en_cours', 'validee']),
    ])
    return (asOwner ?? 0) + (asResponder ?? 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return useSharedCounter('pending', load, uid => [
    { event: 'UPDATE', table: 'listings', filter: `user_id=eq.${uid}` },
    { event: 'UPDATE', table: 'listings', filter: `responder_id=eq.${uid}` },
  ])
}
