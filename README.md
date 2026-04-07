# 🏘️ NeighborShare

Plateforme d'entraide locale géolocalisée — partagez des outils, services, garde d'enfant et plus encore avec vos voisins.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (PostgreSQL + PostGIS, Auth, Storage)
- **Leaflet + OpenStreetMap** (carte 100% gratuite)
- **Tailwind CSS** (UI)
- **Vercel** (déploiement recommandé)

---

## 🚀 Installation

### 1. Cloner et installer les dépendances

```bash
git clone https://github.com/ton-user/neighborshare.git
cd neighborshare
npm install
```

### 2. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) → **New Project**
2. Noter l'**URL** et la clé **anon** (Settings > API)

### 3. Configurer les variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplir `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Initialiser la base de données

Dans le dashboard Supabase → **SQL Editor** → coller et exécuter le contenu de `supabase/schema.sql`.

Ce script crée :
- Les tables `profiles`, `listings`, `messages`, `categories`
- L'extension **PostGIS** pour les requêtes géospatiales
- La fonction `listings_within_radius()` pour trouver les annonces proches
- Les policies **Row Level Security**
- Un trigger pour créer automatiquement un profil à l'inscription
- Le bucket de **storage** pour les photos

### 5. Lancer en développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## 📁 Structure du projet

```
neighborshare/
├── app/
│   ├── page.tsx              # Page d'accueil
│   ├── layout.tsx            # Layout global
│   ├── globals.css
│   ├── auth/
│   │   ├── login/page.tsx    # Connexion
│   │   └── register/page.tsx # Inscription
│   ├── map/page.tsx          # Carte géolocalisée
│   ├── listings/
│   │   ├── new/page.tsx      # Créer une annonce
│   │   └── [id]/page.tsx     # Détail d'une annonce
│   ├── messages/page.tsx     # Messagerie
│   └── profile/page.tsx      # Profil utilisateur
├── components/
│   ├── layout/Navbar.tsx
│   ├── map/
│   │   ├── MapView.tsx       # Conteneur principal carte
│   │   ├── LeafletMap.tsx    # Carte Leaflet (SSR disabled)
│   │   └── FilterBar.tsx     # Filtres catégorie + rayon
│   └── listings/
│       ├── ListingCard.tsx   # Carte d'annonce
│       └── ContactButton.tsx # Bouton de contact
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Client Supabase (browser)
│   │   └── server.ts         # Client Supabase (server)
│   ├── types.ts              # Types TypeScript
│   └── utils.ts              # Fonctions utilitaires
├── middleware.ts              # Protection des routes
└── supabase/
    └── schema.sql            # Schéma complet de la BDD
```

---

## 🚢 Déploiement sur Vercel

```bash
npm install -g vercel
vercel
```

Ajouter les variables d'environnement dans le dashboard Vercel (Settings > Environment Variables) :

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

---

## 📍 Fonctionnement de la géolocalisation

La fonction SQL `listings_within_radius` utilise **PostGIS** pour trouver les annonces dans un rayon donné :

```sql
SELECT * FROM listings_within_radius(
  lat => 48.8566,
  lng => 2.3522,
  radius_km => 5
);
```

Les positions sont stockées en format `geography(Point, 4326)` (WGS84).

---

## 🔜 Prochaines étapes suggérées

- [ ] Messagerie temps réel (Supabase Realtime)
- [ ] Système d'avis après échange
- [ ] Notifications push (Supabase Edge Functions)
- [ ] Fil d'annonces public sans compte
- [ ] Mode sombre
- [ ] Application mobile (Expo + React Native)

---

## 📄 Licence

MIT
