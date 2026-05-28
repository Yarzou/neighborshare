'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EventsList } from '@/components/map/EventsList'
import { MiniCalendar } from '@/components/map/MiniCalendar'
import { CalendarDays, Plus } from 'lucide-react'

export default function EvenementsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Shared state between EventsList (desktop) and MiniCalendar
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())
  const [filterFrom, setFilterFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [filterTo, setFilterTo] = useState('')
  // Date de l'event sélectionné (popup ouverte) — surbrillance calendrier uniquement
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Calendar date click → filter to that single day (toggle off if same day)
  const handleCalendarDateClick = (date: string) => {
    const isSameDay = filterFrom === date && filterTo === date
    if (isSameDay) {
      setFilterFrom('')
      setFilterTo('')
      setActiveDate(null)
    } else {
      setFilterFrom(date)
      setFilterTo(date)
      setActiveDate(date)
    }
  }

  // Filter bar changes from EventsList
  const handleFilterChange = (from: string, to: string) => {
    setFilterFrom(from)
    setFilterTo(to)
    // Update calendar active date when filter is a single day
    if (from && to && from === to) setActiveDate(from)
    else if (!from && !to) setActiveDate(null)
  }

  // Calendar active date : event sélectionné (popup) > filtre single-day > scroll-driven
  const calendarActiveDate = selectedEventDate ?? (filterFrom && filterTo && filterFrom === filterTo ? filterFrom : activeDate)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-600" />
          <h1 className="text-base font-bold text-gray-900">Événements du quartier</h1>
        </div>
        <button
          onClick={() => isLoggedIn ? router.push('/evenements/new') : router.push('/auth/login?redirect=%2Fevenements%2Fnew')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus size={15} /> Créer
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: events list */}
        <div className="flex-1 overflow-hidden relative">
          {/* Mobile: includes calendar toggle + internal filter */}
          <div className="md:hidden h-full">
            <EventsList
              className="h-full"
              showCalendarToggle={true}
            />
          </div>

          {/* Desktop: filter bar controlled by parent */}
          <div className="hidden md:block h-full">
            <EventsList
              className="h-full"
              showCalendarToggle={false}
              externalActiveDate={activeDate}
              onActiveDateChange={setActiveDate}
              onMarkedDatesReady={setMarkedDates}
              filterFrom={filterFrom}
              filterTo={filterTo}
              onFilterChange={handleFilterChange}
              onEventSelect={(date) => setSelectedEventDate(date)}
            />
          </div>
        </div>

        {/* Right: calendar (desktop only, always visible) */}
        <div className="hidden md:flex flex-col w-72 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 flex flex-col gap-3 sticky top-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendrier</p>
            <MiniCalendar
              activeDate={calendarActiveDate}
              markedDates={markedDates}
              onDateClick={handleCalendarDateClick}
            />
            <p className="text-xs text-gray-400 text-center">
              Cliquez sur une date pour filtrer · Re-cliquez pour effacer
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
