import type { SupabaseClient } from '@supabase/supabase-js'
import type { Event } from '@/lib/types'

/**
 * Supprime un événement et ses images du bucket `events`.
 *
 * Utilisé par la page détail (`EventDetailClient`) et le popup de la liste
 * (`EventDetailPopup`) — logique volontairement partagée pour ne pas la
 * dupliquer une troisième fois (elle existe aussi, antérieure, dans
 * `ProfileClient`).
 *
 * - Pas de filtre `user_id` : c'est le RLS qui arbitre (créateur ou référent,
 *   policy 037).
 * - ⚠️ Un delete refusé par RLS ne renvoie PAS d'erreur, juste 0 ligne : le
 *   `.select()` permet de le détecter (cas notamment d'une base pas encore
 *   migrée en 037 pour un référent). Retourne `false` dans ce cas.
 * - La ligne est supprimée d'abord, les images ensuite : on ne laisse jamais un
 *   événement amputé de ses photos si le delete échoue. Un échec du nettoyage
 *   storage laisse des orphelins dans le bucket — non bloquant.
 */
export async function deleteEventWithImages(
  supabase: SupabaseClient,
  event: Pick<Event, 'id' | 'image_urls'>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', event.id)
    .select('id')

  if (error || !data || data.length === 0) return false

  const photos = event.image_urls ?? []
  if (photos.length > 0) {
    const paths = photos.map(url => url.split('/events/')[1] || '').filter(Boolean)
    if (paths.length > 0) {
      await supabase.storage.from('events').remove(paths)
    }
  }

  return true
}
