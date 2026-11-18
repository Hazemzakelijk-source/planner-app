-- ============================================================
-- Herinneringen: tabellen en geheim wachtwoord
-- Plak dit in Supabase: SQL Editor -> New query -> Run.
-- ============================================================

-- Tabel 1: push-abonnementen. Eén rij per apparaat waarop je
-- herinneringen hebt aangezet. Apple geeft per apparaat een uniek
-- "adres" (endpoint) en twee sleutels (p256dh en auth) om het bericht
-- mee te versleutelen.
create table public.push_abonnementen (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aangemaakt_op timestamptz not null default now()
);

alter table public.push_abonnementen enable row level security;
grant select, insert, update, delete on public.push_abonnementen to authenticated;

-- Je mag alleen je eigen abonnementen zien, toevoegen, wijzigen en verwijderen.
create policy "Eigen abonnementen lezen" on public.push_abonnementen
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigen abonnementen toevoegen" on public.push_abonnementen
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigen abonnementen wijzigen" on public.push_abonnementen
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Eigen abonnementen verwijderen" on public.push_abonnementen
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Tabel 2: logboek van verstuurde herinneringen.
-- De primary key (gebruiker, datum, taak) zorgt dat dezelfde taak
-- er nooit twee keer in kan staan: zo sturen we nooit dubbel.
-- RLS staat aan zonder regels: alleen de Edge Function (service role) kan erbij.
create table public.verstuurde_herinneringen (
  user_id uuid not null references auth.users (id) on delete cascade,
  datum date not null,
  taak text not null, -- begintijd en naam, bijvoorbeeld "07:30 Hardlopen"
  verstuurd_op timestamptz not null default now(),
  primary key (user_id, datum, taak)
);

alter table public.verstuurde_herinneringen enable row level security;
revoke all on public.verstuurde_herinneringen from anon, authenticated;

-- Geheim wachtwoord voor de wekker (cron-job), bewaard in de Vault (de kluis).
-- De database verzint het zelf: niemand krijgt het te zien.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'herinneringen_geheim',
  'Wachtwoord waarmee de cron-job de Edge Function herinneringen mag starten'
);

-- Controle of een wachtwoord klopt. Alleen de Edge Function mag dit vragen.
-- security definer = de functie mag in de kluis kijken, ook al mag de vrager dat zelf niet.
create function public.herinneringen_geheim_klopt(geheim text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'herinneringen_geheim' and decrypted_secret = geheim
  );
$$;

revoke execute on function public.herinneringen_geheim_klopt(text) from public, anon, authenticated;
grant execute on function public.herinneringen_geheim_klopt(text) to service_role;
