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
  carpool_departure_address text,
  carpool_departure_lat     double precision,
  carpool_departure_lng     double precision,
  carpool_arrival_address   text,
  carpool_arrival_lat       double precision,
  carpool_arrival_lng       double precision,
  childcare_start_at        timestamptz,
  childcare_end_at          timestamptz,
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
  lat_out float, lng_out float,
  carpool_departure_address text,
  carpool_departure_lat float8,
  carpool_departure_lng float8,
  carpool_arrival_address text,
  carpool_arrival_lat float8,
  carpool_arrival_lng float8,
  childcare_start_at timestamptz,
  childcare_end_at   timestamptz
)
language sql stable as $$
  select
    l.id, l.user_id, l.category_id,
    l.title, l.description, l.type,
    l.status, l.image_url,
    l.address, l.city, l.created_at,
    st_distance(l.location::geography, st_makepoint(lng, lat)::geography) as distance_m,
    st_y(l.location::geometry) as lat_out,
    st_x(l.location::geometry) as lng_out,
    l.carpool_departure_address,
    l.carpool_departure_lat,
    l.carpool_departure_lng,
    l.carpool_arrival_address,
    l.carpool_arrival_lat,
    l.carpool_arrival_lng,
    l.childcare_start_at,
    l.childcare_end_at
  from public.listings l
  where st_dwithin(
    l.location::geography,
    st_makepoint(lng, lat)::geography,
    radius_km * 1000
  )
  order by distance_m asc;
$$;

-- -----------------------------------------------
-- MESSAGERIE : conversations & messages
-- -----------------------------------------------

-- Conversations (1-on-1 ou groupes)
create table public.conversations (
  id         uuid default gen_random_uuid() primary key,
  name       text,                          -- null = 1-on-1, texte = groupe nommé
  created_at timestamptz default now(),
  updated_at timestamptz default now()      -- mis à jour à chaque nouveau message
);

-- Participants
create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  last_read_at    timestamptz default now(),
  joined_at       timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- Messages
create table public.messages (
  id              uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id       uuid references public.profiles(id) on delete cascade not null,
  content         text not null,
  created_at      timestamptz default now()
);

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Conversations : accessible si participant
create policy "Voir ses conversations" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );
create policy "Créer conversation" on public.conversations
  for insert with check (auth.uid() is not null);
create policy "Mettre à jour conversation" on public.conversations
  for update using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

-- Participants : visible si dans la même conversation (via fonction SECURITY DEFINER pour éviter la récursion RLS)
create or replace function is_conversation_participant(conv_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id
      and user_id = auth.uid()
  );
$$;

create policy "Voir participants" on public.conversation_participants
  for select using (
    is_conversation_participant(conversation_id)
  );
create policy "Ajouter participant" on public.conversation_participants
  for insert with check (auth.uid() is not null);
create policy "Mise à jour last_read" on public.conversation_participants
  for update using (user_id = auth.uid());

-- Messages : visible si participant
create policy "Voir messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );
create policy "Envoyer message" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

-- -----------------------------------------------
-- RPC : trouver ou créer une conversation 1-à-1
-- -----------------------------------------------
create or replace function find_or_create_conversation(other_user_id uuid)
returns uuid language plpgsql security definer as $$
declare
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  -- Cherche une conversation directe existante (exactement 2 participants)
  select cp1.conversation_id into conv_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  where cp1.user_id = auth.uid()
    and cp2.user_id = other_user_id
    and (
      select count(*) from public.conversation_participants cp3
      where cp3.conversation_id = cp1.conversation_id
    ) = 2
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  -- Crée une nouvelle conversation 1-à-1
  insert into public.conversations (name) values (null) returning id into conv_id;
  insert into public.conversation_participants (conversation_id, user_id) values (conv_id, auth.uid());
  insert into public.conversation_participants (conversation_id, user_id) values (conv_id, other_user_id);

  return conv_id;
end;
$$;

-- -----------------------------------------------
-- RPC : créer une conversation avec participants
-- -----------------------------------------------
create or replace function create_conversation(
  participant_ids uuid[],
  conv_name       text default null
)
returns uuid language plpgsql security definer as $$
declare
  conv_id uuid;
  uid     uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.conversations (name)
  values (conv_name)
  returning id into conv_id;

  -- Ajoute le créateur
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, auth.uid());

  -- Ajoute les autres participants
  foreach uid in array participant_ids loop
    if uid <> auth.uid() then
      insert into public.conversation_participants (conversation_id, user_id)
      values (conv_id, uid)
      on conflict do nothing;
    end if;
  end loop;

  return conv_id;
end;
$$;

-- -----------------------------------------------
-- RPC : marquer une conversation comme lue
-- -----------------------------------------------
create or replace function mark_conversation_read(conv_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = conv_id and user_id = auth.uid();
end;
$$;

-- -----------------------------------------------
-- TRIGGER : updated_at sur nouvelle message
-- -----------------------------------------------
create or replace function update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_update_conversation
  after insert on public.messages
  for each row execute function update_conversation_timestamp();

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
