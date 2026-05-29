import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Event } from '@/lib/types'
import EventDetailClient from '@/components/map/EventDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !event) notFound()

  return <EventDetailClient event={event as Event} />
}
