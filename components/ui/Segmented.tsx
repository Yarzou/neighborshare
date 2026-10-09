'use client'

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import GlassLens from '@/components/ui/GlassLens'
import { useLoupe } from '@/components/ui/useLoupe'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  ariaLabel?: string
  /** Segment-lien : il ouvre une page au lieu d'appeler `onChange` (onglets du Quartier). */
  href?: string
  /** Icône au-dessus du libellé, verte sur le segment choisi */
  icon?: LucideIcon
  /** Pastille de compteur après le libellé (rien si 0) */
  badge?: number
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  /** Appelé au choix d'un segment-bouton ; inutile si tous les segments sont des liens. */
  onChange?: (value: T) => void
  /** Libellé du groupe pour les lecteurs d'écran. */
  label: string
  className?: string
  /** Classes de chaque segment (hauteur, taille du texte). */
  itemClassName?: string
  style?: CSSProperties
}

/** Marge intérieure du contrôle (p-0.5) et écart entre segments (gap-0.5), en px. */
const INSET = 2
const GAP = 2
/** La loupe dépasse la pastille de 6 px de chaque côté, soit 4 px au-delà du contrôle. */
const GROW = 6

/**
 * Contrôle segmenté iOS 26, celui de l'app Fridge (2026-10-09, même loupe que la
 * barre d'onglets) : capsule grise, segment choisi en relief blanc. Le relief est
 * une pastille qui se déplace, comme la bulle de la barre d'onglets :
 * - doigt posé, elle se soulève en loupe de verre clair, plus grande que le
 *   contrôle (GlassLens) : elle rejoint le doigt, le suit d'un segment à
 *   l'autre et agrandit les libellés qu'elle couvre ;
 * - au lâcher, elle se pose sur le segment touché, ou sur le plus proche après
 *   un glissé, en s'étirant comme une goutte, et ce segment est choisi.
 *
 * Un segment peut être un **lien** (`href`, onglets du Quartier) : la pastille part
 * alors tout de suite vers lui, sans attendre la page. Il peut aussi porter une
 * icône et une pastille de compteur.
 * Le défilement vertical de la page reste libre (`touch-pan-y`) : s'il prend le
 * geste, rien n'est choisi. Avec « Réduire les animations », la pastille se
 * déplace sans effet.
 */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  itemClassName = 'h-[30px] text-[13px]',
  style,
}: SegmentedProps<T>) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  const { lens, grab, follow, drop } = useLoupe()
  // Largeur et hauteur du contrôle, mesurées quand le doigt se pose
  const [span, setSpan] = useState(0)
  const [height, setHeight] = useState(0)
  // La goutte ne se déforme qu'après un premier geste, pas à l'affichage
  const [touched, setTouched] = useState(false)
  // Segment-lien touché : la pastille y va avant que la page ne change `value`
  const [pending, setPending] = useState<{ index: number; from: T } | null>(null)

  const count = options.length
  const current = options.findIndex(option => option.value === value)
  const index = pending && pending.from === value ? pending.index : current
  const segmentWidth = (width: number) => (width - INSET * 2 - GAP * (count - 1)) / count
  const segmentAt = (x: number, width: number) =>
    Math.min(count - 1, Math.max(0, Math.floor((x - INSET + GAP / 2) / (segmentWidth(width) + GAP))))
  const localX = (clientX: number) => clientX - rootRef.current!.getBoundingClientRect().left

  /**
   * Choix d'un segment. Un segment-lien : la pastille y part, et c'est le lien
   * qui navigue au toucher (`navigate` faux), nous au lâcher d'un glissé.
   */
  const choose = (i: number, navigate: boolean) => {
    setTouched(true)
    const option = options[i]
    if (option.href) {
      setPending({ index: i, from: value })
      if (navigate && i !== current) router.push(option.href)
    } else if (i !== current) {
      onChange?.(option.value)
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    setTouched(true)
    // La loupe part de la pastille du segment choisi pour rejoindre le doigt.
    const { width, height: h } = rootRef.current!.getBoundingClientRect()
    const x = localX(e.clientX)
    const w = segmentWidth(width)
    const start = index >= 0 ? index : segmentAt(x, width)
    setSpan(width)
    setHeight(h)
    grab({ center: INSET + start * (w + GAP) + w / 2, width: w }, { center: x, width: w })
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging && Math.abs(e.clientX - g.startX) >= 8) {
      g.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    follow({ center: localX(e.clientX), width: segmentWidth(span) })
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    drop()
    if (!g) return
    if (g.dragging) {
      swallowClick.current = true
      choose(segmentAt(localX(e.clientX), span), true)
      return
    }
    // Simple toucher : le segment est choisi dès le lâcher, la pastille y part
    // sans détour. Le clic qui suit n'a plus rien à faire, sauf sur un lien :
    // c'est lui qui ouvre la page.
    const segment = (e.target as Element).closest<HTMLElement>('[data-segment]')
    if (!segment) return
    const i = Number(segment.dataset.segment)
    if (!options[i].href) swallowClick.current = true
    choose(i, false)
  }

  // Le navigateur a pris le geste (défilement) : rien n'est choisi
  const onPointerCancel = () => {
    gesture.current = null
    drop()
  }

  const lifted = lens !== null && span > 0
  const shown = lifted ? segmentAt(lens.center, span) : index
  // Au repos, la pastille se place en pourcentages (aucune mesure) ; doigt
  // posé, elle est centrée sous le doigt, sans sortir du contrôle, et cachée
  // sous la loupe, qu'elle suit pour partir de là au lâcher.
  let thumb: CSSProperties = {
    width: `calc((100% - ${INSET * 2 + GAP * (count - 1)}px) / ${count})`,
    transform: `translateX(calc(${index} * (100% + ${GAP}px)))`,
  }
  let left = 0
  if (lifted) {
    left = Math.min(Math.max(lens.center - lens.width / 2, INSET), span - INSET - lens.width)
    thumb = { width: lens.width, transform: `translateX(${left - INSET}px)` }
  }

  const itemClasses = (option: SegmentedOption<T>, active: boolean) => cn(
    'relative min-w-0 rounded-full px-1 text-gray-900 flex items-center justify-center',
    option.icon && 'flex-col gap-1',
    active && 'font-semibold',
    itemClassName,
  )

  const content = (option: SegmentedOption<T>, active: boolean): ReactNode => {
    const Icon = option.icon
    return (
      <>
        {Icon && <Icon size={16} aria-hidden="true" className={cn('shrink-0 transition-colors', active ? 'text-brand-600' : 'text-gray-500')} />}
        <span className="truncate">{option.label}</span>
        {(option.badge ?? 0) > 0 && (
          <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold leading-none inline-flex items-center justify-center">
            {option.badge! > 9 ? '9+' : option.badge}
          </span>
        )}
      </>
    )
  }

  const columns = `repeat(${count}, minmax(0, 1fr))`

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => {
        // Souris sortie sans glisser : la pastille se repose
        if (!gesture.current?.dragging) onPointerCancel()
      }}
      onClickCapture={e => {
        // Choix déjà fait au lâcher : pas de second clic. Le clic du clavier
        // (detail 0) n'est jamais celui d'un toucher.
        if (swallowClick.current && e.detail !== 0) {
          e.preventDefault()
          e.stopPropagation()
          swallowClick.current = false
        }
      }}
      // Pas de menu d'aperçu iOS sur un appui long : l'appui tenu sert à la loupe
      className={cn('relative grid touch-pan-y select-none [-webkit-touch-callout:none] gap-0.5 rounded-full bg-gray-200 p-0.5', className)}
      style={{ gridTemplateColumns: columns, ...style }}
    >
      {(index >= 0 || lifted) && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0.5 left-0.5',
            // Sous la loupe, elle la suit image par image, sans transition.
            !lifted && 'transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
          )}
          style={thumb}
        >
          <span
            key={touched ? index : 'repos'}
            className={cn(
              // Pastille blanche au repos (pas `bg-white`, que le mode sombre repeint)
              'block h-full w-full rounded-full bg-[#ffffff] shadow-lift dark:bg-[#475569]',
              lifted ? 'opacity-0' : touched && 'motion-safe:animate-bubble',
            )}
          />
        </span>
      )}

      {lifted && (
        // Le contrôle n'a pas de flou à lui : la loupe peut y être posée et voir la page au travers.
        <GlassLens
          rest={{ left, top: INSET, width: lens.width, height: height - INSET * 2 }}
          grow={GROW}
          surface={{ left: 0, top: 0, width: span, height }}
          surfaceClassName="bg-loupe"
          content={{ left: INSET, top: INSET, width: span - INSET * 2, height: height - INSET * 2 }}
          focus={lens.center}
        >
          <span className="grid h-full" style={{ gridTemplateColumns: columns, columnGap: GAP }}>
            {options.map((option, i) => (
              <span key={option.value} className={itemClasses(option, i === shown)}>
                {content(option, i === shown)}
              </span>
            ))}
          </span>
        </GlassLens>
      )}

      {options.map((option, i) => {
        const active = i === shown
        return option.href ? (
          <Link
            key={option.value}
            href={option.href}
            draggable={false}
            data-segment={i}
            aria-current={i === current ? 'page' : undefined}
            aria-label={option.ariaLabel}
            title={option.ariaLabel}
            onClick={() => choose(i, false)}
            className={cn('z-10', itemClasses(option, active))}
          >
            {content(option, active)}
          </Link>
        ) : (
          <button
            key={option.value}
            type="button"
            draggable={false}
            data-segment={i}
            aria-pressed={i === current}
            aria-label={option.ariaLabel}
            onClick={() => choose(i, false)}
            className={cn('z-10', itemClasses(option, active))}
          >
            {content(option, active)}
          </button>
        )
      })}
    </div>
  )
}
