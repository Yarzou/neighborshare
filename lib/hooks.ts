'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
