import Link from 'next/link'
import { MapPin, Wrench, Baby, Car, Package, Leaf, ArrowRight, Users, Shield, Zap } from 'lucide-react'
import { CATEGORY_LIST } from '@/lib/categories'

export default function HomePage() {

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 text-white">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px'}} />
        <div className="relative max-w-4xl mx-auto px-4 py-24 text-center">
          {/*<video*/}
          {/*  autoPlay*/}
          {/*  loop*/}
          {/*  muted*/}
          {/*  playsInline*/}
          {/*  className="inline-block rounded-2xl mb-4 w-48 h-48 object-cover"*/}
          {/*>*/}
          {/*  <source src="/logo_cedre_anim.mp4" type="video/mp4" />*/}
          {/*</video>*/}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Partagez avec<br />vos voisins du Cèdre
          </h1>
          <p className="text-xl text-brand-100 mb-10 max-w-2xl mx-auto">
            Outils, services, garde d&apos;enfant — trouvez ce dont vous avez besoin à deux pas de chez vous, ou proposez votre aide.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/map" className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-2xl hover:bg-brand-50 transition-colors shadow-lg">
              <MapPin size={18} />
              Explorer la carte
            </Link>
            <Link href="/listings/new" className="inline-flex items-center gap-2 bg-brand-500 text-white font-semibold px-8 py-3.5 rounded-2xl hover:bg-brand-400 transition-colors border border-brand-400">
              Publier une annonce
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-4xl mx-auto px-4 py-16 w-full">
        <h2 className="text-2xl font-bold text-center mb-8">Que cherchez-vous ?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CATEGORY_LIST.map((cat) => (
            <Link key={cat.slug} href={`/map?category=${cat.slug}`}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 ${cat.color} hover:scale-105 transition-transform cursor-pointer`}>
              <span className="text-3xl">{cat.icon}</span>
              <span className="font-medium text-gray-700 text-sm text-center">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-16 w-full text-center">
        <div className="bg-gradient-to-br from-brand-50 to-warm-50 rounded-3xl p-10 border border-brand-100">
          <Users className="mx-auto mb-4 text-brand-600" size={40} />
          <h2 className="text-2xl font-bold mb-3">Rejoignez votre quartier du Cèdre</h2>
          <p className="text-gray-500 mb-6">Créez votre compte et commencez à partager.</p>
          <Link href="/auth/register" className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-8 py-3.5 rounded-2xl hover:bg-brand-700 transition-colors">
            S&apos;inscrire
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  )
}
