'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
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
/** Grossissement de la loupe (un peu moins que la barre d'onglets : libellés plus grands). */
const LENS_ZOOM = 1.22
/** La loupe déborde un peu du contrôle, en haut et en bas, comme sur iOS. */
const LENS_POP = 4
/** Appui tenu (ms) avant que la loupe n'apparaisse : un simple toucher ne la montre pas. */
const LENS_DELAY = 160

/**
 * Contrôle segmenté iOS 26, parti de celui de l'app Fridge : capsule grise,
 * segment choisi en relief blanc (une pastille qui glisse en s'étirant comme une
 * goutte d'un segment à l'autre).
 *
 * **Loupe** (2026-10-07, la même que la barre d'onglets) : appui tenu ou glissé,
 * une lentille de verre apparaît sous le doigt et grossit réellement les segments
 * situés dessous (une copie agrandie de la rangée, calée sous la lentille). Elle
 * suit le doigt ; au lâcher d'un glissé, le segment le plus proche est choisi.
 *
 * Un segment peut être un **lien** (`href`, onglets du Quartier) : la pastille part
 * alors tout de suite vers lui, sans attendre la page. Il peut aussi porter une
 * icône et une pastille de compteur.
 * Le défilement vertical de la page reste libre (`touch-pan-y`). Avec « Réduire
 * les animations », tout se déplace sans effet.
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
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Abscisse de l'appui, puis du doigt pendant un glissé (px depuis le bord gauche)
  const [pressX, setPressX] = useState<number | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  // Loupe visible : appui tenu, ou glissé
  const [lifted, setLifted] = useState(false)
  // La goutte ne se déforme qu'après un premier geste, pas à l'affichage
  const [touched, setTouched] = useState(false)
  // Segment-lien touché : la pastille y va avant que la page ne change `value`
  const [pending, setPending] = useState<{ index: number; from: T } | null>(null)
  // Taille du contrôle, pour placer la loupe et sa copie agrandie
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setBox({ width: el.offsetWidth, height: el.offsetHeight }))
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (liftTimer.current) clearTimeout(liftTimer.current)
    }
  }, [])

  const count = options.length
  const current = options.findIndex(option => option.value === value)
  const index = pending && pending.from === value ? pending.index : current
  const segmentWidth = (width: number) => (width - INSET * 2 - GAP * (count - 1)) / count
  const segmentAt = (x: number, width: number) =>
    Math.min(count - 1, Math.max(0, Math.floor((x - INSET + GAP / 2) / (segmentWidth(width) + GAP))))
  const localX = (clientX: number) => clientX - rootRef.current!.getBoundingClientRect().left

  /** Choix d'un segment, au toucher ou au lâcher d'un glissé. */
  const choose = (i: number, fromDrag: boolean) => {
    setTouched(true)
    const option = options[i]
    if (option.href) {
      setPending({ index: i, from: value })
      // Au toucher, c'est le lien qui navigue ; au lâcher d'un glissé, c'est nous.
      if (fromDrag && i !== current) router.push(option.href)
    } else if (i !== current || !fromDrag) {
      onChange?.(option.value)
    }
  }

  /** Fin du geste : la loupe disparaît. */
  const release = () => {
    if (liftTimer.current) clearTimeout(liftTimer.current)
    liftTimer.current = null
    gesture.current = null
    setPressX(null)
    setDrag(null)
    setLifted(false)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    setPressX(localX(e.clientX))
    liftTimer.current = setTimeout(() => setLifted(true), LENS_DELAY)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging) {
      if (Math.abs(e.clientX - g.startX) < 8) return
      g.dragging = true
      setTouched(true)
      setLifted(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDrag(localX(e.clientX))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const dragging = gesture.current?.dragging
    const x = localX(e.clientX)
    const width = rootRef.current!.getBoundingClientRect().width
    release()
    if (!dragging) return
    swallowClick.current = true
    choose(segmentAt(x, width), true)
  }

  // Au repos, la pastille se place en pourcentages (aucune mesure).
  const transform = `translateX(calc(${index} * (100% + ${GAP}px)))`

  // Loupe : centrée sous le doigt (glissé) ou sur le segment appuyé, un peu plus
  // grande que lui, sans sortir du contrôle.
  const pointer = drag ?? pressX
  let lens: { left: number; width: number; hovered: number } | null = null
  if (box && pointer !== null) {
    const segW = segmentWidth(box.width)
    const hovered = segmentAt(pointer, box.width)
    const width = Math.min(segW * 1.14, box.width)
    const center = drag !== null ? drag : INSET + hovered * (segW + GAP) + segW / 2
    const left = Math.min(Math.max(center - width / 2, 0), box.width - width)
    lens = { left, width, hovered }
  }
  const shown = lifted && lens ? lens.hovered : index

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
      // Le navigateur a pris le geste (défilement vertical) : rien n'est choisi
      onPointerCancel={release}
      onPointerLeave={() => {
        // Souris sortie sans glisser : on relâche
        if (!gesture.current?.dragging) release()
      }}
      onClickCapture={e => {
        // Fin d'un glissé : le choix est déjà fait, pas de second clic. Le
        // clic du clavier (detail 0) n'est jamais celui d'un glissé.
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
      {index >= 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0.5 left-0.5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none"
          style={{ width: `calc((100% - ${INSET * 2 + GAP * (count - 1)}px) / ${count})`, transform }}
        >
          <span
            key={touched ? index : 'repos'}
            className={cn(
              'block h-full w-full rounded-full bg-[#ffffff] shadow-lift dark:bg-[#475569] transition-opacity duration-150',
              touched && 'motion-safe:animate-bubble',
              // Pendant la loupe, la pastille s'efface : c'est la loupe qui marque le segment
              lifted && 'opacity-0',
            )}
          />
        </span>
      )}

      {options.map((option, i) => {
        const active = i === shown
        return option.href ? (
          <Link
            key={option.value}
            href={option.href}
            draggable={false}
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
            aria-pressed={i === current}
            aria-label={option.ariaLabel}
            onClick={() => choose(i, false)}
            className={cn('z-10', itemClasses(option, active))}
          >
            {content(option, active)}
          </button>
        )
      })}

      {/* Loupe : lentille de verre posée sur les segments, qui contient une copie
          agrandie de la rangée, calée pour que son centre coïncide avec celui de
          la lentille. Au-dessus des segments réels, qu'elle masque. */}
      {lens && box && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-20 rounded-full overflow-hidden bg-lens-fill shadow-lens',
            'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            lifted ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          )}
          style={{ left: lens.left, width: lens.width, top: -LENS_POP, height: box.height + LENS_POP * 2 }}
        >
          <span
            className="absolute grid gap-0.5 p-0.5"
            style={{
              gridTemplateColumns: columns,
              left: -lens.left,
              top: LENS_POP,
              width: box.width,
              height: box.height,
              transform: `scale(${LENS_ZOOM})`,
              transformOrigin: `${lens.left + lens.width / 2}px ${box.height / 2}px`,
            }}
          >
            {options.map((option, i) => (
              <span key={option.value} className={itemClasses(option, i === lens!.hovered)}>
                {content(option, i === lens!.hovered)}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  )
}
