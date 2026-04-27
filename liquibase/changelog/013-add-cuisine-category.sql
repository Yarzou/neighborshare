--liquibase formatted sql

--changeset neighborshare:013-add-cuisine-category
insert into public.categories (slug, label, icon)
values ('cuisine', 'Cuisine', '🍳')
on conflict (slug) do nothing;
