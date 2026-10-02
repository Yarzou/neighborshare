import { createClient } from '@/lib/supabase/server'
import PushNotificationBanner from '@/components/layout/PushNotificationBanner'
import { MessagesShell } from './MessagesShell'

/**
 * Layout de la section Messages.
 *
 * 1. `MessagesShell` : la boîte de réception à deux volets sur desktop (liste à
 *    gauche, fil à droite), un écran à la fois sur mobile. La session est
 *    résolue ici, côté serveur, comme dans les `page.tsx` de la section — les
 *    cookies sont déjà lus par `proxy.ts`, la vérification est gratuite. Sans
 *    session, la coquille rend la page seule et c'est elle qui redirige.
 *
 * 2. Portée réelle de la bannière d'activation des notifications : elle était
 *    montée par le layout racine, donc sur toutes les routes, alors que son
 *    effet s'interrompt immédiatement hors de `/messages`.
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <MessagesShell userId={user?.id ?? null}>{children}</MessagesShell>
      <PushNotificationBanner />
    </>
  )
}
