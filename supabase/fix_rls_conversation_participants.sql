-- Fix: infinite recursion in RLS policy on conversation_participants
-- The original policy queried conversation_participants from within
-- conversation_participants's own policy, causing infinite recursion.
-- Solution: use a SECURITY DEFINER function that bypasses RLS for the inner check.

-- 1. Helper function (runs as table owner, bypasses RLS)
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

-- 2. Drop the recursive policy and replace it
drop policy if exists "Voir participants" on public.conversation_participants;

create policy "Voir participants" on public.conversation_participants
  for select using (
    is_conversation_participant(conversation_id)
  );

-- 3. New RPC: find an existing 1-on-1 conversation or create one
--    Returns the conversation UUID (existing or newly created)
create or replace function find_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  -- Look for an existing direct (2-participant) conversation between the two users
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

  -- No existing conversation: create a new one
  insert into public.conversations (name) values (null) returning id into conv_id;
  insert into public.conversation_participants (conversation_id, user_id) values (conv_id, auth.uid());
  insert into public.conversation_participants (conversation_id, user_id) values (conv_id, other_user_id);

  return conv_id;
end;
$$;

