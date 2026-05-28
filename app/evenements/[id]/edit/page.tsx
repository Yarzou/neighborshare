import { createClient as createServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EventForm from '@/components/forms/EventForm'
import type { Event } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=/evenements/${id}/edit`)

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !event) notFound()

  return <EventForm initialEvent={event as Event} />
}
