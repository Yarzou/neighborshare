import { redirect } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * `/messages` : la liste des conversations est rendue par `MessagesShell`
 * (layout de la section), sur mobile comme sur desktop. Cette page n'a donc
 * plus qu'un rôle : la garde d'authentification, et l'invite affichée dans le
 * volet de droite sur desktop tant qu'aucun fil n'est ouvert (le layout masque
 * ce volet sur mobile).
 */
export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=%2Fmessages')

  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6 bg-gray-50">
      <MessageCircle size={44} className="mb-3 opacity-20" />
      <p className="font-medium text-gray-500">Sélectionnez une conversation</p>
      <p className="text-sm mt-1">Elle s&apos;ouvrira ici, à côté de la liste.</p>
    </div>
  )
}
