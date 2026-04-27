import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import FirebaseSWRegister from '@/components/layout/FirebaseSWRegister'

export const metadata: Metadata = {
  title: 'NeighborShare — Partagez avec vos voisins',
  description: 'Plateforme d\'entraide locale géolocalisée : outils, services, garde d\'enfant et plus encore.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans bg-gray-50 text-gray-900 antialiased`}
      >
        <Navbar />
        <FirebaseSWRegister />
        <main className="min-h-screen pt-16">
          {children}
        </main>
      </body>
    </html>
  )
}
