import { Suspense } from 'react'
import { MapView } from '@/components/map/MapView'
import { Loader2 } from 'lucide-react'

export default function MapPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full relative">
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
