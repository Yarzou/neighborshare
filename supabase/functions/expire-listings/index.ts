// Supabase Edge Function — expire-listings
// Schedule: daily via Supabase Cron (e.g. "0 2 * * *")
// Marks listings as 'termine' when their expires_at is in the past.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('listings')
    .update({ status: 'termine' })
    .eq('status', 'disponible')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('expire-listings error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`expire-listings: ${data?.length ?? 0} listing(s) expired`)
  return new Response(JSON.stringify({ expired: data?.length ?? 0 }), { status: 200 })
})
