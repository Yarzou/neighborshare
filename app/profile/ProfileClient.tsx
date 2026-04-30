'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Listing } from '@/lib/types'
import { LISTING_TYPE_LABELS, LISTING_TYPE_COLORS } from '@/lib/types'
import { getCategoryEmoji } from '@/lib/categories'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getAvatarStyle, DEFAULT_AVATAR_COLOR } from '@/lib/utils'
import {
  Package, Pencil, Trash2, Edit2,
  Check, X, Loader2, AlertCircle, Plus,
  Lock, ShieldAlert, Eye, EyeOff, Bell, Mail, ChevronDown,
} from 'lucide-react'
import { isPushSupported, activatePushNotifications, deactivatePushNotifications } from '@/lib/pushNotifications'

const AVATAR_COLORS = [
  '#dcfce7', // vert (défaut)
  '#dbeafe', // bleu
  '#f3e8ff', // violet
  '#fce7f3', // rose
  '#fef2f2', // rouge clair
  '#ffedd5', // orange
  '#fef9c3', // jaune
  '#e0f2fe', // cyan
  '#f1f5f9', // gris
]

/** Retourne la couleur de texte (noir ou blanc) selon la luminosité du fond hex */
function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a3c2a' : '#ffffff'
}

export default function ProfileClient() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ full_name: '', username: '', bio: '', avatar_color: DEFAULT_AVATAR_COLOR })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Listings accordion
  const [listingsOpen, setListingsOpen] = useState(false)

  // Password change
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  // Account deletion
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  // Notifications
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailSaving, setEmailSaving] = useState(false)
  const [pushSaving, setPushSaving] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSupported, setPushSupported] = useState(true)

  useEffect(() => {
    setPushSupported(isPushSupported())
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login?redirect=%2Fprofile')
        return
      }

      const uid = user.id
      setUserId(uid)

      const [{ data: prof }, { data: lists }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('listings').select('*, categories(*)').eq('user_id', uid).order('created_at', { ascending: false }),
      ])

      if (prof) {
        setProfile(prof as Profile)
        setForm({ full_name: prof.full_name || '', username: prof.username || '', bio: prof.bio || '', avatar_color: prof.avatar_color || DEFAULT_AVATAR_COLOR })
        setEmailEnabled(prof.email_notifications_enabled ?? true)
        setPushEnabled(prof.push_notifications_enabled ?? true)
      }
      setListings((lists || []) as Listing[])
      setPageLoading(false)
    }
    load()
  }, [])

  const handleSaveProfile = async () => {
    if (!form.username.trim() || !userId) return
    setSaving(true)
    setSaveError(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim() || null,
        username: form.username.trim(),
        bio: form.bio.trim() || null,
        avatar_color: form.avatar_color,
      })
      .eq('id', userId)

    if (error) {
      setSaveError(error.message)
    } else {
      setProfile(p => p ? ({
        ...p,
        full_name: form.full_name.trim() || null,
        username: form.username.trim(),
        bio: form.bio.trim() || null,
        avatar_color: form.avatar_color,
      }) : p)
      setEditMode(false)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!userId) return
    setDeletingId(id)
    setDeleteError(null)
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      setDeleteError('Erreur lors de la suppression.')
    } else {
      setListings(l => l.filter(x => x.id !== id))
      setConfirmDeleteId(null)
    }
    setDeletingId(null)
  }

  const handleChangePassword = async () => {
    setPwdError(null)
    setPwdSuccess(false)
    if (!pwdForm.next || pwdForm.next !== pwdForm.confirm) {
      setPwdError('Les mots de passe ne correspondent pas.')
      return
    }
    if (pwdForm.next.length < 6) {
      setPwdError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setPwdSaving(true)

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const email = authUser?.email
    if (!email) { setPwdError('Impossible de récupérer votre email.'); setPwdSaving(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pwdForm.current })
    if (signInError) { setPwdError('Mot de passe actuel incorrect.'); setPwdSaving(false); return }

    const { error: updateError } = await supabase.auth.updateUser({ password: pwdForm.next })
    if (updateError) {
      setPwdError(updateError.message)
    } else {
      setPwdSuccess(true)
      setPwdForm({ current: '', next: '', confirm: '' })
      setTimeout(() => { setPwdOpen(false); setPwdSuccess(false) }, 2000)
    }
    setPwdSaving(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteAccountError(null)
    setDeletingAccount(true)
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setDeleteAccountError(data.error || 'Erreur lors de la suppression.')
      setDeletingAccount(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleEmailToggle = async (enabled: boolean) => {
    setEmailEnabled(enabled)
    setEmailSaving(true)
    await supabase.from('profiles').update({ email_notifications_enabled: enabled }).eq('id', userId!)
    setEmailSaving(false)
  }

  const handlePushToggle = async (enabled: boolean) => {
    setPushError(null)
    setPushSaving(true)
    if (enabled) {
      try {
        await activatePushNotifications(userId!, supabase)
        setPushEnabled(true)
      } catch (err) {
        setPushError(err instanceof Error ? err.message : "Erreur lors de l'activation des notifications push.")
        setPushSaving(false)
        return
      }
    } else {
      try { await deactivatePushNotifications(userId!, supabase) } catch { /* continue */ }
      setPushEnabled(false)
    }
    setPushSaving(false)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setSaveError(null)
    setForm({
      full_name: profile?.full_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      avatar_color: profile?.avatar_color || DEFAULT_AVATAR_COLOR,
    })
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (!profile) return null

  const displayName = profile.full_name || profile.username
  const initials = displayName?.[0]?.toUpperCase() || '?'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

      {/* ── Hero ── */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        {!editMode ? (
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl select-none"
              style={getAvatarStyle(profile.avatar_color)}
            >
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-400">@{profile.username}</p>
              {profile.bio && (
                <p className="text-sm text-gray-500 mt-1.5 leading-snug max-w-xs mx-auto">{profile.bio}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-medium">
                <Package size={12} />
                {listings.length} annonce{listings.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Pencil size={14} /> Modifier le profil
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-gray-800">Modifier le profil</h2>
            {saveError && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                <AlertCircle size={13} /> {saveError}
              </div>
            )}

            {/* Aperçu avatar + palette */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl select-none"
                style={getAvatarStyle(form.avatar_color)}
              >
                {initials}
              </div>
              <div>
                <p className="text-xs text-gray-500 text-center mb-2">Couleur de fond</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, avatar_color: color }))}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      style={{ backgroundColor: color, outline: form.avatar_color === color ? `2px solid #16a34a` : undefined, outlineOffset: '2px' }}
                      title={color}
                    >
                      {form.avatar_color === color && (
                        <Check size={14} style={{ color: getTextColor(color) }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom complet</label>
              <input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Jean Dupont"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pseudo *</label>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="jean_dupont"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={2}
                placeholder="Quelques mots sur vous…"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={cancelEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                <X size={14} /> Annuler
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving || !form.username.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mes annonces ── */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-gray-100">
          <button
            onClick={() => setListingsOpen(o => !o)}
            className="flex-1 flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Package size={17} className="text-brand-600 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800">
                Mes annonces
                {listings.length > 0 && (
                  <span className="ml-2 text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    {listings.length}
                  </span>
                )}
              </span>
            </span>
            <ChevronDown size={16} className={cn('text-gray-400 transition-transform', listingsOpen && 'rotate-180')} />
          </button>
          <Link
            href="/listings/new"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 px-3 py-1.5 mr-4 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors flex-shrink-0"
          >
            <Plus size={14} /> Publier
          </Link>
        </div>

        {listingsOpen && (
          <div className="p-4 flex flex-col gap-3">
            {deleteError && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">
                <AlertCircle size={14} /> {deleteError}
              </div>
            )}

            {listings.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Package size={36} className="mx-auto mb-2 opacity-20" />
                <p className="font-medium">Vous n&apos;avez pas encore d&apos;annonces</p>
                <Link href="/listings/new" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                  <Plus size={13} /> Publier ma première annonce
                </Link>
              </div>
            ) : (
              listings.map(listing => (
                <div key={listing.id} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                      {listing.image_url ? (
                        <Image src={listing.image_url} alt={listing.title} width={64} height={64} className="object-cover w-full h-full" />
                      ) : (
                        getCategoryEmoji(listing.category_id)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900 line-clamp-1">{listing.title}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${LISTING_TYPE_COLORS[listing.type]}`}>
                          {LISTING_TYPE_LABELS[listing.type]}
                        </span>
                      </div>
                      {listing.city && <p className="text-xs text-gray-400 mt-0.5">{listing.city}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(listing.created_at)}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 flex">
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border-r border-gray-100"
                    >
                      <Edit2 size={14} /> Modifier
                    </Link>

                    {confirmDeleteId === listing.id ? (
                      <div className="flex-1 flex items-center justify-center gap-3 py-2.5 bg-red-50">
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                          Annuler
                        </button>
                        <button
                          onClick={() => handleDelete(listing.id)}
                          disabled={deletingId === listing.id}
                          className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          {deletingId === listing.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Confirmer
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(listing.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Paramètres ── */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Paramètres</h2>
        </div>

        {/* Notifications email */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <Mail size={17} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Notifications par email</p>
              <p className="text-xs text-gray-400">Nouvelles annonces et messages</p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={emailEnabled}
            disabled={emailSaving}
            onClick={() => handleEmailToggle(!emailEnabled)}
            className={cn(
              'relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-400',
              emailEnabled ? 'bg-brand-600' : 'bg-gray-200',
              emailSaving && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn(
              'inline-block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5',
              emailEnabled ? 'translate-x-5' : 'translate-x-0.5',
            )} />
            {emailSaving && <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />}
          </button>
        </div>

        {/* Notifications push */}
        <div className="flex flex-col border-b border-gray-100">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-start gap-3">
              <Bell size={17} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Notifications push</p>
                <p className="text-xs text-gray-400">
                  {pushSupported ? 'Sur cet appareil (navigateur / PWA)' : 'Non supporté sur ce navigateur'}
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={pushEnabled}
              disabled={pushSaving || !pushSupported}
              onClick={() => handlePushToggle(!pushEnabled)}
              className={cn(
                'relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-400',
                pushEnabled ? 'bg-brand-600' : 'bg-gray-200',
                (pushSaving || !pushSupported) && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className={cn(
                'inline-block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5',
                pushEnabled ? 'translate-x-5' : 'translate-x-0.5',
              )} />
              {pushSaving && <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />}
            </button>
          </div>
          {pushError && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mx-6 mb-3">
              <AlertCircle size={13} /> {pushError}
            </div>
          )}
        </div>

        {/* Changer le mot de passe */}
        <div>
          <button
            onClick={() => { setPwdOpen(o => !o); setPwdError(null); setPwdSuccess(false) }}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Lock size={17} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800">Changer le mot de passe</span>
            </span>
            <ChevronDown size={16} className={cn('text-gray-400 transition-transform', pwdOpen && 'rotate-180')} />
          </button>

          {pwdOpen && (
            <div className="px-6 pb-5 flex flex-col gap-3 border-t border-gray-100">
              {pwdError && (
                <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-3">
                  <AlertCircle size={13} /> {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 mt-3">
                  <Check size={13} /> Mot de passe mis à jour !
                </div>
              )}
              {[
                { key: 'current' as const, label: 'Mot de passe actuel' },
                { key: 'next' as const, label: 'Nouveau mot de passe' },
                { key: 'confirm' as const, label: 'Confirmer le nouveau mot de passe' },
              ].map(({ key, label }) => (
                <div key={key} className={key === 'current' ? 'mt-3' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={pwdForm[key]}
                      onChange={e => setPwdForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-9 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    {key === 'current' && (
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={handleChangePassword}
                disabled={pwdSaving || !pwdForm.current || !pwdForm.next || !pwdForm.confirm}
                className="mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Mettre à jour le mot de passe
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Supprimer le compte ── */}
      <div className="bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden">
        <button
          onClick={() => { setDeleteAccountOpen(o => !o); setDeleteConfirmText(''); setDeleteAccountError(null) }}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-red-50 transition-colors"
        >
          <span className="flex items-center gap-3 font-semibold text-red-600">
            <ShieldAlert size={17} /> Supprimer mon compte
          </span>
          <ChevronDown size={16} className={cn('text-red-300 transition-transform', deleteAccountOpen && 'rotate-180')} />
        </button>

        {deleteAccountOpen && (
          <div className="px-6 pb-5 border-t border-red-100">
            <p className="text-sm text-gray-500 mt-4 mb-3 leading-relaxed">
              Cette action est <strong>irréversible</strong>. Toutes vos annonces, messages et données seront définitivement supprimés.
              <br />Pour confirmer, tapez <span className="font-mono font-bold text-red-600">SUPPRIMER</span> ci-dessous.
            </p>
            {deleteAccountError && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-3">
                <AlertCircle size={13} /> {deleteAccountError}
              </div>
            )}
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full px-3 py-2.5 rounded-xl border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText !== 'SUPPRIMER'}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deletingAccount ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Supprimer définitivement mon compte
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

