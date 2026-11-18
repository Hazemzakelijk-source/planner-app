-- ============================================================
-- Database voor de Dagplanner
-- Plak dit in Supabase: SQL Editor -> New query -> Run.
-- ============================================================

-- Tabel 1: alle gegevens van één gebruiker, als één JSON-blok.
-- Dit is precies wat de app nu ook in de browser bewaart.
-- default auth.uid() = vul automatisch het id van de ingelogde gebruiker in.
-- on delete cascade = wordt de gebruiker verwijderd, dan verdwijnt deze rij ook.
create table public.planners (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  gegevens jsonb not null,
  bijgewerkt_op timestamptz not null default now()
);

-- Tabel 2: de score per dag. Eén rij per gebruiker per datum.
-- Later nodig voor vrienden en een ranglijst.
create table public.dagscores (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  datum date not null,
  score integer not null check (score between 0 and 100),
  primary key (user_id, datum)
);

-- Row Level Security aanzetten: zonder regel mag niemand iets.
alter table public.planners enable row level security;
alter table public.dagscores enable row level security;

-- Alleen ingelogde gebruikers mogen bij deze tabellen.
grant select, insert, update on public.planners to authenticated;
grant select, insert, update on public.dagscores to authenticated;

-- De regels: je mag alleen rijen lezen, toevoegen en wijzigen
-- waarvan user_id gelijk is aan jouw eigen id.
create policy "Eigen planner lezen" on public.planners
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigen planner toevoegen" on public.planners
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigen planner wijzigen" on public.planners
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Eigen dagscores lezen" on public.dagscores
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Eigen dagscores toevoegen" on public.dagscores
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Eigen dagscores wijzigen" on public.dagscores
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
