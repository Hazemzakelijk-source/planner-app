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

// Startkleuren voor "Eigen kleuren": die van fris pastel, met een iets donkerdere
// knopkleur zodat scores op de achtergrond goed leesbaar zijn
const EIGEN_STANDAARD = { knoppen: "#5f56d0", achtergrond: "#f3f2fb", tekst: "#2a2747" };

// ---------- Contrast ----------
//
// Hoe goed is tekst leesbaar op een achtergrond? De officiële formule uit de
// toegankelijkheidsrichtlijnen (WCAG): eerst per kleur de "helderheid" (0 = zwart,
// 1 = wit), dan (lichtste + 0,05) / (donkerste + 0,05).
// 1 : 1 = onleesbaar, 21 : 1 = zwart op wit. Minstens 4,5 : 1 is de richtlijn.

function helderheid(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hex1, hex2) {
  const [licht, donker] = [helderheid(hex1), helderheid(hex2)].sort((a, b) => b - a);
  return (licht + 0.05) / (donker + 0.05);
}

// Tekst op een knop: wit of zwart, wat het best leesbaar is
function besteTekstOp(hex) {
  return contrast(hex, "#ffffff") >= contrast(hex, "#000000") ? "#ffffff" : "#000000";
}

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

// Bij "Eigen kleuren" zetten we je drie kleuren direct op <html>.
// De andere kleuren rekent style.css daaruit uit (met color-mix).
function zetEigenKleuren(element, eigen) {
  if (!eigen) {
    ["--accent", "--achtergrond", "--tekst", "--op-accent", "color-scheme"].forEach((naam) =>
      element.style.removeProperty(naam)
    );
    return;
  }
  element.style.setProperty("--accent", eigen.knoppen);
  element.style.setProperty("--achtergrond", eigen.achtergrond);
  element.style.setProperty("--tekst", eigen.tekst);
  element.style.setProperty("--op-accent", besteTekstOp(eigen.knoppen));
  // Donkere achtergrond? Dan ook donkere invoervelden en schuifbalken
  element.style.setProperty(
    "color-scheme",
    besteTekstOp(eigen.achtergrond) === "#ffffff" ? "dark" : "light"
  );
}

function pasThemaToe(instellingen) {
  const thema = echtThema(instellingen.thema || THEMA_STANDAARD);
  document.documentElement.dataset.thema = thema;
  zetEigenKleuren(
    document.documentElement,
    thema === "eigen" ? { ...EIGEN_STANDAARD, ...instellingen.eigen } : null
  );

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
