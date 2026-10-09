'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Listing } from '@/lib/types'
import { ListingCard } from '@/components/listings/ListingCard'

/**
 * Fiche de l'annonce choisie sur la carte, posée en bas (2026-10-07).
 *
 * Demande utilisateur : pouvoir « toujours voir les bulles malgré l'ouverture de
 * l'annonce ». La fiche remonte sa hauteur (`onInsetChange`) à LeafletMap, qui
 * recadre la carte pour garder le repère choisi visible au-dessus d'elle.
 * ⛔ Pas de poignée ni de fiche repliable : une première version en avait une,
 * retirée à la demande (« elle ne sert à rien, je ne l'ai pas demandée »).
 */
export function ListingSheet({ listing, onClose, onInsetChange }: {
  listing: Listing
  onClose: () => void
  onInsetChange?: (px: number) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Hauteur occupée en bas de la carte : celle de la fiche + sa marge basse.
  useEffect(() => {
    const el = rootRef.current
    if (!el || !onInsetChange) return
    const report = () => {
      const parent = el.offsetParent as HTMLElement | null
      const bottom = parent ? parent.clientHeight - (el.offsetTop + el.offsetHeight) : 0
      onInsetChange(el.offsetHeight + Math.max(bottom, 0))
    }
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => {
      observer.disconnect()
      onInsetChange(0)
    }
  }, [onInsetChange])

  return (
    <div
      ref={rootRef}
      className="absolute z-[1200] left-3 right-3 bottom-[calc(var(--tabbar-h)+0.75rem)] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-96 md:bottom-6 max-h-[calc(var(--app-h)-3rem)] overflow-y-auto rounded-2xl shadow-xl"
    >
      <div className="relative">
        <button
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="absolute top-2 right-2 w-7 h-7 rounded-full glass text-gray-600 flex items-center justify-center z-10"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
        <ListingCard listing={listing} outlineOnly />
      </div>
    </div>
  )
}
