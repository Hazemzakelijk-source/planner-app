// ============================================================
// Edge Function "herinneringen"
// ============================================================
//
// Draait bij Supabase, niet op je telefoon. De cron-job start dit
// programma elke minuut. Het zoekt taken die over 30 minuten of minder
// beginnen en nog niet zijn afgevinkt, en stuurt daarvoor één pushmelding.
//
// Geheimen komen uit de Supabase-secrets (Deno.env), nooit uit deze code:
// - SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY geeft Supabase vanzelf mee.
// - VAPID_PUBLIEK en VAPID_PRIVE hebben we zelf ingesteld.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { takenOmTeHerinneren } from "./taken.ts";

const APP_ADRES = "https://hazemzakelijk-source.github.io/planner-app/";

// De service role mag bij de gegevens van alle gebruikers (RLS geldt niet).
// Daarom draait dit alleen hier, bij Supabase, en nooit in de app.
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  APP_ADRES,
  Deno.env.get("VAPID_PUBLIEK")!,
  Deno.env.get("VAPID_PRIVE")!,
);

async function verstuurHerinneringen(nu: Date) {
  // 1. Alle apparaten met herinneringen aan, per gebruiker gegroepeerd
  const { data: abonnementen, error: fout1 } = await db
    .from("push_abonnementen")
    .select("id, user_id, endpoint, p256dh, auth");
  if (fout1) throw fout1;
  if (abonnementen.length === 0) return 0;

  const gebruikers = [...new Set(abonnementen.map((a) => a.user_id))];

  // 2. De planners van die gebruikers
  const { data: planners, error: fout2 } = await db
    .from("planners")
    .select("user_id, gegevens")
    .in("user_id", gebruikers);
  if (fout2) throw fout2;

  let verstuurd = 0;
  for (const planner of planners) {
    for (const { datum, taak, overMinuten } of takenOmTeHerinneren(planner.gegevens, nu)) {
      // 3. Eerst in het logboek schrijven. Staat de taak er al (foutcode 23505,
      //    "bestaat al"), dan is de melding al verstuurd: overslaan.
      const { error } = await db.from("verstuurde_herinneringen").insert({
        user_id: planner.user_id,
        datum,
        taak: `${taak.begintijd} ${taak.naam}`,
      });
      if (error?.code === "23505") continue;
      if (error) throw error;

      // 4. De melding naar elk apparaat van deze gebruiker sturen
      const bericht = JSON.stringify({
        titel: `⏰ Over ${overMinuten} minuten`,
        tekst: `${taak.naam} (${taak.begintijd})`,
        tag: `${datum} ${taak.begintijd} ${taak.naam}`,
      });
      for (const abonnement of abonnementen.filter((a) => a.user_id === planner.user_id)) {
        try {
          await webpush.sendNotification(
            { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } },
            bericht,
            { TTL: 30 * 60 }, // bewaar het bericht hooguit 30 minuten als de telefoon uit staat
          );
          verstuurd++;
        } catch (fout) {
          // 404 of 410: dit abonnement bestaat niet meer (bijvoorbeeld app verwijderd). Opruimen.
          const status = (fout as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from("push_abonnementen").delete().eq("id", abonnement.id);
          } else {
            console.error("Versturen mislukt", status);
          }
        }
      }
    }
  }
  return verstuurd;
}

Deno.serve(async (verzoek) => {
  // Alleen de cron-job kent het geheime wachtwoord uit de Vault.
  const geheim = verzoek.headers.get("x-herinneringen-geheim") ?? "";
  const { data: klopt } = await db.rpc("herinneringen_geheim_klopt", { geheim });
  if (!klopt) return new Response("Geen toegang", { status: 401 });

  try {
    const verstuurd = await verstuurHerinneringen(new Date());
    return Response.json({ verstuurd });
  } catch (fout) {
    console.error(fout);
    return new Response("Er ging iets mis", { status: 500 });
  }
});
