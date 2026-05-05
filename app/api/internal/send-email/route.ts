import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email-notifications'

/**
 * Internal email proxy — called by Supabase Edge Functions.
 * Secured by the INTERNAL_EMAIL_SECRET header to prevent public abuse.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_EMAIL_SECRET
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.to || !body?.subject || !body?.html) {
    return NextResponse.json({ error: 'Missing fields: to, subject, html' }, { status: 400 })
  }

  await sendEmail(body.to, body.subject, body.html)
  return NextResponse.json({ ok: true })
}
