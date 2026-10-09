import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import ResetPasswordClient from './ResetPasswordClient'

// useSearchParams (lecture du token) exige une frontière Suspense au prérendu.
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[var(--app-h)] flex items-center justify-center text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
