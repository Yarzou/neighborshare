--liquibase formatted sql

-- =============================================
-- 002 : Fonctions et RLS avancee NeighborShare
-- =============================================

--changeset neighborshare:002-fn-handle-new-user splitStatements:false
create or replace function handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as $func$
begin
    insert into public.profiles (id, username, full_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'full_name'
    )
    on conflict (id) do nothing;
    return new;
end;
$func$;

--changeset neighborshare:002-trigger-handle-new-user
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

--changeset neighborshare:002-fn-is-participant splitStatements:false
create or replace function is_conversation_participant(conv_id uuid)
    returns boolean
    language sql
    security definer
    stable
    set search_path = public
as $func$
select exists (
    select 1
    from public.conversation_participants
    where conversation_id = conv_id
      and user_id = auth.uid()
)
$func$;

--changeset neighborshare:002-messaging-rls
create policy "conversations_select" on public.conversations
    for select using (is_conversation_participant(id));
create policy "conversations_insert" on public.conversations
    for insert with check (auth.uid() is not null);
create policy "conversations_update" on public.conversations
    for update using (is_conversation_participant(id));
create policy "participants_select" on public.conversation_participants
    for select using (is_conversation_participant(conversation_id));
create policy "participants_insert" on public.conversation_participants
    for insert with check (auth.uid() is not null);
create policy "participants_update" on public.conversation_participants
    for update using (user_id = auth.uid());
create policy "messages_select" on public.messages
    for select using (is_conversation_participant(conversation_id));
create policy "messages_insert" on public.messages
    for insert with check (auth.uid() = sender_id and is_conversation_participant(conversation_id));

--changeset neighborshare:002-fn-listings-radius splitStatements:false
create or replace function listings_within_radius(
    lat       float,
    lng       float,
    radius_km float default 5
)
    returns table (
        id          uuid,
        user_id     uuid,
        category_id integer,
        title       text,
        description text,
        type        listing_type,
        status      listing_status,
        image_url   text,
        address     text,
        city        text,
        created_at  timestamptz,
        distance_m  float,
        lat_out     float,
        lng_out     float
    )
    language sql
    stable
as $func$
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
$func$;

--changeset neighborshare:002-fn-update-conv-ts splitStatements:false
create or replace function update_conversation_timestamp()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as $func$
begin
    update public.conversations
    set updated_at = now()
    where id = new.conversation_id;
    return new;
end;
$func$;

--changeset neighborshare:002-trigger-update-conv-ts
create trigger messages_update_conversation_ts
    after insert on public.messages
    for each row execute function update_conversation_timestamp();

--changeset neighborshare:002-fn-contact-listing splitStatements:false
create or replace function contact_listing(
    p_listing_id    uuid,
    p_first_message text
)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user_id uuid := auth.uid();
    v_listing listings%rowtype;
    v_conv_id uuid;
begin
    if v_user_id is null then
        raise exception 'Non authentifie';
    end if;

    select * into v_listing from listings where id = p_listing_id;
    if not found then
        raise exception 'Annonce introuvable';
    end if;

    if v_listing.status <> 'disponible' then
        raise exception 'Cette annonce n''est plus disponible';
    end if;

    if v_listing.user_id = v_user_id then
        raise exception 'Vous ne pouvez pas contacter votre propre annonce';
    end if;

    insert into conversations default values returning id into v_conv_id;

    insert into conversation_participants (conversation_id, user_id) values
        (v_conv_id, v_listing.user_id),
        (v_conv_id, v_user_id);

    insert into messages (conversation_id, sender_id, content)
    values (v_conv_id, v_user_id, p_first_message);

    update listings
    set status          = 'en_cours',
        responder_id    = v_user_id,
        conversation_id = v_conv_id,
        updated_at      = now()
    where id = p_listing_id;

    return v_conv_id;
end;
$func$;

--changeset neighborshare:002-fn-validate-listing splitStatements:false
create or replace function validate_listing_response(p_listing_id uuid)
    returns void
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user_id uuid := auth.uid();
    v_listing listings%rowtype;
begin
    select * into v_listing from listings where id = p_listing_id;
    if not found then
        raise exception 'Annonce introuvable';
    end if;
    if v_listing.user_id <> v_user_id then
        raise exception 'Seul le proprietaire peut valider';
    end if;
    if v_listing.status <> 'en_cours' then
        raise exception 'La demande n''est pas en cours';
    end if;

    update listings
    set status     = 'validee',
        updated_at = now()
    where id = p_listing_id;
end;
$func$;

--changeset neighborshare:002-fn-cancel-listing splitStatements:false
create or replace function cancel_listing_response(p_listing_id uuid)
    returns void
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user_id uuid := auth.uid();
    v_listing listings%rowtype;
begin
    select * into v_listing from listings where id = p_listing_id;
    if not found then
        raise exception 'Annonce introuvable';
    end if;
    if v_listing.user_id <> v_user_id
       and (v_listing.responder_id is null or v_listing.responder_id <> v_user_id) then
        raise exception 'Permission insuffisante';
    end if;

    update listings
    set status          = 'disponible',
        responder_id    = null,
        conversation_id = null,
        updated_at      = now()
    where id = p_listing_id;
end;
$func$;

--changeset neighborshare:002-fn-mark-read splitStatements:false
create or replace function mark_conversation_read(conv_id uuid)
    returns void
    language plpgsql
    security definer
    set search_path = public
as $func$
begin
    update public.conversation_participants
    set last_read_at = now()
    where conversation_id = conv_id
      and user_id = auth.uid();
end;
$func$;

--changeset neighborshare:002-fn-find-or-create-conversation splitStatements:false
create or replace function find_or_create_conversation(other_user_id uuid)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_conv_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Non authentifie';
    end if;

    -- Cherche une conversation 1-à-1 existante entre les deux utilisateurs
    select cp1.conversation_id into v_conv_id
    from public.conversation_participants cp1
    join public.conversation_participants cp2
        on cp1.conversation_id = cp2.conversation_id
    where cp1.user_id = auth.uid()
      and cp2.user_id = other_user_id
      and (
          select count(*)
          from public.conversation_participants cp3
          where cp3.conversation_id = cp1.conversation_id
      ) = 2
    limit 1;

    if v_conv_id is not null then
        return v_conv_id;
    end if;

    -- Pas de conversation existante : en crée une nouvelle
    insert into public.conversations (name) values (null) returning id into v_conv_id;
    insert into public.conversation_participants (conversation_id, user_id) values (v_conv_id, auth.uid());
    insert into public.conversation_participants (conversation_id, user_id) values (v_conv_id, other_user_id);

    return v_conv_id;
end;
$func$;

--changeset neighborshare:002-fn-create-conversation splitStatements:false
create or replace function create_conversation(
    participant_ids uuid[],
    conv_name       text default null
)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_conv_id uuid;
    v_uid     uuid := auth.uid();
    v_pid     uuid;
begin
    if v_uid is null then
        raise exception 'Non authentifie';
    end if;

    insert into public.conversations (name) values (conv_name) returning id into v_conv_id;

    -- Ajoute le créateur
    insert into public.conversation_participants (conversation_id, user_id) values (v_conv_id, v_uid);

    -- Ajoute les autres participants (sans doublon si le créateur est dans la liste)
    foreach v_pid in array participant_ids loop
        if v_pid <> v_uid then
            insert into public.conversation_participants (conversation_id, user_id)
            values (v_conv_id, v_pid)
            on conflict do nothing;
        end if;
    end loop;

    return v_conv_id;
end;
$func$;

--changeset neighborshare:002-fn-grants
grant execute on function handle_new_user() to authenticated;
grant execute on function is_conversation_participant(uuid) to authenticated, anon;
grant execute on function listings_within_radius(float, float, float) to authenticated, anon;
grant execute on function update_conversation_timestamp() to authenticated;
grant execute on function contact_listing(uuid, text) to authenticated;
grant execute on function validate_listing_response(uuid) to authenticated;
grant execute on function cancel_listing_response(uuid) to authenticated;
grant execute on function mark_conversation_read(uuid) to authenticated;
grant execute on function find_or_create_conversation(uuid) to authenticated;
grant execute on function create_conversation(uuid[], text) to authenticated;

--changeset neighborshare:002-reload-schema-cache runOnChange:false
select pg_notify('pgrst', 'reload schema');
