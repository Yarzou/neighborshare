import { getAvatarStyle, getInitials } from '@/lib/utils'

/**
 * Pastille de compte de la Navbar (initiales, couleur, nom), gardée sur l'appareil
 * pour qu'elle s'affiche dès la réouverture de l'appli (2026-10-14). Avant, il
 * fallait attendre le JavaScript, puis la lecture de `profiles` à Dublin.
 *
 * Exception assumée au « jamais de localStorage » de `lib/pageCache.ts` : ce ne
 * sont pas des données du quartier lues sous RLS, mais le nom et la couleur du
 * voisin lui-même, sur son propre appareil. Ni adresse, ni email, ni jeton — la
 * session Supabase est de toute façon déjà lisible par le JavaScript de la page
 * (cookie). Effacée à la déconnexion, ignorée si elle appartient à un autre compte.
 *
 * Deux lecteurs :
 * - la Navbar, dès que la session est lue, sans attendre le réseau ;
 * - avant même le JavaScript, `NAV_ACCOUNT_SCRIPT` (inline dans `app/layout.tsx`,
 *   comme le script du mode sombre), qui la pose en variables CSS sur `<html>` :
 *   globals.css dessine alors l'avatar dans l'emplacement que le serveur laisse vide.
 *
 * Disparaît d'elle-même dans certains cas : Safari (navigateur, pas l'appli
 * installée) efface le stockage d'un site après 7 jours d'usage sans y passer, et
 * la navigation privée à la fermeture de l'onglet. On retombe alors sur l'attente
 * de la lecture de `profiles`, le temps d'une ouverture.
 */
export interface NavAccount {
  userId: string
  initials: string
  /** Nom du menu latéral desktop ; `null` affiche « Mon profil ». */
  name: string | null
  bg: string
  fg: string
}

/** Le strict nécessaire de `profiles` pour la pastille. */
export interface NavProfile {
  full_name: string | null
  username: string | null
  avatar_color?: string | null
}

const KEY = 'nav-account'

/** Pastille d'un compte : nom complet, sinon pseudo, sinon email. */
export function toNavAccount(userId: string, profile: NavProfile | null, email?: string): NavAccount {
  const name = profile?.full_name?.trim() || profile?.username?.trim() || null
  const { backgroundColor, color } = getAvatarStyle(profile?.avatar_color)
  return { userId, initials: getInitials(name ?? email), name, bg: backgroundColor, fg: color }
}

/** Pastille gardée pour `userId`, ou `null` (absente, illisible, autre compte). */
export function readNavAccount(userId: string): NavAccount | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NavAccount> | null
    if (!a || a.userId !== userId || typeof a.initials !== 'string' || typeof a.bg !== 'string' || typeof a.fg !== 'string') return null
    return { userId, initials: a.initials, name: typeof a.name === 'string' ? a.name : null, bg: a.bg, fg: a.fg }
  } catch {
    return null
  }
}

export function clearNavAccount(): void {
  try { localStorage.removeItem(KEY) } catch { /* stockage indisponible : rien à effacer */ }
}

// La page Profil prévient la Navbar quand le nom ou la couleur change : avant, le
// header gardait l'ancien avatar jusqu'au rechargement de la page.
const listeners = new Set<(account: NavAccount) => void>()

export function subscribeNavAccount(listener: (account: NavAccount) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Garde la pastille sur l'appareil et met la Navbar à jour. */
export function publishNavAccount(account: NavAccount): void {
  try { localStorage.setItem(KEY, JSON.stringify(account)) } catch { /* stockage indisponible : affichage seulement */ }
  listeners.forEach(notify => notify(account))
}

/**
 * Script inline, exécuté avant le premier affichage. Il exige aussi un cookie de
 * session Supabase (`sb-<projet>-auth-token`, découpé en `.0`, `.1`… quand il est
 * long) : sans cookie, pas de compte, l'emplacement reste vide jusqu'à la lecture
 * de la session. Une session révoquée ailleurs afficherait l'avatar une fraction de
 * seconde avant « Connexion » : rien n'est accessible pour autant, le RLS décide.
 *
 * Pas de barre oblique inverse dans ce script : dans un gabarit JS, `\s` deviendrait `s`.
 */
export const NAV_ACCOUNT_SCRIPT = `(function(){try{var a=JSON.parse(localStorage.getItem('${KEY}')||'null');if(!a||typeof a.initials!=='string'||!/(^|; ?)sb-[^=;]*-auth-token[.0-9]*=/.test(document.cookie))return;var r=document.documentElement,s=r.style;s.setProperty('--nav-initials',JSON.stringify(a.initials));s.setProperty('--nav-name',JSON.stringify(a.name||'Mon profil'));s.setProperty('--nav-avatar-bg',String(a.bg));s.setProperty('--nav-avatar-fg',String(a.fg));r.classList.add('nav-account');if(a.initials.length>2)r.classList.add('nav-account-xs')}catch(e){}})()`
