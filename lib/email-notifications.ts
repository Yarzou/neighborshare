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
        // Défauts nodemailer : 2 min. Un paquet perdu vers Gmail se traduit par
        // un décrochage TCP de ~21 s ; on coupe court et on retente une fois.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      })
    : null

/** True when GMAIL_USER / GMAIL_APP_PASSWORD are set, i.e. the app can send its own emails. */
export function isEmailConfigured(): boolean {
  return transporter !== null
}

// Erreurs de transport (connexion, socket) : une seconde tentative a du sens.
// Un refus SMTP (adresse invalide, quota) n'en a pas.
const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'EPIPE'])

/**
 * Sends an email notification via Gmail SMTP.
 * Exported so the internal API route can reuse it directly.
 * Silently no-ops if GMAIL_USER / GMAIL_APP_PASSWORD are not configured.
 * Returns true only when the message was accepted by the SMTP server — callers
 * that must know (confirmation d'inscription) check it, notifications ignore it.
 * Un envoi met ~2 s en temps normal : les routes qui répondent à un utilisateur
 * l'appellent dans `after()` plutôt que de le faire attendre.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) return false
  const message = { from: `VoisinsDuCèdre <${process.env.GMAIL_USER}>`, to, subject, html }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await transporter.sendMail(message)
      return true
    } catch (err) {
      const code = (err as { code?: string })?.code
      const retry = attempt === 1 && code !== undefined && RETRYABLE.has(code)
      console.error(`[Email] Error sending (attempt ${attempt}${retry ? ', retrying' : ''}):`, err)
      if (!retry) return false
    }
  }
  return false
}

function listingUrl(listingId: string) {
  return `${APP_URL}/listings/${listingId}`
}

function baseTemplate(
  content: string,
  footer = 'Vous pouvez gérer vos préférences de notification depuis votre profil.'
) {
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
      <p style="color:#9ca3af;font-size:12px;margin:0">${footer}</p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${label}</a>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email de confirmation d'inscription, envoyé par l'app à la place du mailer
 * intégré de Supabase (voir app/api/auth/register/route.ts).
 * `confirmUrl` pointe vers /auth/confirm, qui valide le token côté serveur.
 */
export async function sendConfirmationEmail(
  to: string,
  fullName: string,
  confirmUrl: string
): Promise<boolean> {
  const name = escapeHtml(fullName.trim()) || 'voisin'
  const html = baseTemplate(
    `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Bienvenue parmi les voisins du Cèdre 🏘️</h2>
    <p style="color:#374151;line-height:1.6">Bonjour ${name},</p>
    <p style="color:#374151;line-height:1.6">
      Il ne reste qu'une étape pour activer votre compte : confirmez votre adresse email en cliquant sur le bouton ci-dessous.
    </p>
    <p style="color:#374151;line-height:1.6">
      Ce lien est <strong>valable une heure</strong> et <strong>à usage unique</strong> : il ne fonctionnera qu'au premier clic.
      Passé ce délai, réinscrivez-vous avec les mêmes identifiants pour en recevoir un nouveau.
    </p>
    ${ctaButton(confirmUrl, 'Confirmer mon adresse email')}
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:20px">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="${confirmUrl}" style="color:#16a34a;word-break:break-all">${confirmUrl}</a>
    </p>
  `,
    "Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet email."
  )
  return sendEmail(to, 'Confirmez votre inscription aux voisins du Cèdre', html)
}

/**
 * Email « mot de passe oublié » (voir app/api/auth/forgot-password/route.ts).
 * `resetUrl` passe par /auth/confirm (type=recovery) puis /auth/reset-password.
 */
export async function sendPasswordResetEmail(
  to: string,
  fullName: string | null,
  resetUrl: string
): Promise<boolean> {
  const name = escapeHtml((fullName ?? '').trim()) || 'voisin'
  const html = baseTemplate(
    `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Renouveler votre mot de passe 🔑</h2>
    <p style="color:#374151;line-height:1.6">Bonjour ${name},</p>
    <p style="color:#374151;line-height:1.6">
      Vous avez demandé à renouveler le mot de passe de votre compte Les voisins du Cèdre.
      Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
    </p>
    <p style="color:#374151;line-height:1.6">
      Ce lien est <strong>valable une heure</strong> et <strong>à usage unique</strong> : il ne fonctionnera qu'au premier clic.
      Passé ce délai, refaites simplement une demande depuis la page de connexion.
    </p>
    ${ctaButton(resetUrl, 'Choisir un nouveau mot de passe')}
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:20px">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="${resetUrl}" style="color:#16a34a;word-break:break-all">${resetUrl}</a>
    </p>
  `,
    "Vous n'avez rien demandé ? Ignorez cet email, votre mot de passe actuel reste valable."
  )
  return sendEmail(to, 'Renouvellement de votre mot de passe — Les voisins du Cèdre', html)
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
