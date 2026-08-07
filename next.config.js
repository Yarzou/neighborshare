/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    // AVIF puis WebP : les photos d'annonces et d'événements sont des uploads
    // bruts de smartphone, c'est là que la recompression rapporte le plus.
    formats: ['image/avif', 'image/webp'],
    // Les images d'un bucket Supabase sont immuables (chemin horodaté
    // `{userId}/{timestamp}.{ext}`) : rien ne justifie de les réoptimiser
    // toutes les 60 s, valeur par défaut de Next.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              // `unpkg.com` retiré : les icônes de marqueur Leaflet sont
              // désormais importées depuis node_modules et servies par Next
              // (cf. components/map/LeafletMap.tsx).
              "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
              "media-src 'self'",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://api-adresse.data.gouv.fr wss://*.supabase.co https://*.googleapis.com https://*.firebase.com https://*.firebaseio.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

// Analyse du bundle : `ANALYZE=1 npm run build`. Chargé paresseusement pour que
// `@next/bundle-analyzer` reste une devDependency facultative — un build sans
// la variable ne le require jamais.
module.exports = process.env.ANALYZE
  ? require('@next/bundle-analyzer')({ enabled: true })(nextConfig)
  : nextConfig;
