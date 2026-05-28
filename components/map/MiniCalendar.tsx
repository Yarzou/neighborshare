'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniCalendarProps {
  activeDate: string | null        // 'YYYY-MM-DD' currently active
  markedDates: Set<string>         // dates that have events
  onDateClick: (date: string) => void
  onDateHover?: (date: string | null) => void
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

export function MiniCalendar({ activeDate, markedDates, onDateClick, onDateHover }: MiniCalendarProps) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(() =>
    activeDate ? parseInt(activeDate.slice(0, 4)) : today.getFullYear()
  )
  const [viewMonth, setViewMonth] = useState(() =>
    activeDate ? parseInt(activeDate.slice(5, 7)) - 1 : today.getMonth()
  )

  // Track manual navigation — when user clicks prev/next, stop auto-syncing view
  const userNavigatedRef = useRef(false)

  // Sync view when activeDate changes externally (event click, filter, calendar day click)
  // but NOT when user is manually browsing months
  useEffect(() => {
    if (!activeDate || userNavigatedRef.current) return
    setViewYear(parseInt(activeDate.slice(0, 4)))
    setViewMonth(parseInt(activeDate.slice(5, 7)) - 1)
  }, [activeDate])

  const prevMonth = () => {
    userNavigatedRef.current = true
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    userNavigatedRef.current = true
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDateClick = (dateStr: string) => {
    // Reset manual nav flag so future external changes sync the view again
    userNavigatedRef.current = false
    onDateClick(dateStr)
  }

  // Build calendar grid (Monday-first)
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div
        className="grid grid-cols-7 gap-y-0.5"
        onMouseLeave={() => onDateHover?.(null)}
      >
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const isActive = dateStr === activeDate
          const hasEvent = markedDates.has(dateStr)
          const isToday = dateStr === `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

          return (
            <button
              key={i}
              onClick={() => { if (hasEvent || isToday) handleDateClick(dateStr) }}
              className={cn(
                'relative mx-auto flex flex-col items-center justify-center w-7 h-7 rounded-full text-xs transition-colors',
                isActive ? 'bg-brand-600 text-white font-bold' :
                  hasEvent ? 'hover:bg-gray-100 text-gray-900 font-medium cursor-pointer' :
                    isToday ? 'border border-brand-300 text-brand-700' :
                      'text-gray-400 cursor-default'
              )}
            >
              {day}
              {hasEvent && !isActive && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
