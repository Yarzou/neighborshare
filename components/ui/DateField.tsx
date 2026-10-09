'use client'

import { useState, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** 'YYYY-MM-DD' en heure locale (pas en UTC : à minuit, l'UTC donnerait la veille). */
const toIso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const todayIso = () => {
  const t = new Date()
  return toIso(t.getFullYear(), t.getMonth(), t.getDate())
}

/**
 * Choix d'une date dans la page, façon iOS (2026-10-07) : un champ qui affiche la
 * date en toutes lettres et déplie un petit calendrier en dessous, au lieu du
 * sélecteur natif du navigateur — jugé « n'importe quoi » (il s'ouvre dans une
 * fenêtre du système, démesurée dans l'émulation mobile de Chrome).
 *
 * `value` est une date 'YYYY-MM-DD' ou ''. `min` grise les jours antérieurs.
 * `trailing` se place à droite du champ, sur la même ligne (l'heure), le calendrier
 * occupant ensuite toute la largeur. `clearable` ajoute « Effacer » (date facultative).
 */
export default function DateField({ value, onChange, min, placeholder = 'Choisir une date', id, trailing, clearable, className }: {
  value: string
  onChange: (value: string) => void
  min?: string
  placeholder?: string
  id?: string
  trailing?: ReactNode
  clearable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const start = value || min || todayIso()
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 })

  const label = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : placeholder

  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7 // lundi en premier
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const today = todayIso()
  const move = (delta: number) => setView(v => {
    const d = new Date(v.y, v.m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const toggle = () => {
    // À l'ouverture, le calendrier montre le mois de la date choisie
    if (!open) setView({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 })
    setOpen(o => !o)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex gap-2">
        <button
          type="button"
          id={id}
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            'flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-white text-sm text-left transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand-500',
            open ? 'border-brand-600' : 'border-gray-200',
          )}
        >
          <CalendarDays size={16} className="text-brand-600 shrink-0" aria-hidden="true" />
          <span className={cn('flex-1 truncate first-letter:uppercase', value ? 'text-gray-900' : 'text-gray-500')}>{label}</span>
        </button>
        {trailing}
      </div>

      {open && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-lift">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => move(-1)} aria-label="Mois précédent"
              className="w-9 h-9 rounded-full flex items-center justify-center text-brand-600 hover:bg-gray-100">
              <ChevronLeft size={18} />
            </button>
            <span className="text-[15px] font-semibold text-gray-900">{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => move(1)} aria-label="Mois suivant"
              className="w-9 h-9 rounded-full flex items-center justify-center text-brand-600 hover:bg-gray-100">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="text-[11px] font-semibold text-gray-500 pb-1">{d}</span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`vide-${i}`} />
              const iso = toIso(view.y, view.m, day)
              const disabled = !!min && iso < min
              const selected = iso === value
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  onClick={() => { onChange(iso); setOpen(false) }}
                  className={cn(
                    'mx-auto w-9 h-9 rounded-full text-[15px] flex items-center justify-center transition-colors',
                    selected
                      ? 'bg-brand-600 text-white font-semibold'
                      : iso === today
                        ? 'text-brand-600 font-semibold hover:bg-gray-100'
                        : 'text-gray-900 hover:bg-gray-100',
                    disabled && 'text-gray-300 hover:bg-transparent cursor-not-allowed',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {clearable && value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="mt-2 w-full py-2 rounded-xl text-sm text-red-600 hover:bg-red-50">
              Effacer la date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
