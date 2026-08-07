--liquibase formatted sql

-- =============================================
-- 039 : performances — index manquants et lecture groupée de la messagerie
--
-- Deux sujets, un seul fichier parce qu'ils se tiennent : les fonctions
-- ci-dessous ne valent que servies par les index, et l'index le plus utile
-- (`messages(conversation_id, created_at)`) l'est d'abord pour elles.
--
-- ── Rétrocompatibilité (CLAUDE.md §6) ────────────────────────────────────────
-- Migration PUREMENT ADDITIVE : aucun `drop`, aucun `rename`, aucune signature
-- modifiée, aucune policy touchée. Le code actuellement déployé — les quatre
-- requêtes de `MessagesClient`, les deux de `useUnreadCount`, la boucle de
-- `poll_results` — continue de tourner à l'identique après application ; il
-- devient seulement plus rapide. Symétriquement, le nouveau code tolère que
-- cette migration ne soit pas encore passée : `lib/messaging.ts` détecte
-- l'absence des fonctions (PGRST202) et retombe sur l'ancien chemin.
--
-- ── Pourquoi pas `create index concurrently` ─────────────────────────────────
-- Interdit dans une transaction : il faudrait poser `runInTransaction:false`,
-- donc perdre l'atomicité du lot et la clause de retour arrière qui va avec
-- (règle 4 de CLAUDE.md).
--
-- À l'échelle d'un lotissement, un `create index` ordinaire dure
-- quelques millisecondes sous verrou SHARE — les lectures passent, seules les
-- écritures attendent. Piège associé : `concurrently` + `if not exists`
-- masquerait silencieusement un index resté INVALID après un échec, puisque le
-- nom existe déjà. À reconsidérer si `messages` dépassait le million de lignes ;
-- il faudrait alors un fichier dédié, sans `if not exists`, et une vérification
-- de `pg_index.indisvalid`.
--
-- ── Index volontairement NON créés ───────────────────────────────────────────
-- Ne pas les rajouter « par principe » : chaque index proposé a été confronté
-- au code, et ceux-là ne sont sur aucun chemin d'accès réel.
--   · listings(category_id)  — jamais filtré seul ; /recent filtre toujours
--     d'abord sur status puis trie sur created_at (index ci-dessous).
--   · listings(expires_at)   — la vue listings_geo garde ~toutes les lignes
--     (`is null or > now()`), le planificateur préférera toujours le parcours.
--   · listings(updated_at), conversations(updated_at) — tri appliqué après un
--     filtre qui a déjà réduit à quelques lignes.
--   · announcements(author_id), providers(created_by), group_purchases(created_by),
--     polls(created_by), message_reactions(user_id), group_purchase_participants(user_id)
--     — un embed PostgREST `profiles!author_id(...)` est *to-one* : il résout
--     `profiles.id`, la clé primaire côté parent, jamais la colonne enfant. Ces
--     colonnes ne servent qu'à la cascade de suppression de compte, sur des
--     tables de quelques dizaines de lignes.
-- =============================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Index — messagerie
-- ─────────────────────────────────────────────────────────────────────────────

-- La requête la plus chaude de l'application, et la seule où le RLS coûte cher :
-- la policy `messages_select` (002) appelle `is_conversation_participant()` avec
-- la colonne de la LIGNE en argument, donc une fois par ligne scannée. Sans
-- index, ouvrir une conversation parcourt toute la table `messages` ET exécute
-- la fonction autant de fois. L'index ramène les deux à la cinquantaine de
-- lignes réellement lues.
-- Sert : app/messages/[id]/page.tsx (eq conversation_id + order created_at +
-- limit 50), app/messages/MessagesClient.tsx, lib/hooks.ts, et les deux
-- fonctions définies plus bas.
--changeset neighborshare:039-idx-messages
create index if not exists messages_conversation_created_idx
    on public.messages (conversation_id, created_at);

-- Aucune requête ne filtre sur `sender_id` — le `.neq()` de lib/hooks.ts n'est
-- pas indexable. Justifié par la cascade `on delete cascade` depuis `profiles` :
-- sans lui, DELETE /api/account/delete parcourt intégralement la plus grosse
-- table du schéma. Seule clé étrangère dont la table enfant grossit vraiment.
create index if not exists messages_sender_id_idx
    on public.messages (sender_id);
--rollback drop index if exists public.messages_sender_id_idx;
--rollback drop index if exists public.messages_conversation_created_idx;

-- La clé primaire est (conversation_id, user_id) : elle ne peut pas servir un
-- filtre sur `user_id` seul, qui est pourtant le tout premier accès de la
-- messagerie et de la pastille de non-lus.
-- Bénéficiaire principal : `find_or_create_conversation` (016), dont le
-- self-join cp1/cp2 plus le `count(*)` corrélé font aujourd'hui deux parcours
-- complets par appel.
-- ⚠️ Volontairement NON partiel sur `deleted_at is null`, bien que les deux
-- appels applicatifs ajoutent ce prédicat : 016 interroge délibérément les
-- conversations soft-deleted (« inclut les soft-deleted », commentaire d'origine).
-- Un index partiel exclurait justement son cas d'usage.
--changeset neighborshare:039-idx-conversation-participants
create index if not exists conversation_participants_user_id_idx
    on public.conversation_participants (user_id);
--rollback drop index if exists public.conversation_participants_user_id_idx;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index — annonces
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-idx-listings
-- `created_at desc` en second terme parce que app/profil/[id] et
-- app/profile/ProfileClient trient exactement ainsi : le tri disparaît du plan.
-- Le préfixe `user_id` seul sert app/demandes et lib/hooks.ts.
create index if not exists listings_user_created_idx
    on public.listings (user_id, created_at desc);

-- Partiel : `responder_id` n'est posé qu'aux statuts en_cours/validee, il est
-- donc NULL sur la grande majorité des lignes. Les trois appels utilisent
-- `= uid`, et le planificateur en déduit `is not null` — l'index partiel est
-- retenu, et bien plus petit.
create index if not exists listings_responder_id_idx
    on public.listings (responder_id)
    where responder_id is not null;

-- app/recent : eq('status','disponible') puis order created_at desc, avec
-- pagination par .range(). Couvre aussi les in('status', [...]) de /demandes.
create index if not exists listings_status_created_idx
    on public.listings (status, created_at desc);

-- app/messages/[id] : eq('conversation_id', id).maybeSingle(), sur une page
-- chaude. Sert également la vérification de la clé étrangère vers conversations.
-- Partiel pour la même raison que responder_id.
create index if not exists listings_conversation_id_idx
    on public.listings (conversation_id)
    where conversation_id is not null;
--rollback drop index if exists public.listings_conversation_id_idx;
--rollback drop index if exists public.listings_status_created_idx;
--rollback drop index if exists public.listings_responder_id_idx;
--rollback drop index if exists public.listings_user_created_idx;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index — sondages
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-idx-poll-votes
-- PollsSection lit `poll_votes` SANS AUCUN FILTRE : tout le filtrage vient de la
-- policy `poll_votes_select_own` (036), `user_id = auth.uid()`. C'est donc un
-- parcours complet de la table à chaque affichage de /infos.
create index if not exists poll_votes_user_id_idx
    on public.poll_votes (user_id);

-- `poll_results()` (036) et `poll_results_bulk()` (plus bas) joignent sur
-- `v.option_id = o.id` ; la clé primaire (poll_id, user_id) ne couvre pas
-- `option_id`. Sert aussi la cascade poll_options → poll_votes à la suppression
-- d'un sondage.
create index if not exists poll_votes_option_id_idx
    on public.poll_votes (option_id);
--rollback drop index if exists public.poll_votes_option_id_idx;
--rollback drop index if exists public.poll_votes_user_id_idx;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Vue d'ensemble des conversations, en une requête
--
-- Remplace quatre requêtes séquentielles dont un `select` sur `messages` NON
-- BORNÉ : pour retrouver le dernier message de chaque fil, le client ramenait
-- l'intégralité de son historique, à l'ouverture de /messages ET à chaque
-- INSERT Realtime.
--
-- `security definer` assumé, et nécessaire : sous RLS, chaque ligne de
-- `messages` réévalue `is_conversation_participant()`, ce qui annulerait le
-- bénéfice du regroupement. Le périmètre est refermé DANS la fonction par la CTE
-- `mine`, qui n'existe que pour l'appelant : hors de ses propres conversations
-- la fonction ne peut rien retourner, et pour `anon` (auth.uid() NULL) `mine`
-- est vide, donc le résultat aussi.
--
-- `language sql` et non plpgsql : les colonnes de `returns table` sont des
-- paramètres OUT, et une référence non qualifiée lèverait « column reference is
-- ambiguous ». Toutes les colonnes sont malgré tout préfixées par leur alias.
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-fn-conversations-overview splitStatements:false
create or replace function public.conversations_overview()
returns table (
    conversation_id        uuid,
    name                   text,
    created_at             timestamptz,
    updated_at             timestamptz,
    last_message_id        uuid,
    last_message_content   text,
    last_message_at        timestamptz,
    last_sender_id         uuid,
    last_message_is_system boolean,
    unread_count           bigint,
    participants           jsonb
)
language sql
stable
security definer
set search_path = public
as $func$
    -- Mes participations non supprimées : seule porte d'entrée, tout se joint
    -- dessus. `(select auth.uid())` plutôt que `auth.uid()` : évalué une fois
    -- par requête en InitPlan, convention adoptée à partir de cette migration.
    with mine as (
        select cp.conversation_id, cp.last_read_at, cp.visible_from
          from public.conversation_participants cp
         where cp.user_id = (select auth.uid())
           and cp.deleted_at is null
    ),
    -- Dernier message VISIBLE de chaque fil. `distinct on` + l'index
    -- (conversation_id, created_at) lit une seule ligne par conversation, là où
    -- le client ramenait tout l'historique pour faire ce tri en mémoire.
    last_msg as (
        select distinct on (m.conversation_id)
               m.conversation_id,
               m.id,
               m.content,
               m.created_at,
               m.sender_id,
               m.is_system
          from public.messages m
          join mine on mine.conversation_id = m.conversation_id
         where mine.visible_from is null
            or m.created_at >= mine.visible_from
         order by m.conversation_id, m.created_at desc, m.id desc
    ),
    -- Décompte réel des non-lus. Le client calculait un 0/1 à partir du seul
    -- dernier message ; `ConversationRow` ne testant que `> 0`, aucun rendu ne
    -- change, mais la valeur devient exacte.
    -- Comparaison native timestamptz : le piège « Z » vs « +00:00 » documenté
    -- dans lib/hooks.ts n'existe pas en SQL, il ne concernait que des chaînes.
    unread as (
        select m.conversation_id, count(*) as n
          from public.messages m
          join mine on mine.conversation_id = m.conversation_id
         where m.sender_id <> (select auth.uid())
           and m.created_at > mine.last_read_at
           and (mine.visible_from is null or m.created_at >= mine.visible_from)
         group by m.conversation_id
    ),
    -- Participants + profil, au format déjà consommé par ConversationRow.
    -- Le `deleted_at` des AUTRES n'est pas filtré : une conversation qu'un
    -- voisin a masquée de son côté doit rester nommée correctement chez moi.
    parts as (
        select cp.conversation_id,
               jsonb_agg(
                   jsonb_build_object(
                       'conversation_id', cp.conversation_id,
                       'user_id',         cp.user_id,
                       'last_read_at',    cp.last_read_at,
                       'joined_at',       cp.joined_at,
                       'profiles', jsonb_build_object(
                           'id',           p.id,
                           'username',     p.username,
                           'full_name',    p.full_name,
                           'avatar_url',   p.avatar_url,
                           'avatar_color', p.avatar_color
                       )
                   )
                   order by cp.joined_at, cp.user_id
               ) as participants
          from public.conversation_participants cp
          join mine on mine.conversation_id = cp.conversation_id
          left join public.profiles p on p.id = cp.user_id
         group by cp.conversation_id
    )
    select c.id,
           c.name,
           c.created_at,
           c.updated_at,
           lm.id,
           lm.content,
           lm.created_at,
           lm.sender_id,
           lm.is_system,
           coalesce(u.n, 0),
           coalesce(pa.participants, '[]'::jsonb)
      from public.conversations c
      join mine          on mine.conversation_id = c.id
      left join last_msg lm on lm.conversation_id = c.id
      left join unread   u  on u.conversation_id  = c.id
      left join parts    pa on pa.conversation_id = c.id
     -- Même tri que le code remplacé. `conversations.updated_at` est maintenu
     -- par le trigger `messages_update_conversation_ts` (002), il suit donc bien
     -- le dernier message. `c.id` départage pour un ordre déterministe.
     order by c.updated_at desc, c.id;
$func$;
--rollback drop function if exists public.conversations_overview();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Compteur de non-lus, pour la pastille de la navbar
--
-- Cette pastille est montée sur CHAQUE page. Elle coûtait deux requêtes, dont un
-- `select` sur `messages` borné par le plus ancien `last_read_at` de toutes les
-- conversations — c'est-à-dire, en pratique, non borné.
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-fn-unread-message-count splitStatements:false
create or replace function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public
as $func$
    select coalesce(count(*), 0)::integer
      from public.messages m
      join public.conversation_participants cp
        on cp.conversation_id = m.conversation_id
       and cp.user_id = (select auth.uid())
       and cp.deleted_at is null
     where m.sender_id <> (select auth.uid())
       and m.created_at > cp.last_read_at
       and (cp.visible_from is null or m.created_at >= cp.visible_from);
$func$;
--rollback drop function if exists public.unread_message_count();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Résultats de plusieurs sondages en un appel
--
-- PollsSection déclenchait un `poll_results()` PAR sondage : N allers-retours et
-- N agrégations serveur à chaque affichage de /infos, rejoués à chaque
-- changement d'utilisateur.
--
-- La règle « résultats visibles après avoir voté » de 036 est reprise à
-- l'identique : un sondage auquel l'appelant n'a pas droit est simplement ABSENT
-- du résultat. Différence assumée avec `poll_results()`, qui lève une exception —
-- ici lever ferait échouer le lot entier à cause d'un seul sondage.
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-fn-poll-results-bulk splitStatements:false
create or replace function public.poll_results_bulk(p_poll_ids uuid[])
returns table (poll_id uuid, option_id uuid, label text, votes bigint)
language sql
stable
security definer
set search_path = public
as $func$
    with allowed as (
        select p.id
          from public.polls p
         where p.id = any(p_poll_ids)
           and (
                 -- a voté
                 exists (select 1 from public.poll_votes v
                          where v.poll_id = p.id and v.user_id = (select auth.uid()))
                 -- ou sondage clos
                 or (p.closes_at is not null and p.closes_at < current_date)
                 -- ou son auteur
                 or p.created_by = (select auth.uid())
               )
    )
    select o.poll_id, o.id, o.label, count(v.user_id)
      from public.poll_options o
      join allowed a on a.id = o.poll_id
      left join public.poll_votes v on v.option_id = o.id
     group by o.poll_id, o.id, o.label, o.position
     order by o.poll_id, o.position;
$func$;
--rollback drop function if exists public.poll_results_bulk(uuid[]);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Droits d'exécution
--
-- Le `revoke ... from public` n'est pas décoratif : PostgreSQL accorde EXECUTE à
-- PUBLIC par défaut sur toute fonction nouvellement créée. Sans lui, trois
-- fonctions `security definer` seraient exécutables par le rôle `anon` — ce qui
-- rouvrirait par la bande les données que la migration 030 a fermées.
-- (Elles retourneraient vide, `auth.uid()` étant NULL, mais on ne fait pas
-- reposer une fermeture sur une propriété de la requête.)
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-grants
revoke execute on function public.conversations_overview()        from public;
revoke execute on function public.unread_message_count()          from public;
revoke execute on function public.poll_results_bulk(uuid[])       from public;
grant  execute on function public.conversations_overview()        to authenticated;
grant  execute on function public.unread_message_count()          to authenticated;
grant  execute on function public.poll_results_bulk(uuid[])       to authenticated;
--rollback revoke execute on function public.poll_results_bulk(uuid[]) from authenticated;
--rollback revoke execute on function public.unread_message_count() from authenticated;
--rollback revoke execute on function public.conversations_overview() from authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Realtime sur `listings`
--
-- `usePendingRequests` (lib/hooks.ts) s'abonne depuis toujours à UPDATE sur
-- `listings`, mais la publication `supabase_realtime` ne contient que `messages`,
-- `conversation_participants` (017) et `message_reactions` (022). Ces callbacks
-- ne pouvaient donc JAMAIS se déclencher : la pastille « Demandes » ne bougeait
-- qu'au changement de page. On aligne la base sur ce que le code croit déjà faire.
--
-- Bloc DO plutôt qu'un simple ALTER : `alter publication ... add table` échoue
-- si la table est déjà membre, et cette migration doit pouvoir être rejouée.
-- ─────────────────────────────────────────────────────────────────────────────

--changeset neighborshare:039-realtime-listings splitStatements:false
do $$
begin
  if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'listings'
     ) then
    alter publication supabase_realtime add table public.listings;
  end if;
end;
$$;
--rollback alter publication supabase_realtime drop table public.listings;


--changeset neighborshare:039-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
