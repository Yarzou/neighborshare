'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { fetchUnreadCount, createDebouncedRefresh } from '@/lib/messaging'

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
  /** Horodatage du dernier chargement abouti, pour le TTL de fraîcheur. */
  lastLoadedAt: number
}

/**
 * Au-delà de ce délai, un changement de page relance un comptage ; en deçà, la
 * valeur du magasin est considérée à jour. Voir le commentaire de l'effet de
 * `useSharedCounter` : `pathname` est un filet de secours, pas un mécanisme de
 * rafraîchissement.
 */
const COUNTER_TTL_MS = 30_000

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

const UNRESOLVED: CurrentUserState = { userId: null, isReferent: false, resolved: false }

/**
 * Magasin de module, même principe que `counterStores` : un seul chargement et
 * un seul abonnement `onAuthStateChange` pour toutes les instances montées.
 */
const currentUserStore: {
  state: CurrentUserState
  listeners: Set<(s: CurrentUserState) => void>
  subscription: { unsubscribe: () => void } | null
  refs: number
  inFlight: Promise<void> | null
} = { state: UNRESOLVED, listeners: new Set(), subscription: null, refs: 0, inFlight: null }

function publishCurrentUser(next: CurrentUserState) {
  currentUserStore.state = next
  currentUserStore.listeners.forEach(notify => notify(next))
}

/**
 * Session courante + rôle référent, pour les pages qui doivent adapter leur
 * interface (bouton de publication réservé aux référents, encart de connexion).
 *
 * Ne remplace pas les policies : le RLS reste le seul verrou, ce hook ne sert
 * qu'à ne pas proposer une action qui échouerait.
 *
 * ⚠️ Deux corrections de coût, toutes deux déjà présentes ailleurs dans ce
 * fichier et qui manquaient ici :
 *
 *  1. **Magasin partagé** plutôt qu'un état par instance. `EventActions` appelle
 *     ce hook, et il est rendu DANS un `.map()` (`ProfileClient`, accordéon
 *     « Mes événements ») : avec N événements, c'était 2N requêtes rigoureusement
 *     identiques, plus N écouteurs qui rejouaient tous la requête `profiles` au
 *     prochain rafraîchissement de jeton.
 *  2. **`getSession()` et non `getUser()`** — lecture du stockage local, sans
 *     appel réseau, pour la raison déjà écrite au-dessus de `useUserId`.
 *     L'identifiant ne sert qu'à construire une requête dont le RLS reste
 *     l'arbitre : rien ne repose ici sur la validité du jeton côté client.
 */
export function useCurrentUser(): CurrentUserState {
  const supabase = createClient()
  const [state, setState] = useState<CurrentUserState>(currentUserStore.state)

  useEffect(() => {
    const store = currentUserStore
    store.refs += 1
    store.listeners.add(setState)
    // Lecture initiale d'un magasin externe au moment où l'on s'y abonne — même
    // faux positif que dans `useSharedCounter`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(store.state)

    const load = (uid: string | null) => {
      if (!uid) {
        publishCurrentUser({ userId: null, isReferent: false, resolved: true })
        return Promise.resolve()
      }
      if (store.inFlight) return store.inFlight
      // `Promise.resolve(...)` : le constructeur de requête Supabase est un
      // `PromiseLike`, il n'expose pas `.finally()`.
      store.inFlight = Promise.resolve(
        supabase.from('profiles').select('is_referent').eq('id', uid).single(),
      )
        .then(({ data }) => {
          publishCurrentUser({ userId: uid, isReferent: data?.is_referent === true, resolved: true })
        })
        .finally(() => { store.inFlight = null })
      return store.inFlight
    }

    if (!store.state.resolved) {
      void supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null))
    }

    if (!store.subscription) {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => {
        const uid = session?.user?.id ?? null
        // Un simple rafraîchissement de jeton ne change pas le rôle : ne relance
        // la lecture de `profiles` que si l'utilisateur a réellement changé.
        if (uid === store.state.userId && store.state.resolved) return
        void load(uid)
      })
      store.subscription = data.subscription
    }

    return () => {
      store.listeners.delete(setState)
      store.refs -= 1
      if (store.refs === 0) {
        store.subscription?.unsubscribe()
        store.subscription = null
        // L'état est conservé : une remontée du hook sur la page suivante
        // réaffiche immédiatement la bonne valeur, sans requête ni clignotement.
      }
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
      store = { value: 0, listeners: new Set(), channel: null, refs: 0, inFlight: null, lastLoadedAt: 0 }
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
        current.lastLoadedAt = Date.now()
        current.listeners.forEach(notify => notify(next))
      }).finally(() => { current.inFlight = null })
      return current.inFlight
    }

    // Premier montage : `lastLoadedAt` vaut 0, le chargement a toujours lieu.
    // Navigations suivantes : on ne recompte que si la valeur a vieilli — le
    // websocket Realtime la tient à jour entre-temps, et `pathname` n'est là
    // qu'au cas où il serait indisponible. Sans ce garde-fou, chaque clic dans
    // la navbar coûtait un comptage complet par pastille.
    if (Date.now() - current.lastLoadedAt > COUNTER_TTL_MS) void refresh()

    // Regroupe les rafales : cinq messages reçus d'affilée ne déclenchent qu'un
    // recomptage, là où `refresh()` en enchaînait un par événement.
    const refresher = createDebouncedRefresh(refresh, 400)

    if (!current.channel) {
      const channel = supabase.channel(`counter:${storeKey}`)
      watches(userId).forEach(w => {
        channel.on('postgres_changes',
          { event: w.event, schema: 'public', table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
          () => { refresher.schedule() })
      })
      current.channel = channel.subscribe()
    }

    return () => {
      refresher.cancel()
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
 * Une seule requête, calculée en base (`unread_message_count`, migration 039).
 * La version précédente en faisait deux, dont un `select` sur `messages` borné
 * par le plus ancien `last_read_at` de toutes les conversations — c'est-à-dire,
 * en pratique, non borné. Sur CHAQUE page, puisque la navbar est dans le layout
 * racine. Ce corps-là survit dans `lib/messaging.ts` comme repli tant que la
 * migration n'est pas appliquée.
 *
 * ⚠️ Les conversations supprimées (`deleted_at`) et l'historique antérieur à une
 * suppression (`visible_from`) sont exclus, comme le fait `MessagesClient`. Sans
 * ça la pastille comptait des messages d'un fil que l'utilisateur ne peut plus
 * ouvrir — donc un badge impossible à faire retomber.
 */
export function useUnreadCount(): number {
  const supabase = createClient()

  const load = useCallback(
    (uid: string) => fetchUnreadCount(supabase, uid),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return useSharedCounter('unread', load, uid => [
    // `sender_id=neq` : ses propres messages ne peuvent pas créer de non-lu.
    // Sans ce filtre, chaque message ENVOYÉ déclenchait un recomptage complet —
    // le pire moment, puisqu'il arrive au milieu d'une frappe active.
    { event: 'INSERT', table: 'messages', filter: `sender_id=neq.${uid}` },
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
