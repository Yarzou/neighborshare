import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
