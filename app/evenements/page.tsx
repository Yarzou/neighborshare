'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EventsList } from '@/components/map/EventsList'
import { EventCard } from '@/components/map/EventCard'
import { MiniCalendar } from '@/components/map/MiniCalendar'
import EventMiniMap from '@/components/map/EventMiniMapDynamic'
import type { Event } from '@/lib/types'
import { CalendarDays, Plus, Loader2, X } from 'lucide-react'

export default function EvenementsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Shared state between EventsList (desktop) and MiniCalendar
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())
  const [filterFrom, setFilterFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [filterTo, setFilterTo] = useState('')
  // Date de l'event sélectionné (popup ouverte) — surbrillance calendrier uniquement
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null)
  // Event sélectionné complet — pour la mini-carte desktop
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  // Mobile list state
  const [mobileEvents, setMobileEvents] = useState<Event[]>([])
  const [mobileLoading, setMobileLoading] = useState(true)
  const [mobileFilterFrom, setMobileFilterFrom] = useState('')
  const [mobileFilterTo, setMobileFilterTo] = useState('')

  const handleEventSelect = (event: Event | null) => {
    setSelectedEvent(event)
    setSelectedEventDate(event ? event.event_date.slice(0, 10) : null)
  }

  const loadMobileEvents = useCallback(async (from: string, to: string) => {
    setMobileLoading(true)
    let query = supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })
    if (from) query = query.gte('event_date', `${from}T00:00:00`)
    else query = query.gte('event_date', `${new Date().getFullYear()}-01-01T00:00:00`)
    if (to) query = query.lte('event_date', `${to}T23:59:59`)
    const { data } = await query
    setMobileEvents((data ?? []) as Event[])
    setMobileLoading(false)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
      setUserId(data.user?.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user)
      setUserId(session?.user?.id ?? null)
    })
    loadMobileEvents('', '')
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload mobile events when filters change
  useEffect(() => {
    loadMobileEvents(mobileFilterFrom, mobileFilterTo)
  }, [mobileFilterFrom, mobileFilterTo]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
      {/* ── MOBILE : layout style Messages ── */}
      <div className="md:hidden max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="text-brand-600" size={26} />
            Événements
          </h1>
          {isLoggedIn && (
            <button
              onClick={() => router.push('/evenements/new')}
              className="flex items-center justify-center gap-1.5
                         w-10 h-10 rounded-full
                         sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:rounded-xl
                         bg-brand-600 text-white hover:bg-brand-700 transition-colors
                         text-sm font-medium flex-shrink-0"
              aria-label="Créer un événement"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Créer</span>
            </button>
          )}
        </div>

        {/* Filtre date mobile */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 flex-1 min-w-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">Du</span>
            <input
              type="date"
              value={mobileFilterFrom}
              onChange={e => setMobileFilterFrom(e.target.value)}
              className="text-xs text-gray-700 bg-transparent outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 flex-1 min-w-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">Au</span>
            <input
              type="date"
              value={mobileFilterTo}
              min={mobileFilterFrom || undefined}
              onChange={e => setMobileFilterTo(e.target.value)}
              className="text-xs text-gray-700 bg-transparent outline-none w-full"
            />
          </div>
          {(mobileFilterFrom || mobileFilterTo) && (
            <button
              onClick={() => { setMobileFilterFrom(''); setMobileFilterTo('') }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 px-2 py-1.5 rounded-xl border border-gray-200 bg-gray-50 transition-colors whitespace-nowrap"
            >
              <X size={12} /> Effacer
            </button>
          )}
        </div>

        {mobileLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-600" size={32} />
          </div>
        ) : mobileEvents.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <CalendarDays size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucun événement pour l&apos;instant</p>
            <p className="text-sm mt-1">Soyez le premier à en créer un !</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mobileEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => router.push(`/evenements/${event.id}`)}
                currentUserId={userId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── DESKTOP : layout pleine hauteur avec calendrier ── */}
      <div className="hidden md:flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-brand-600" />
            <h1 className="text-base font-bold text-gray-900">Événements du quartier</h1>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => router.push('/evenements/new')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Plus size={15} /> Créer
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: events list (grid on desktop) */}
          <div className="flex-1 overflow-hidden relative">
            <EventsList
              className="h-full"
              showCalendarToggle={false}
              layout="grid"
              externalActiveDate={activeDate}
              onActiveDateChange={setActiveDate}
              onMarkedDatesReady={setMarkedDates}
              filterFrom={filterFrom}
              filterTo={filterTo}
              onFilterChange={(from, to) => {
                setFilterFrom(from)
                setFilterTo(to)
                if (from && to && from === to) setActiveDate(from)
                else if (!from && !to) setActiveDate(null)
              }}
              onEventSelect={(event) => handleEventSelect(event)}
            />
          </div>

          {/* Right: calendar (desktop only, always visible) */}
          <div className="hidden md:flex flex-col w-72 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4 flex flex-col gap-3 sticky top-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendrier</p>
              <MiniCalendar
                activeDate={selectedEventDate ?? (filterFrom && filterTo && filterFrom === filterTo ? filterFrom : activeDate)}
                markedDates={markedDates}
                onDateClick={(date: string) => {
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
                }}
              />
              <p className="text-xs text-gray-400 text-center">
                Cliquez sur une date pour filtrer · Re-cliquez pour effacer
              </p>
            </div>

            {/* Mini-carte de l'événement sélectionné — carte seule, interactive */}
            {selectedEvent?.location_lat && selectedEvent?.location_lng && (
              <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Localisation</p>
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                  <EventMiniMap
                    lat={selectedEvent.location_lat}
                    lng={selectedEvent.location_lng}
                    label={selectedEvent.location_text ?? selectedEvent.title}
                    className="w-full h-56"
                    zoom={18}
                    interactive={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
