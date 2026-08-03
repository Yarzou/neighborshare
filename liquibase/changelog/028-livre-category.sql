--liquibase formatted sql

-- =============================================
-- 028 : catégorie "Livres" (8e catégorie)
--       + champs auteur / état / genre
-- =============================================

-- L'ID est posé explicitement : lib/categories.ts code les IDs en dur,
-- on ne peut pas dépendre du prochain nextval de la séquence.
--changeset neighborshare:028-add-livre-category
insert into public.categories (id, slug, label, icon)
values (8, 'livre', 'Livres', '📚')
on conflict (slug) do nothing;

select setval(pg_get_serial_sequence('public.categories', 'id'),
              (select max(id) from public.categories));

--changeset neighborshare:028-book-fields
alter table public.listings
  add column if not exists book_author    text,
  add column if not exists book_condition text,
  add column if not exists book_genre     text;

--changeset neighborshare:028-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
