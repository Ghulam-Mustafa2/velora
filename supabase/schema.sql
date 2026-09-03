create extension if not exists "pgcrypto";

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  category text not null,
  description text not null default '',
  youtube_channel_id text null,
  youtube_handle text null,
  official_embed_url text null,
  logo_local text null,
  coming_soon boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_channels_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists channels_set_updated_at on public.channels;
create trigger channels_set_updated_at
before update on public.channels
for each row
execute function public.set_channels_updated_at();

alter table public.channels enable row level security;

drop policy if exists "Public can read active channels" on public.channels;
create policy "Public can read active channels"
on public.channels
for select
to anon, authenticated
using (is_active = true);
