--liquibase formatted sql

-- =============================================
-- 024 : Table events (événements de quartier)
-- =============================================

--changeset neighborshare:024-events-table
create table if not exists public.events (
    id             uuid default gen_random_uuid() primary key,
    user_id        uuid references auth.users(id) on delete cascade not null,
    title          text not null,
    description    text,
    event_date     timestamptz not null,
    event_end_date timestamptz,
    location_text  text,
    location_lat   float8,
    location_lng   float8,
    image_urls     text[] default '{}',
    created_at     timestamptz default now()
);

create index if not exists events_event_date_idx on public.events (event_date);
create index if not exists events_user_id_idx    on public.events (user_id);

alter table public.events enable row level security;

create policy "events_select_all"
    on public.events for select
    using (true);

create policy "events_insert_own"
    on public.events for insert
    with check (auth.uid() = user_id);

create policy "events_update_own"
    on public.events for update
    using (auth.uid() = user_id);

create policy "events_delete_own"
    on public.events for delete
    using (auth.uid() = user_id);

--changeset neighborshare:024-events-storage
insert into storage.buckets (id, name, public)
values ('events', 'events', true)
on conflict (id) do nothing;

create policy "events_storage_select"
    on storage.objects for select
    using (bucket_id = 'events');

create policy "events_storage_insert"
    on storage.objects for insert
    with check (bucket_id = 'events' and auth.uid() is not null);

create policy "events_storage_delete"
    on storage.objects for delete
    using (bucket_id = 'events' and auth.uid()::text = (storage.foldername(name))[1]);
