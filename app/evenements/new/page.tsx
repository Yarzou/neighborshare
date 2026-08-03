import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EventForm from '@/components/forms/EventForm'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Garde côté serveur : sans elle le formulaire s'affichait entièrement pour un
  // visiteur déconnecté, qui n'était renvoyé au login qu'à la soumission — et
  // perdait donc sa saisie.
  if (!user) redirect('/auth/login?redirect=/evenements/new')

  return <EventForm />
}
