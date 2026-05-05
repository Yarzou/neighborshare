import nodemailer from 'nodemailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      })
    : null

/**
 * Sends an email notification via Gmail SMTP.
 * Exported so the internal API route can reuse it directly.
 * Silently no-ops if GMAIL_USER / GMAIL_APP_PASSWORD are not configured.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) return
  try {
    await transporter.sendMail({
      from: `VoisinsDuCèdre <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[Email] Error sending:', err)
  }
}

function listingUrl(listingId: string) {
  return `${APP_URL}/listings/${listingId}`
}

function baseTemplate(content: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:#16a34a;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:700">🌿 VoisinsDuCèdre</span>
    </div>
    <div style="padding:28px">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px;margin:0">Vous pouvez gérer vos préférences de notification depuis votre profil.</p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${label}</a>`
}

export async function sendNewRequestEmail(
  ownerEmail: string,
  ownerName: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  const url = listingUrl(listingId)
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Nouvelle demande de prêt 🎉</h2>
    <p style="color:#374151;line-height:1.6">Bonjour ${ownerName},</p>
    <p style="color:#374151;line-height:1.6">
      Quelqu'un est intéressé par votre annonce <strong>${listingTitle}</strong> et vous a envoyé un message.
    </p>
    <p style="color:#374151;line-height:1.6">Connectez-vous pour lire la demande et y répondre.</p>
    ${ctaButton(url, 'Voir la demande')}
  `)
  await sendEmail(ownerEmail, `Nouvelle demande pour « ${listingTitle} »`, html)
}

export async function sendAcceptedEmail(
  responderEmail: string,
  responderName: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  const url = listingUrl(listingId)
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Votre demande a été acceptée ✅</h2>
    <p style="color:#374151;line-height:1.6">Bonjour ${responderName},</p>
    <p style="color:#374151;line-height:1.6">
      Bonne nouvelle ! Votre demande pour <strong>${listingTitle}</strong> a été <strong>acceptée</strong> par le propriétaire.
    </p>
    <p style="color:#374151;line-height:1.6">Retrouvez les détails en cliquant ci-dessous.</p>
    ${ctaButton(url, 'Voir l\'annonce')}
  `)
  await sendEmail(responderEmail, `Votre demande pour « ${listingTitle} » a été acceptée`, html)
}

export async function sendRefusedEmail(
  responderEmail: string,
  responderName: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  const url = `${APP_URL}/map`
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Votre demande n'a pas été retenue</h2>
    <p style="color:#374151;line-height:1.6">Bonjour ${responderName},</p>
    <p style="color:#374151;line-height:1.6">
      Malheureusement, votre demande pour <strong>${listingTitle}</strong> n'a pas pu être accordée cette fois-ci.
    </p>
    <p style="color:#374151;line-height:1.6">D'autres annonces de vos voisins vous attendent peut-être !</p>
    ${ctaButton(url, 'Explorer les annonces')}
  `)
  await sendEmail(responderEmail, `Votre demande pour « ${listingTitle} »`, html)
}

export async function sendCancelledEmail(
  ownerEmail: string,
  ownerName: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  const url = listingUrl(listingId)
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Demande annulée</h2>
    <p style="color:#374151;line-height:1.6">Bonjour ${ownerName},</p>
    <p style="color:#374151;line-height:1.6">
      La demande de prêt pour votre annonce <strong>${listingTitle}</strong> a été annulée par le demandeur.
    </p>
    <p style="color:#374151;line-height:1.6">Votre annonce est à nouveau disponible.</p>
    ${ctaButton(url, 'Voir l\'annonce')}
  `)
  await sendEmail(ownerEmail, `Demande annulée pour « ${listingTitle} »`, html)
}
