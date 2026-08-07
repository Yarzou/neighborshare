import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MessagesClient from './MessagesClient'

/**
 * Garde d'authentification côté serveur — voir `app/messages/[id]/page.tsx`
 * pour le raisonnement. Seule la session est résolue ici ; la liste des
 * conversations reste chargée par le client, qui doit de toute façon savoir la
 * recalculer à chaque événement Realtime.
 */
export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=%2Fmessages')

  return <MessagesClient userId={user.id} />
}
