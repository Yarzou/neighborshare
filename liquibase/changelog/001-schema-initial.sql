--liquibase formatted sql

-- =============================================
-- 001 : Schéma initial NeighborShare
-- =============================================

--changeset neighborshare:001-extensions
create extension if not exists postgis;

--changeset neighborshare:001-profiles
create table if not exists public.profiles (
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

--changeset neighborshare:001-categories
create table if not exists public.categories (
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
                                                      ('jardinage',     'Jardinage',       '🌿')
on conflict (slug) do nothing;

--changeset neighborshare:001-listings
create type listing_type as enum ('pret', 'don', 'echange', 'service');
create type listing_status as enum ('disponible', 'reserve', 'termine');

create table if not exists public.listings (
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

create policy "Annonces visibles par tous" on public.listings for select using (true);
create policy "Utilisateur crée ses annonces" on public.listings for insert with check (auth.uid() = user_id);
create policy "Utilisateur modifie ses annonces" on public.listings for update using (auth.uid() = user_id);
create policy "Utilisateur supprime ses annonces" on public.listings for delete using (auth.uid() = user_id);

create index if not exists listings_location_idx on public.listings using gist(location);

--changeset neighborshare:001-listings-fn
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
                      distance_m float, lat_out float, lng_out float
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
order by distance_m asc
$$;

--changeset neighborshare:001-messaging
create table if not exists public.conversations (
                                                    id         uuid default gen_random_uuid() primary key,
                                                    name       text,
                                                    created_at timestamptz default now(),
                                                    updated_at timestamptz default now()
);

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

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

--changeset neighborshare:001-messaging-rls
create or replace function is_conversation_participant(conv_id uuid)
    returns boolean
    language sql
    security definer
    stable
as $$
select exists (
    select 1
    from public.conversation_participants
    where conversation_id = conv_id
      and user_id = auth.uid()
)
$$;

create policy "Voir ses conversations" on public.conversations
    for select using (is_conversation_participant(id));
create policy "Créer conversation" on public.conversations
    for insert with check (auth.uid() is not null);
create policy "Mettre à jour conversation" on public.conversations
    for update using (is_conversation_participant(id));

create policy "Voir participants" on public.conversation_participants
    for select using (is_conversation_participant(conversation_id));
create policy "Ajouter participant" on public.conversation_participants
    for insert with check (auth.uid() is not null);
create policy "Mise à jour last_read" on public.conversation_participants
    for update using (user_id = auth.uid());

create policy "Voir messages" on public.messages
    for select using (is_conversation_participant(conversation_id));
create policy "Envoyer message" on public.messages
    for insert with check (auth.uid() = sender_id and is_conversation_participant(conversation_id));
