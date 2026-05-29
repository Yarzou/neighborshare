import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function AccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirect=/accueil')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, avatar_color')
    .eq('id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? null

  return <DashboardClient firstName={firstName} avatarUrl={profile?.avatar_url ?? null} avatarColor={profile?.avatar_color ?? null} />
}
