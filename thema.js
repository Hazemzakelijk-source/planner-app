// ============================================================
// Thema's (kleurenschema's)
// ============================================================
//
// Dit bestand laadt al bovenin de pagina (in <head>), vóór de rest.
// Zo staat het gekozen thema er meteen, en zie je niet eerst even
// de standaardkleuren (een "flits").
//
// Een thema kiezen = data-thema="..." op <html> zetten.
// style.css heeft per thema een blok met andere kleurvariabelen.

const THEMA_STANDAARD = "pastel";

// De instellingen staan bij de rest van je gegevens op het apparaat
function leesInstellingen() {
  try {
    const gegevens = JSON.parse(localStorage.getItem("dagplanner"));
    return (gegevens && gegevens.instellingen) || {};
  } catch {
    return {};
  }
}

// Staat de telefoon in donkere modus? matchMedia stelt die vraag aan de browser.
const donkereModus = window.matchMedia("(prefers-color-scheme: dark)");

// "Automatisch" is geen eigen kleurenset: het kiest pastel of donker
function echtThema(thema) {
  if (thema === "automatisch") return donkereModus.matches ? "donker" : "pastel";
  return thema;
}

function pasThemaToe(instellingen) {
  const thema = echtThema(instellingen.thema || THEMA_STANDAARD);
  document.documentElement.dataset.thema = thema;

  // De statusbalk van de telefoon (bovenaan, met de klok) in de achtergrondkleur
  const achtergrond = getComputedStyle(document.documentElement)
    .getPropertyValue("--achtergrond")
    .trim();
  document.querySelector('meta[name="theme-color"]').setAttribute("content", achtergrond);
}

pasThemaToe(leesInstellingen());

// Wisselt de telefoon van licht naar donker (bijvoorbeeld 's avonds)?
// Dan meteen meewisselen, ook als de app al open is.
donkereModus.addEventListener("change", () => pasThemaToe(leesInstellingen()));

// Voor de zekerheid ook als je terugkomt in de app: de telefoon kan
// intussen gewisseld zijn terwijl de app op de achtergrond stond.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pasThemaToe(leesInstellingen());
});
