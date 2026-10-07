import { Suspense } from 'react'
import { MapView } from '@/components/map/MapView'
import { Loader2 } from 'lucide-react'

export default function MapPage() {
  return (
    // Jusqu'en bas de l'écran, SOUS la barre d'onglets (comme Plans sur iOS) : la carte
    // et la liste passent derrière la barre en verre. La marge négative compense
    // celle du <main>, pour que la page ne défile pas.
    <div className="h-[var(--app-h-full)] -mb-[var(--tabbar-h)] w-full relative">
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin text-brand-600" size={32} />
        </div>
      }>
        <MapView />
      </Suspense>
    </div>
  )
}
