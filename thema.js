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

function pasThemaToe(instellingen) {
  const thema = instellingen.thema || THEMA_STANDAARD;
  document.documentElement.dataset.thema = thema;

  // De statusbalk van de telefoon (bovenaan, met de klok) in de achtergrondkleur
  const achtergrond = getComputedStyle(document.documentElement)
    .getPropertyValue("--achtergrond")
    .trim();
  document.querySelector('meta[name="theme-color"]').setAttribute("content", achtergrond);
}

pasThemaToe(leesInstellingen());
