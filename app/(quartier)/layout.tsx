import { QuartierFrame } from '@/components/layout/QuartierFrame'

/**
 * Layout commun aux pages « Quartier » : /infos, /achats, /prestataires,
 * /documents et la visionneuse /documents/[id]. Le route group `(quartier)`
 * n'affecte pas les URLs — il ne sert qu'à partager ce cadre.
 *
 * Tout le rendu (volet gauche desktop, onglets mobiles, cas de la visionneuse)
 * est dans `QuartierFrame`, composant client : il a besoin du pathname.
 *
 * Les pages passent en colonnes à partir de **lg** et non md : à 768 px le
 * volet laisse ~450 px au contenu, trop peu pour deux colonnes.
 */
export default function QuartierLayout({ children }: { children: React.ReactNode }) {
  return <QuartierFrame>{children}</QuartierFrame>
}
