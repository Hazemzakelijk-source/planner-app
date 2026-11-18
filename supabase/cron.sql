-- ============================================================
-- De wekker: start de Edge Function "herinneringen" elke minuut
-- Plak dit in Supabase: SQL Editor -> New query -> Run.
-- ============================================================

-- pg_cron = de wekker in de database; pg_net = laat de database een webadres aanroepen
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- '* * * * *' betekent: elke minuut, elk uur, elke dag.
-- Het geheime wachtwoord wordt bij elke aanroep uit de Vault gehaald;
-- het staat dus nergens als tekst.
select cron.schedule(
  'herinneringen-elke-minuut',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://qcuahxaqmgygnqlbjvbt.supabase.co/functions/v1/herinneringen',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-herinneringen-geheim',
      (select decrypted_secret from vault.decrypted_secrets where name = 'herinneringen_geheim')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
