import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Event } from '@/lib/types'
import EventDetailClient from '@/components/map/EventDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Lecture réservée aux authentifiés (migration 030) : sans cette garde un
  // visiteur déconnecté verrait un 404 trompeur au lieu d'être invité à se connecter.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=/evenements/${id}`)

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !event) notFound()

  return <EventDetailClient event={event as Event} />
}
