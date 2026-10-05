'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyCancel, isPasskeyDisabled, passkeyErrorMessage, usePasskeySupport } from '@/lib/passkeys'
import { cn, formatDate } from '@/lib/utils'
import { AlertCircle, Check, ChevronDown, Fingerprint, Loader2, Trash2 } from 'lucide-react'

/** Une passkey enregistrée, telle que la renvoie `supabase.auth.passkey.list()`. */
interface PasskeyItem {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

/**
 * Ligne « Empreinte digitale ou Face ID » de la carte Paramètres du profil :
 * activation sur l'appareil courant, liste des appareils enregistrés, retrait.
 * Masquée si le navigateur ne connaît pas WebAuthn, ou si les passkeys ne sont pas
 * activées sur le projet Supabase (`passkey_disabled`).
 */
export default function PasskeySection() {
  const supabase = createClient()
  const supported = usePasskeySupport()

  const [open, setOpen] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState<string | null>(null) // 'register' ou l'id en cours de retrait
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    supabase.auth.passkey.list().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        if (isPasskeyDisabled(error)) setUnavailable(true)
        else setError(passkeyErrorMessage(error))
        setPasskeys([])
        return
      }
      setPasskeys(data ?? [])
    })
    return () => { cancelled = true }
  }, [supabase, supported])

  if (!supported || unavailable) return null

  const handleRegister = async () => {
    setBusy('register')
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.registerPasskey()
    if (error) {
      if (!isPasskeyCancel(error)) setError(passkeyErrorMessage(error))
      setBusy(null)
      return
    }

    const { data } = await supabase.auth.passkey.list()
    if (data) setPasskeys(data)
    setSuccess('Appareil enregistré : vous pouvez vous connecter sans mot de passe.')
    setBusy(null)
  }

  const handleDelete = async (passkey: PasskeyItem) => {
    const name = passkey.friendly_name || 'cet appareil'
    if (!confirm(`Retirer « ${name} » ? Il faudra de nouveau le mot de passe pour se connecter depuis cet appareil.`)) return

    setBusy(passkey.id)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id })
    if (error) setError(passkeyErrorMessage(error))
    else setPasskeys(list => (list ?? []).filter(p => p.id !== passkey.id))
    setBusy(null)
  }

  const count = passkeys?.length ?? 0
  const subtitle = count > 0
    ? `Activée sur ${count} appareil${count > 1 ? 's' : ''}`
    : 'Connexion sans mot de passe'

  return (
    <div className="border-b border-edge">
      <button
        onClick={() => { setOpen(o => !o); setError(null); setSuccess(null) }}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-surface-sunken transition-colors"
      >
        <span className="flex items-start gap-3">
          <Fingerprint size={17} className="text-content-faint mt-0.5 flex-shrink-0" />
          <span>
            <span className="block text-sm font-medium text-content">Empreinte digitale ou Face ID</span>
            <span className="block text-xs text-content-faint">{subtitle}</span>
          </span>
        </span>
        <ChevronDown size={16} className={cn('text-content-faint transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-6 pb-5 flex flex-col gap-3">
          <p className="text-xs text-content-muted">
            Connectez-vous avec le déverrouillage de votre téléphone ou de votre ordinateur.
            Votre empreinte et votre visage restent sur l&apos;appareil : le site ne les reçoit jamais.
          </p>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-100 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">
              <Check size={13} className="flex-shrink-0" /> {success}
            </div>
          )}

          {passkeys === null ? (
            <Loader2 size={16} className="animate-spin text-content-faint" />
          ) : passkeys.length === 0 ? (
            <p className="text-xs text-content-faint">Aucun appareil enregistré.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {passkeys.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-content truncate">{p.friendly_name || 'Appareil sans nom'}</p>
                    <p className="text-xs text-content-faint">
                      Ajouté : {formatDate(p.created_at)}
                      {p.last_used_at && <> · Dernière connexion : {formatDate(p.last_used_at)}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={busy !== null}
                    className="flex items-center gap-1 text-xs text-content-muted hover:text-red-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={handleRegister}
            disabled={busy !== null || passkeys === null}
            className="mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {busy === 'register' ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
            Activer sur cet appareil
          </button>
        </div>
      )}
    </div>
  )
}
