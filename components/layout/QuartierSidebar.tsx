'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { QUARTIER_SECTIONS } from './QuartierTabs'

/**
 * Volet gauche des pages « Quartier » sur desktop, rendu par le layout du route
 * group `app/(quartier)/` à partir de md — le pendant de la liste des
 * conversations dans Messages : un menu vertical des quatre sections, le
 * contenu occupant tout le reste de la fenêtre.
 *
 * Tokens sémantiques uniquement (`bg-surface`, `border-edge`, `text-content-*`) :
 * les classes préfixées `md:` échappent au bloc de surcharges sombres de
 * `globals.css`, les tokens basculent seuls.
 */
export function QuartierSidebar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Sections du quartier" className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-xl font-bold text-content">Quartier</h2>
        <p className="text-xs text-content-muted mt-0.5">La vie du lotissement</p>
      </div>
      <div className="flex flex-col gap-1 px-3">
        {QUARTIER_SECTIONS.map(section => {
          const active = pathname?.startsWith(section.href)
          const Icon = section.icon
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors',
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-content-soft hover:bg-surface-sunken hover:text-brand-700'
              )}
            >
              <span className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                active ? 'bg-white/15' : 'bg-surface-sunken'
              )}>
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight truncate">{section.label}</span>
                <span className={cn('block text-xs mt-0.5 truncate', active ? 'text-white/80' : 'text-content-faint')}>
                  {section.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
