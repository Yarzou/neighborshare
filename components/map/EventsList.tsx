'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Event } from '@/lib/types'
import { EventCard } from './EventCard'
import { EventDetailPopup } from './EventDetailPopup'
import { MiniCalendar } from './MiniCalendar'
import { CalendarDays, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

interface EventsListProps {
  className?: string
  /** Affiche le bouton toggle calendrier (mobile). Mettre à false en desktop. */
  showCalendarToggle?: boolean
  /** Layout des cards : 'list' (colonne, défaut) ou 'grid' (grille 2 colonnes desktop) */
  layout?: 'list' | 'grid'
  /** Date active contrôlée par le parent (desktop) */
  externalActiveDate?: string | null
  /** Callback quand le scroll change la date visible */
  onActiveDateChange?: (date: string) => void
  /** Callback quand les dates marquées sont prêtes */
  onMarkedDatesReady?: (dates: Set<string>) => void
  /** Déclencher un scroll vers une date depuis le parent */
  scrollTrigger?: { date: string; seq: number } | null
  /** Filtre date de début contrôlé par le parent (desktop) */
  filterFrom?: string
  /** Filtre date de fin contrôlé par le parent (desktop) */
  filterTo?: string
  /** Callback quand l'utilisateur change les filtres (desktop) */
  onFilterChange?: (from: string, to: string) => void
  /** Callback quand un événement est sélectionné/désélectionné (pour surbrillance calendrier + carte desktop) */
  onEventSelect?: (event: Event | null) => void
}

export function EventsList({
  className,
  showCalendarToggle = true,
  layout = 'list',
  externalActiveDate,
  onActiveDateChange,
  onMarkedDatesReady,
  scrollTrigger,
  filterFrom: externalFilterFrom,
  filterTo: externalFilterTo,
  onFilterChange,
  onEventSelect,
}: EventsListProps) {
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [internalActiveDate, setInternalActiveDate] = useState<string | null>(null)
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Internal filter state (mobile) — controlled by parent on desktop
  const [internalFilterFrom, setInternalFilterFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [internalFilterTo, setInternalFilterTo] = useState('')

  const isControlled = onFilterChange !== undefined
  const filterFrom = isControlled ? (externalFilterFrom ?? '') : internalFilterFrom
  const filterTo = isControlled ? (externalFilterTo ?? '') : internalFilterTo
  const hasFilter = !!(filterFrom || filterTo)

  const activeDate = externalActiveDate !== undefined ? externalActiveDate : internalActiveDate

  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const scrollObserverRef = useRef<IntersectionObserver | null>(null)
  const offsetRef = useRef(0)
  const isFetchingRef = useRef(false)
  const lastScrollTriggerSeq = useRef<number>(-1)
  // Prevents the IntersectionObserver from syncing the calendar on initial render
  // (before the user has actually scrolled the list)
  const hasScrolledRef = useRef(false)

  const fetchEvents = useCallback(async (offset: number, from: string, to: string): Promise<Event[]> => {
    if (isFetchingRef.current) return []
    isFetchingRef.current = true

    let query = supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })

    if (from) query = query.gte('event_date', `${from}T00:00:00`)
    if (to) query = query.lte('event_date', `${to}T23:59:59`)

    // When filter active, load all; else paginate
    if (!from && !to) query = query.range(offset, offset + PAGE_SIZE - 1)

    const { data, error } = await query
    isFetchingRef.current = false
    if (error || !data) return [] as Event[]
    return data as Event[]
  }, [supabase])

  const loadEvents = useCallback(async (from: string, to: string, reset: boolean) => {
    if (reset) {
      setLoading(true)
      setEvents([])
      offsetRef.current = 0
    }

    const data = await fetchEvents(reset ? 0 : offsetRef.current, from, to)
    if (reset) {
      setEvents(data)
    } else {
      setEvents(prev => [...prev, ...data])
    }
    offsetRef.current = (reset ? 0 : offsetRef.current) + data.length
    // When filter active, no more pagination needed
    setHasMore((from || to) ? false : data.length === PAGE_SIZE)
    setLoading(false)
  }, [fetchEvents])

  // Initial load + reload when filters change
  useEffect(() => {
    loadEvents(filterFrom, filterTo, true)
  }, [filterFrom, filterTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load all marked dates (always unfiltered, for calendar dots)
  useEffect(() => {
    const loadMarked = async () => {
      const { data } = await supabase.from('events').select('event_date')
      const dates = new Set((data ?? []).map((e: { event_date: string }) => e.event_date.slice(0, 10)))
      setMarkedDates(dates)
      onMarkedDatesReady?.(dates)
    }
    loadMarked()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !hasFilter) {
        setLoadingMore(true)
        const data = await fetchEvents(offsetRef.current, filterFrom, filterTo)
        setEvents(prev => [...prev, ...data])
        offsetRef.current += data.length
        setHasMore(data.length === PAGE_SIZE)
        setLoadingMore(false)
      }
    }, { threshold: 0.1 })

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, fetchEvents, hasFilter, filterFrom, filterTo])

  // Mark hasScrolled on first real scroll so the calendar doesn't jump on initial render
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onScroll = () => { hasScrolledRef.current = true }
    list.addEventListener('scroll', onScroll, { once: true })
    return () => list.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll → calendar sync
  useEffect(() => {
    if (scrollObserverRef.current) scrollObserverRef.current.disconnect()
    scrollObserverRef.current = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length > 0) {
        const el = visible[0].target as HTMLElement
        const date = el.getAttribute('data-event-date')
        if (date && hasScrolledRef.current) {
          setInternalActiveDate(date)
          onActiveDateChange?.(date)
        }
      }
    }, { threshold: 0.5, root: listRef.current })

    const cards = listRef.current?.querySelectorAll('[data-event-date]')
    cards?.forEach(card => scrollObserverRef.current?.observe(card))

    return () => scrollObserverRef.current?.disconnect()
  }, [events, onActiveDateChange])

  // External scroll trigger
  useEffect(() => {
    if (!scrollTrigger || scrollTrigger.seq === lastScrollTriggerSeq.current) return
    lastScrollTriggerSeq.current = scrollTrigger.seq
    setShowCalendar(false)
  }, [scrollTrigger])

  // Filter helpers
  const applyFilter = (from: string, to: string) => {
    if (isControlled) {
      onFilterChange!(from, to)
    } else {
      setInternalFilterFrom(from)
      setInternalFilterTo(to)
    }
  }

  const clearFilter = () => applyFilter('', '')

  // Internal calendar day click (mobile): filter to that day
  const handleInternalDayClick = (date: string) => {
    const isSameDay = filterFrom === date && filterTo === date
    if (isSameDay) {
      clearFilter()
    } else {
      applyFilter(date, date)
      setShowCalendar(false)
    }
  }

  return (
    <div className={cn('flex flex-col h-full relative', className)}>
      {/* Filter bar */}
      <div className="px-3 pt-3 pb-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap">Du</span>
              <input
                type="date"
                value={filterFrom}
                onChange={e => applyFilter(e.target.value, filterTo)}
                className="text-xs text-gray-700 bg-transparent outline-none w-28"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap">Au</span>
              <input
                type="date"
                value={filterTo}
                min={filterFrom || undefined}
                onChange={e => applyFilter(filterFrom, e.target.value)}
                className="text-xs text-gray-700 bg-transparent outline-none w-28"
              />
            </div>
            {hasFilter && (
              <button
                onClick={clearFilter}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                <X size={12} /> Effacer
              </button>
            )}
          </div>

          {/* Calendar toggle (mobile only) */}
          {showCalendarToggle && (
            <button
              onClick={() => setShowCalendar(v => !v)}
              className={cn(
                'shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors',
                showCalendar ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <CalendarDays size={13} />
            </button>
          )}
        </div>

        {hasFilter && (
          <p className="text-xs text-gray-500">
            {events.length} événement{events.length !== 1 ? 's' : ''} trouvé{events.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Inline calendar (mobile toggle) */}
      {showCalendarToggle && showCalendar && (
        <div className="px-3 pb-3 shrink-0">
          <MiniCalendar
            activeDate={filterFrom === filterTo && filterFrom ? filterFrom : (activeDate ?? null)}
            markedDates={markedDates}
            onDateClick={handleInternalDayClick}
          />
        </div>
      )}

      {/* Events list */}
      <div ref={listRef} className={cn(
        'flex-1 overflow-y-auto px-3 pb-3',
        layout === 'grid' ? 'grid grid-cols-3 gap-3 content-start' : 'flex flex-col gap-2'
      )}>
        {loading ? (
          <div className={cn('flex items-center justify-center py-12', layout === 'grid' && 'col-span-3')}>
            <Loader2 className="animate-spin text-brand-600" size={28} />
          </div>
        ) : events.length === 0 ? (
          <div className={cn('text-center py-12 text-gray-400', layout === 'grid' && 'col-span-3')}>
            <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{hasFilter ? 'Aucun événement sur cette période' : 'Aucun événement'}</p>
            {hasFilter ? (
              <button onClick={clearFilter} className="text-sm text-brand-600 mt-2 hover:underline">
                Effacer les filtres
              </button>
            ) : (
              <p className="text-sm mt-1">Soyez le premier à en créer un !</p>
            )}
          </div>
        ) : (
          <>
            {events.map(event => (
              <EventCard
                key={event.id}
                event={event}
                compact={layout !== 'grid'}
                selected={selectedEvent?.id === event.id}
                onClick={() => {
                  const next = selectedEvent?.id === event.id ? null : event
                  setSelectedEvent(next)
                  onEventSelect?.(next ?? null)
                }}
              />
            ))}
            <div ref={sentinelRef} className={cn('h-4 shrink-0', layout === 'grid' && 'col-span-3')} />
            {loadingMore && (
              <div className={cn('flex justify-center py-2', layout === 'grid' && 'col-span-3')}>
                <Loader2 className="animate-spin text-brand-400" size={20} />
              </div>
            )}
            {!hasMore && !hasFilter && events.length >= PAGE_SIZE && (
              <p className={cn('text-center text-xs text-gray-400 py-2', layout === 'grid' && 'col-span-3')}>Tous les événements sont affichés</p>
            )}
          </>
        )}
      </div>

      {/* Event detail popup */}
      {selectedEvent && (
        <EventDetailPopup
          event={selectedEvent}
          onClose={() => {
            setSelectedEvent(null)
            onEventSelect?.(null)
          }}
        />
      )}
    </div>
  )
}
