# Dagplanner met disciplinescore

## Doel
Een dagplanner met een disciplinescore, gebouwd door Hazem als leerproject om te leren bouwen met Claude Code. Hazem is beginner in programmeren. Daarna volgt een groter project: een administratiekantoor met een app voor anderstalige zzp'ers. Wat hier geleerd wordt (inloggen, Supabase, synchronisatie, meldingen) komt daar later terug.

## Gebruik
- Website: hazemzakelijk-source.github.io/planner-app (GitHub Pages)
- Draait vooral als app op het beginscherm van de iPhone, en ook op de laptop
- Database: Supabase, project "planner-app" in Frankfurt (gratis plan)
- Nu één gebruiker (Hazem). Later komen vrienden en teams erbij.

## Wat af is
1. Taken plannen voor morgen, plan vastzetten, score van maximaal 100 punten, weekgemiddelde
2. Belangrijkste taak telt dubbel, extra taken (tellen niet mee voor de score), notities, terugblik vanaf 18:00, focustimer, weekbalk, grafiek, reeks met vlammetje
3. Inloggen met een code van 6 cijfers per e-mail, via dagplanner.app@gmail.com
4. Synchronisatie van taken, dagscores en thema via Supabase tussen iPhone en laptop
5. Pushmelding een half uur voor een taak. Niet bij afgevinkte of verwijderde taken, en nooit dubbel
6. App-icoon: kalender met vinkje op indigo
7. Extra taken verwijderen, ook als het plan vastzit, met een bevestiging
8. Versiecontrole: een apparaat met oude gegevens overschrijft geen nieuwere wijzigingen. Wijzigingen terwijl je uitgelogd bent, gaan na het inloggen alsnog mee
9. Kleurthema's via het tandwieltje: fris pastel (standaard), licht, donker, fel, rustig blauw, automatisch en eigen kleuren met een contrastwaarschuwing (WCAG, 4,5 : 1). Met een knop "Terug naar standaard", geen flits bij het openen, en de statusbalk van de iPhone kleurt mee
10. Uitloggen geldt alleen voor het apparaat waarop je het doet
11. Alle invulvelden zijn minimaal 16px, zodat de iPhone niet inzoomt
12. Terugkijken naar eerdere dagen: taken, notities, terugblik en score met opbouw. Alleen lezen, tot en met gisteren. Te openen via "Eerdere dagen bekijken" of een staaf in de grafiek op Disciplinescore

## Belangrijke keuzes en waarom
- Inloggen met een code in plaats van een link: een link opent in Safari en niet in de app op het beginscherm
- Eigen Gmail als afzender: alleen zo konden de e-mailteksten worden aangepast
- Aparte tabel voor dagscores: nodig voor vrienden en een ranglijst later
- RLS staat aan: iedereen ziet alleen zijn eigen gegevens
- Samenvoegen per dag en niet per taak: genoeg voor één gebruiker. Bij vrienden en teams opnieuw bekijken
- De score moet eerlijk blijven. Nieuwe functies mogen de score niet ongemerkt veranderen
- Terugkijken is alleen lezen: een oude dag kun je niet meer aanpassen. De score van een oude dag wordt opnieuw berekend met de regels van nu

## Technische opbouw
Gewone HTML, CSS en JavaScript, zonder framework en zonder bouwstap. GitHub Pages serveert de bestanden zoals ze zijn.

**Bestanden**
- `index.html`: alle schermen (Morgen, Vandaag, Disciplinescore, Terugkijken, Instellingen), het menu, de accountbalk en de vensters voor inloggen en vastzetten.
- `app.js`: alle logica, in blokken met kopjes: opslag, de schermen, score, terugkijken, inloggen, synchroniseren, herinneringen en instellingen. `dagScoreOpbouw` geeft de drie delen van de score; `dagScore` telt ze op.
- `style.css`: alle kleuren zijn CSS-variabelen (`--accent`, `--achtergrond` enzovoort). Per thema is er een blok `[data-thema="..."]`.
- `thema.js`: laadt in `<head>` en zet het thema vóór het tekenen (geen flits). Bevat ook de contrastberekening (WCAG).
- `supabase.js`: de verbinding met Supabase (Project URL en publishable key, die openbaar mogen zijn).
- `sw.js` (service worker) en `manifest.webmanifest`: nodig voor pushmeldingen en de app op het beginscherm.
- `supabase/*.sql`: tabellen, RLS en de cron-job. Deze SQL voert Hazem zelf uit in de SQL Editor.
- `supabase/functions/herinneringen/`: de Edge Function. Het rekenwerk staat in `taken.ts`, met tests in `taken_test.ts` (`deno test supabase/functions/herinneringen`).

**Gegevens**
- Op het apparaat staat alles in localStorage onder `dagplanner`: `{ dagen: { "JJJJ-MM-DD": { vastgezetOp, taken: [...], terugblik } }, instellingen: { thema, eigen } }`.
- Extra notities in localStorage: `dagplanner-gebruiker`, `dagplanner-wacht` en `dagplanner-basis`.
- Taken hebben geen eigen id. Ze worden aangewezen met hun plek in de lijst.
- Supabase-tabellen, allemaal met RLS:
  - `planners`: één rij per gebruiker met alle gegevens als JSON, plus `bijgewerkt_op`.
  - `dagscores`: gebruiker, datum, score.
  - `push_abonnementen`: één rij per apparaat.
  - `verstuurde_herinneringen`: het logboek. Alleen de Edge Function kan erbij.

**Inloggen**
`signInWithOtp` mailt een code van 6 cijfers, `verifyOtp` controleert die. Uitloggen gebeurt met `scope: "local"`, dus alleen op dat apparaat.

**Synchronisatie en versiecontrole**
- Elke wijziging gaat via `bewaarGegevens` naar localStorage. Daarna stuurt `planSync` na 1 seconde alles naar Supabase, samen met de dagscores.
- `bijgewerkt_op` werkt als versienummer. Een apparaat werkt de rij alleen bij als die nog op zijn bekende versie staat (`dagplanner-basis`).
- Weigert Supabase, dan volgt een drieweg-samenvoeging (`voegDrieweg`), per dag en voor de instellingen apart.
- Bij openen en bij terugkomen in de app haalt het apparaat de online versie op.
- Bij de eerste keer inloggen op een apparaat voegt `voegSamen` de dagen van het apparaat toe aan wat er online staat.

**Thema's**
- `data-thema` op `<html>` kiest het blok met kleuren.
- "Automatisch" kiest pastel of donker via `prefers-color-scheme`.
- Bij "Eigen kleuren" staan drie kleuren direct op `<html>`. De rest rekent de CSS uit met `color-mix()`.
- `<meta name="theme-color">` kleurt de statusbalk.
- Alle vaste thema's halen minstens 4,5 : 1 contrast voor tekst.

**Herinneringen**
- De knop vraagt pas na een tik om toestemming en slaat het push-abonnement op.
- Een cron-job (pg_cron en pg_net) roept elke minuut de Edge Function `herinneringen` aan. Daarbij gaat een wachtwoord mee uit de Vault, dat de functie controleert met `herinneringen_geheim_klopt`.
- De functie zoekt in Nederlandse tijd taken die binnen 30 minuten beginnen en nog niet zijn afgevinkt.
- Voor elke taak schrijft de functie eerst in het logboek. Staat de taak er al, dan slaat ze hem over. Daarna verstuurt ze via web push met de VAPID-sleutels.
- Verlopen abonnementen ruimt de functie op.

**Supabase CLI**
`supabase functions deploy herinneringen --no-verify-jwt` en `supabase secrets set`. Beide vragen om een bevestiging met `--yes`.

## Nooit in de code, op GitHub of in de chat
Service role- of secret-key van Supabase, het databasewachtwoord, het Gmail-app-wachtwoord, de VAPID-sleutel, het wekkerwachtwoord en inlogcodes. Deze staan alleen bij Supabase.

## Werkafspraken
- Kom eerst met een plan en wacht op akkoord
- Werk in kleine stappen, elke stap een eigen commit
- Zet kleine, losse verbeteringen meteen online, niet pas aan het eind
- Test met tijdelijke testgegevens, niet met Hazems echte taken. Zet na het testen niets terug of uit zonder het te melden
- Leg in eenvoudig Nederlands uit wat je doet en waarom, één stap tegelijk
- Denk mee en zeg het als iets een risico heeft of beter kan
- Vraag Hazem alleen om in te loggen of iets op zijn iPhone te controleren als het echt nodig is

## Nu bezig
Niets. Volgende stap: vooruit plannen als agenda.

## Ideeën voor later, in volgorde
1. Vooruit plannen als agenda (taken in de toekomst mogen de score niet beïnvloeden)
2. Dagboek: aan het eind van de dag een korte notitie, apart terug te lezen
3. Een taak niet kunnen afvinken vóór de begintijd
4. Vrienden die elkaars score zien (eerst de beveiligingscheck hieronder)
5. Een wekelijkse ranglijst in een groep
6. Een locatiecheck bij het afvinken, bijvoorbeeld bij de gym

## Voor later, vóór vrienden en teams
Een beveiligingscheck, voordat iemand anders dan Hazem de app gebruikt:
- **RLS:** controleren dat RLS op alle tabellen aan staat en dat elke regel klopt. Ook op nieuwe tabellen voor vrienden en groepen.
- **Geen geheimen:** controleren dat er geen geheimen in de code of op GitHub staan, ook niet in oude commits.
- **Andermans gegevens:** als vrienden elkaars score kunnen zien, mogen ze alleen de score zien. Taken, notities en terugblik blijven privé. Let op: die staan allemaal samen in `planners`, dus scores delen gaat via `dagscores` en nooit via `planners`. Testen met twee testaccounts.

## Om te onthouden
- Elke wijziging stuurt alle dagen opnieuw naar Supabase (één rij met alle gegevens, plus alle dagscores). Dat groeit elke dag. Wordt het traag, of komen er vrienden en teams bij, dan alleen de veranderde dagen versturen.
- Bij testen in de lokale preview kan de browser een oude `app.js` uit de cache gebruiken. Laad de bestanden dan opnieuw met `fetch(..., { cache: "reload" })`.
- Supabase zet het project op pauze na een week zonder gebruik. Herstellen via supabase.com met Restore.
- Wordt het Gmail-app-wachtwoord ingetrokken, dan komen er geen inlogcodes meer.
