-- Film Kitaplığı — Supabase şeması
-- Supabase Dashboard → SQL Editor → bu dosyanın içeriğini yapıştır → Run

create table if not exists public.movies (
  id text not null,                                   -- IMDb id (tt...), al-... (anime) veya u_* (elle eklenen)
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  year int,
  type text not null default 'film',
  status text not null default 'towatch',
  rating int default 0,
  note text default '',
  image text,
  added_at bigint default 0,                          -- epoch ms
  watched_at bigint,                                  -- epoch ms (null = henüz izlenmedi)
  primary key (user_id, id),
  constraint movies_type check (type in ('film', 'dizi', 'anime')),
  constraint movies_status check (status in ('towatch', 'watched')),
  constraint movies_rating check (rating between 0 and 5)
);

alter table public.movies enable row level security;

-- Her kullanıcı yalnızca kendi satırlarını görebilir/yazabilir
drop policy if exists "Kullanici yalnizca kendi satirlari" on public.movies;
create policy "Kullanici yalnizca kendi satirlari"
  on public.movies
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists movies_user_idx on public.movies (user_id);

-- ---------------- geri bildirim / mesaj kutusu ----------------
-- Siteden gönderilen öneri-şikayetler buraya düşer; uygulama kutuyu
-- yalnızca sahibi (OWNER, kullanıcı adı thyke) için gösterir.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  from_username text not null default 'ziyaretci',
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read boolean not null default false
);

alter table public.feedback enable row level security;

-- gönderim: herkes (girişsiz ziyaretçi dahil)
drop policy if exists "Geri bildirim herkese acik" on public.feedback;
create policy "Geri bildirim herkese acik"
  on public.feedback
  for insert to anon, authenticated
  with check (true);

-- okuma: oturumlu kullanıcılar; uygulama kutuyu yalnızca sahibine gösterir
drop policy if exists "Geri bildirim oturumlu okur" on public.feedback;
create policy "Geri bildirim oturumlu okur"
  on public.feedback
  for select to authenticated
  using (true);

-- okundu işaretleme: oturumlu kullanıcılar
drop policy if exists "Geri bildirim okundu" on public.feedback;
create policy "Geri bildirim okundu"
  on public.feedback
  for update to authenticated
  using (true);
