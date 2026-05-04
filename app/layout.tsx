import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import FirebaseSWRegister from '@/components/layout/FirebaseSWRegister'
import PWAInstallBanner from '@/components/layout/PWAInstallBanner'
import PushNotificationBanner from '@/components/layout/PushNotificationBanner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

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
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans bg-gray-50 text-gray-900 antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          <FirebaseSWRegister />
          <PWAInstallBanner />
          <PushNotificationBanner />
          <main className="min-h-screen pt-16">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
