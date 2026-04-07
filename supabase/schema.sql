-- =============================================
-- NeighborShare — Schéma Supabase (SQL)
-- À exécuter dans l'éditeur SQL de ton projet Supabase
-- =============================================

-- Extension géospatiale
create extension if not exists postgis;

-- -----------------------------------------------
-- PROFILES (étend auth.users de Supabase)
-- -----------------------------------------------
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  bio         text,
  rating      numeric(3,2) default 0,
  rating_count integer default 0,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles visibles par tous" on public.profiles
  for select using (true);

create policy "Utilisateur modifie son propre profil" on public.profiles
  for update using (auth.uid() = id);

-- -----------------------------------------------
-- CATEGORIES
-- -----------------------------------------------
create table public.categories (
  id    serial primary key,
  slug  text unique not null,
  label text not null,
  icon  text not null
);

insert into public.categories (slug, label, icon) values
  ('outils',        'Outils',          '🔧'),
  ('services',      'Services',        '🤝'),
  ('garde-enfant',  'Garde d''enfant', '👶'),
  ('covoiturage',   'Covoiturage',     '🚗'),
  ('dons',          'Dons / Objets',   '📦'),
  ('jardinage',     'Jardinage',       '🌿');

-- -----------------------------------------------
-- LISTINGS (annonces)
-- -----------------------------------------------
create type listing_type as enum ('pret', 'don', 'echange', 'service');
create type listing_status as enum ('disponible', 'reserve', 'termine');

create table public.listings (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  category_id integer references public.categories(id),
  title       text not null,
  description text,
  type        listing_type not null default 'pret',
  status      listing_status not null default 'disponible',
  image_url   text,
  location    geography(Point, 4326) not null,
  address     text,
  city        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.listings enable row level security;

create policy "Annonces visibles par tous" on public.listings
  for select using (true);

create policy "Utilisateur crée ses annonces" on public.listings
  for insert with check (auth.uid() = user_id);

create policy "Utilisateur modifie ses annonces" on public.listings
  for update using (auth.uid() = user_id);

create policy "Utilisateur supprime ses annonces" on public.listings
  for delete using (auth.uid() = user_id);

-- Index spatial
create index listings_location_idx on public.listings using gist(location);

-- -----------------------------------------------
-- FONCTION : annonces dans un rayon (km)
-- -----------------------------------------------
create or replace function listings_within_radius(
  lat float,
  lng float,
  radius_km float default 5
)
returns table (
  id uuid, user_id uuid, category_id integer,
  title text, description text, type listing_type,
  status listing_status, image_url text,
  address text, city text, created_at timestamptz,
  distance_m float,
  lat_out float, lng_out float
)
language sql stable as $$
  select
    l.id, l.user_id, l.category_id,
    l.title, l.description, l.type,
    l.status, l.image_url,
    l.address, l.city, l.created_at,
    st_distance(l.location::geography, st_makepoint(lng, lat)::geography) as distance_m,
    st_y(l.location::geometry) as lat_out,
    st_x(l.location::geometry) as lng_out
  from public.listings l
  where st_dwithin(
    l.location::geography,
    st_makepoint(lng, lat)::geography,
    radius_km * 1000
  )
  order by distance_m asc;
$$;

-- -----------------------------------------------
-- MESSAGES
-- -----------------------------------------------
create table public.messages (
  id          uuid default gen_random_uuid() primary key,
  listing_id  uuid references public.listings(id) on delete cascade not null,
  sender_id   uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Lecture messages propres" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Envoi messages" on public.messages
  for insert with check (auth.uid() = sender_id);

-- -----------------------------------------------
-- TRIGGER : créer un profil à l'inscription
-- -----------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------
-- STORAGE : bucket pour les images des annonces
-- -----------------------------------------------
insert into storage.buckets (id, name, public) values ('listings', 'listings', true);

create policy "Images publiques" on storage.objects
  for select using (bucket_id = 'listings');

create policy "Upload authentifié" on storage.objects
  for insert with check (bucket_id = 'listings' and auth.role() = 'authenticated');

create policy "Suppression propre" on storage.objects
  for delete using (bucket_id = 'listings' and auth.uid()::text = (storage.foldername(name))[1]);
