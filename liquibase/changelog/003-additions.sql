--liquibase formatted sql

-- =============================================
-- 003 : Nouvelles fonctions et politiques RLS
-- =============================================

--changeset neighborshare:003-fn-find-or-create-conversation splitStatements:false
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

--changeset neighborshare:003-fn-create-conversation splitStatements:false
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

--changeset neighborshare:003-messages-delete-policy
create policy "messages_delete" on public.messages
    for delete using (auth.uid() = sender_id);

--changeset neighborshare:003-fn-grants
grant execute on function find_or_create_conversation(uuid) to authenticated;
grant execute on function create_conversation(uuid[], text) to authenticated;

--changeset neighborshare:003-reload-schema-cache
select pg_notify('pgrst', 'reload schema');

--changeset neighborshare:003-participants-delete-policy
create policy "participants_delete" on public.conversation_participants
    for delete using (user_id = auth.uid());
