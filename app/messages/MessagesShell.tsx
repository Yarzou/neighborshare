'use client'

import { usePathname } from 'next/navigation'
import { cn, SIDE_PANE_WIDTH } from '@/lib/utils'
import MessagesClient from './MessagesClient'

interface Props {
  /** `null` quand la session n'est pas résolue : les pages redirigent elles-mêmes. */
  userId: string | null
  children: React.ReactNode
}

/**
 * Coquille « boîte de réception » de la section Messages.
 *
 * Desktop (md+) : la liste des conversations occupe un volet fixe de 360 px à
 * gauche, la page courante (fil ouvert, nouvelle conversation, ou l'invite
 * « Sélectionnez une conversation ») occupe le reste — plus d'aller-retour
 * entre la liste et le fil.
 *
 * Mobile : comportement d'avant, un écran à la fois. Sur `/messages` c'est le
 * volet liste qui est l'écran ; ailleurs c'est la page. La liste n'est donc
 * montée qu'UNE fois quelle que soit la largeur : `MessagesClient` porte un
 * abonnement Realtime, le monter deux fois doublerait les requêtes.
 */
export function MessagesShell({ userId, children }: Props) {
  const pathname = usePathname()
  const isIndex = pathname === '/messages'

  if (!userId) return <>{children}</>

  return (
    <div className="md:flex md:h-[var(--app-h)]">
      <aside
        className={cn(
          'md:flex md:flex-shrink-0 md:flex-col md:bg-surface-pane md:border-r md:border-edge md:overflow-hidden',
          SIDE_PANE_WIDTH,
          isIndex ? 'block' : 'hidden',
        )}
      >
        <MessagesClient userId={userId} />
      </aside>
      <main
        className={cn(
          'md:flex md:flex-1 md:min-w-0 md:flex-col md:overflow-hidden',
          isIndex ? 'hidden md:flex' : 'block',
        )}
      >
        {children}
      </main>
    </div>
  )
}
