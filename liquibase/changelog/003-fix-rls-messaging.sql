--changeset neighborshare:003-is-participant-fn
create or replace function is_conversation_participant(conv_id uuid)
    returns boolean
    language sql
    security definer
    stable
    set search_path = public
as $$
select exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = conv_id
      and cp.user_id = auth.uid()
);
$$;
