-- WTW database schema. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: it only creates things that don't exist yet.

-- ───────────────────────── profiles ─────────────────────────
-- One row per signed-in user, created automatically on sign-up.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Movie fan',
  region       text not null default 'US',          -- for streaming availability later
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── ratings ─────────────────────────
-- The ONLY table the taste profile reads from.
-- rating: -1 = didn't like, 1 = liked, 2 = loved
create table if not exists public.ratings (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  rating      smallint not null check (rating in (-1, 1, 2)),
  title       text not null,
  poster_path text,
  rated_at    timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

-- ───────────────────────── watchlist ─────────────────────────
-- Things you want to watch. Never affects the taste profile:
-- when you log a watchlist item as watched, it moves into ratings.
create table if not exists public.watchlist (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  title       text not null,
  poster_path text,
  added_at    timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

-- ───────────────────────── skips ─────────────────────────
-- "Haven't seen it" on the swipe deck, so the card isn't shown again.
-- No effect on taste.
create table if not exists public.skips (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  skipped_at  timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

-- ───────────────────────── title_cache ─────────────────────────
-- Shared cache of TMDB features (genres, keywords, people) used to build taste profiles.
create table if not exists public.title_cache (
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  data        jsonb not null,
  fetched_at  timestamptz not null default now(),
  primary key (tmdb_id, media_type)
);

-- ───────────────────────── row level security ─────────────────────────
alter table public.profiles    enable row level security;
alter table public.ratings     enable row level security;
alter table public.watchlist   enable row level security;
alter table public.skips       enable row level security;
alter table public.title_cache enable row level security;

-- Profiles: everyone signed in can see names (needed for pairing later); you edit only yours.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Ratings: readable by all signed-in users (so two people can be matched), writable only by owner.
drop policy if exists "ratings read" on public.ratings;
create policy "ratings read" on public.ratings
  for select to authenticated using (true);
drop policy if exists "ratings write own" on public.ratings;
create policy "ratings write own" on public.ratings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Watchlist: same idea.
drop policy if exists "watchlist read" on public.watchlist;
create policy "watchlist read" on public.watchlist
  for select to authenticated using (true);
drop policy if exists "watchlist write own" on public.watchlist;
create policy "watchlist write own" on public.watchlist
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Skips: private.
drop policy if exists "skips own" on public.skips;
create policy "skips own" on public.skips
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Title cache: shared by everyone signed in.
drop policy if exists "title_cache read" on public.title_cache;
create policy "title_cache read" on public.title_cache
  for select to authenticated using (true);
drop policy if exists "title_cache insert" on public.title_cache;
create policy "title_cache insert" on public.title_cache
  for insert to authenticated with check (true);
drop policy if exists "title_cache update" on public.title_cache;
create policy "title_cache update" on public.title_cache
  for update to authenticated using (true) with check (true);
