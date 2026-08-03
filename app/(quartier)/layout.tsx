import { QuartierTabs } from '@/components/layout/QuartierTabs'

/**
 * Layout commun aux pages « Quartier » : /infos, /achats, /prestataires.
 * Le route group `(quartier)` n'affecte pas les URLs — il ne sert qu'à partager
 * ce conteneur et la barre d'onglets.
 */
export default function QuartierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <QuartierTabs />
      {children}
    </div>
  )
}
