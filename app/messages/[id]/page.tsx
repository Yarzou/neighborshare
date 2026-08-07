import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConversationClient from './ConversationClient'

/**
 * Garde d'authentification côté serveur, sur le modèle de `app/accueil/page.tsx`.
 *
 * Les cookies sont déjà lus par `proxy.ts`, la vérification est donc gratuite
 * ici — alors que le `supabase.auth.getUser()` client qu'elle remplace était un
 * aller-retour réseau sérialisé **avant** tout chargement de données, et
 * laissait un visiteur déconnecté télécharger le bundle et voir un spinner avant
 * d'être redirigé.
 *
 * La donnée, elle, reste lue côté client (CLAUDE.md §2) : une conversation est
 * vivante, abonnée au Realtime, et le composant doit de toute façon savoir la
 * recalculer.
 */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=${encodeURIComponent(`/messages/${id}`)}`)

  return <ConversationClient conversationId={id} userId={user.id} />
}
