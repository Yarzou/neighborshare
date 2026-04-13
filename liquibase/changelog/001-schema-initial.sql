--liquibase formatted sql

-- =============================================
-- 001 : Schema complet NeighborShare
-- =============================================

--changeset neighborshare:001-extensions
create extension if not exists postgis;

--changeset neighborshare:001-profiles
create table if not exists public.profiles (
    id           uuid references auth.users(id) on delete cascade primary key,
    username     text unique not null,
    full_name    text,
    avatar_url   text,
    bio          text,
    rating       numeric(3,2) default 0,
    rating_count integer default 0,
    created_at   timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

--changeset neighborshare:001-categories
create table if not exists public.categories (
    id    serial primary key,
    slug  text unique not null,
    label text not null,
    icon  text not null
);
insert into public.categories (slug, label, icon) values
    ('outils',       'Outils',          '🔧'),
    ('services',     'Services',        '🤝'),
    ('garde-enfant', 'Garde d''enfant', '👶'),
    ('covoiturage',  'Covoiturage',     '🚗'),
    ('dons',         'Dons / Objets',   '📦'),
    ('jardinage',    'Jardinage',       '🌿')
on conflict (slug) do nothing;

--changeset neighborshare:001-listing-types
create type listing_type as enum ('pret', 'don', 'echange', 'service');
create type listing_status as enum ('disponible', 'reserve', 'termine', 'en_cours', 'validee');

--changeset neighborshare:001-conversations-table
create table if not exists public.conversations (
    id         uuid default gen_random_uuid() primary key,
    name       text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.conversations enable row level security;

--changeset neighborshare:001-listings
create table if not exists public.listings (
    id              uuid default gen_random_uuid() primary key,
    user_id         uuid references public.profiles(id) on delete cascade not null,
    category_id     integer references public.categories(id),
    title           text not null,
    description     text,
    type            listing_type not null default 'pret',
    status          listing_status not null default 'disponible',
    image_url       text,
    location        geography(Point, 4326) not null,
    address         text,
    city            text,
    responder_id    uuid references public.profiles(id),
    conversation_id uuid references public.conversations(id),
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);
alter table public.listings enable row level security;
create policy "listings_select" on public.listings for select using (true);
create policy "listings_insert" on public.listings for insert with check (auth.uid() = user_id);
create policy "listings_update" on public.listings for update using (auth.uid() = user_id);
create policy "listings_delete" on public.listings for delete using (auth.uid() = user_id);
create index if not exists listings_location_idx on public.listings using gist(location);

--changeset neighborshare:001-messaging-tables
create table if not exists public.conversation_participants (
    conversation_id uuid references public.conversations(id) on delete cascade,
    user_id         uuid references public.profiles(id) on delete cascade,
    last_read_at    timestamptz default now(),
    joined_at       timestamptz default now(),
    primary key (conversation_id, user_id)
);
create table if not exists public.messages (
    id              uuid default gen_random_uuid() primary key,
    conversation_id uuid references public.conversations(id) on delete cascade not null,
    sender_id       uuid references public.profiles(id) on delete cascade not null,
    content         text not null,
    created_at      timestamptz default now()
);
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
