import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ChildcareSlot } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function formatChildcarePeriod(start: string, end: string): { startLabel: string; endLabel: string; sameDay: boolean } {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const startDay = s.toLocaleDateString('fr-FR', opts)
  const endDay = e.toLocaleDateString('fr-FR', opts)
  const startTime = s.toLocaleTimeString('fr-FR', timeOpts)
  const endTime = e.toLocaleTimeString('fr-FR', timeOpts)
  const sameDay = startDay === endDay
  return {
    startLabel: `${startDay} à ${startTime}`,
    endLabel: sameDay ? endTime : `${endDay} à ${endTime}`,
    sameDay,
  }
}

const DAY_LABELS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function formatChildcareSlots(slots: ChildcareSlot[]): string {
  if (!slots || slots.length === 0) return 'Disponibilités à préciser'

  const parts: string[] = []

  // Group recurring slots by identical time range
  const recurring = slots.filter(s => s.type === 'recurring') as Extract<ChildcareSlot, { type: 'recurring' }>[]
  const grouped = new Map<string, number[]>()
  recurring.forEach(s => {
    const key = `${s.start_time}-${s.end_time}`
    grouped.set(key, (grouped.get(key) ?? []).concat(s.day))
  })
  grouped.forEach((days, range) => {
    const [start, end] = range.split('-')
    const dayStr = days.sort((a, b) => a - b).map(d => DAY_LABELS_SHORT[d]).join(', ')
    parts.push(`${dayStr} ${start.replace(':', 'h')}–${end.replace(':', 'h')}`)
  })

  // Ponctual slots
  const once = slots.filter(s => s.type === 'once') as Extract<ChildcareSlot, { type: 'once' }>[]
  once.forEach(s => {
    const date = new Date(s.date)
    const label = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    parts.push(`${label} ${s.start_time.replace(':', 'h')}–${s.end_time.replace(':', 'h')}`)
  })

  return parts.join(' · ')
}
