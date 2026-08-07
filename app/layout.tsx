import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import FirebaseSWRegister from '@/components/layout/FirebaseSWRegister'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

// Bannière conditionnelle, presque toujours invisible : chargée à part pour ne
// pas peser sur le bundle partagé du premier rendu.
const PWAInstallBanner = dynamic(() => import('@/components/layout/PWAInstallBanner'))

export const metadata: Metadata = {
  title: 'Les voisins du Cèdre',
  description: 'Plateforme d\'entraide locale géolocalisée : outils, services, garde d\'enfant et plus encore.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Les voisins du Cèdre',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Script anti-FOUC : applique la classe dark avant le premier paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t==='system'||!t)&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${GeistSans.variable} font-sans bg-gray-50 text-gray-900 antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          <FirebaseSWRegister />
          <PWAInstallBanner />
          {/* PushNotificationBanner n'est plus ici : il ne s'affiche que sur
              /messages et vit désormais dans app/messages/layout.tsx. */}
          <main className="min-h-screen pt-16">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
