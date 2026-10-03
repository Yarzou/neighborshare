/**
 * Constantes partagées du parcours « mot de passe oublié ».
 * Importé par proxy.ts (Edge), /auth/confirm (serveur) et la page de
 * nouveau mot de passe (client) : rien d'autre que des constantes ici.
 */

/** Posé par /auth/confirm (type=recovery), effacé par la page au succès. Non httpOnly, sans secret. */
export const PASSWORD_RESET_COOKIE = 'vdc_pwd_reset'

export const PASSWORD_RESET_PATH = '/auth/reset-password'

/** Efface le cookie côté navigateur (page de nouveau mot de passe, déconnexion). */
export function clearPasswordResetCookie() {
  document.cookie = `${PASSWORD_RESET_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`
}
