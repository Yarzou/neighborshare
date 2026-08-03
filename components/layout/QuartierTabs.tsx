'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, ShoppingCart, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/infos', label: 'Vie du quartier', icon: Megaphone },
  { href: '/achats', label: 'Achats groupés', icon: ShoppingCart },
  { href: '/prestataires', label: 'Prestataires', icon: Wrench },
] as const

/**
 * Onglets communs aux trois pages « Quartier » (/infos, /achats, /prestataires),
 * rendus par le layout du route group `app/(quartier)/`.
 */
export function QuartierTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {TABS.map(tab => {
        const active = pathname?.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors',
              active
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-surface text-content-muted border-edge hover:border-brand-300 hover:text-brand-700'
            )}
          >
            <Icon size={15} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
