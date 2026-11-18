// ============================================================
// Schermen wisselen
// ============================================================

// Alle menuknoppen en alle schermen opzoeken in de HTML
const menuKnoppen = document.querySelectorAll(".menu button");
const schermen = document.querySelectorAll(".scherm");

// Toon één scherm en verberg de andere
function toonScherm(schermId) {
  schermen.forEach((scherm) => {
    scherm.hidden = scherm.id !== schermId;
  });

  // De knop van het getoonde scherm krijgt de klasse "actief" (blauw)
  menuKnoppen.forEach((knop) => {
    knop.classList.toggle("actief", knop.dataset.scherm === schermId);
  });
}

// Bij een tik op een menuknop: open het scherm dat bij die knop hoort
menuKnoppen.forEach((knop) => {
  knop.addEventListener("click", () => toonScherm(knop.dataset.scherm));
});

// ============================================================
// Opslag op het apparaat (localStorage)
// ============================================================
//
// Alles staat onder één sleutel, als tekst in JSON-vorm:
// {
//   dagen: {
//     "2026-11-18": {
//       vastgezetOp: "2026-11-17T21:30:00.000Z",   (of null)
//       taken: [ { naam, begintijd, duur, aanpak, focusblok,
//                  gestartOp, klaarOp }, ... ]   (tijdstippen, of leeg)
//     }
//   }
// }

const OPSLAG_SLEUTEL = "dagplanner";

function laadGegevens() {
  const tekst = localStorage.getItem(OPSLAG_SLEUTEL);
  // Nog niets bewaard? Begin dan met een lege lijst dagen.
  return tekst ? JSON.parse(tekst) : { dagen: {} };
}

function bewaarGegevens(gegevens) {
  localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(gegevens));
  planSync(); // ben je ingelogd? Dan gaat de wijziging straks ook naar Supabase
}

// Geeft de dag die bij een datum hoort; maakt hem aan als hij nog niet bestaat
function haalDag(gegevens, sleutel) {
  if (!gegevens.dagen[sleutel]) {
    gegevens.dagen[sleutel] = { vastgezetOp: null, taken: [] };
  }
  return gegevens.dagen[sleutel];
}

// ============================================================
// Datums
// ============================================================

// Zet een datum om naar tekst als "2026-11-18" (in je eigen tijdzone)
function datumSleutel(datum) {
  const jaar = datum.getFullYear();
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

function morgen() {
  const datum = new Date();
  datum.setDate(datum.getDate() + 1);
  return datum;
}

// Datum als leesbare tekst, bijvoorbeeld "woensdag 18 november"
function datumTekst(datum) {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Tijdstip als "09:05"
function tijdTekst(datum) {
  return datum.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Rekent de eindtijd uit: "09:00" + 90 minuten = "10:30"
function eindtijd(taak) {
  const [uren, minuten] = taak.begintijd.split(":").map(Number);
  const totaal = uren * 60 + minuten + taak.duur;
  const eindUren = Math.floor(totaal / 60) % 24;
  const eindMinuten = totaal % 60;
  return `${String(eindUren).padStart(2, "0")}:${String(eindMinuten).padStart(2, "0")}`;
}

// ============================================================
// Scherm "Morgen plannen"
// ============================================================

const formulier = document.querySelector("#taak-formulier");
const takenLijst = document.querySelector("#taken-morgen");
const vastzetKnop = document.querySelector("#plan-vastzetten");
const vastgezetMelding = document.querySelector("#vastgezet-melding");
const morgenDatum = document.querySelector("#morgen-datum");

// Maakt het hele scherm opnieuw op basis van wat er bewaard is
function toonMorgen() {
  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(morgen()));

  morgenDatum.textContent = datumTekst(morgen());

  // Is het plan al vastgezet? Dan kan er niets meer bij of af.
  const isVast = dag.vastgezetOp !== null;

  // Lijst leegmaken en opnieuw vullen, gesorteerd op begintijd.
  // Net als bij "Vandaag" onthouden we het nummer van elke taak in de opslag.
  takenLijst.innerHTML = "";
  const metNummer = dag.taken.map((taak, nummer) => ({ taak, nummer }));
  metNummer.sort((a, b) => a.taak.begintijd.localeCompare(b.taak.begintijd));

  metNummer.forEach(({ taak, nummer }) => {
    const item = maakTaakItem(taak);

    if (!isVast) {
      const knoppen = document.createElement("div");
      knoppen.className = "knoppen";

      const bewerkKnop = document.createElement("button");
      bewerkKnop.textContent = "Bewerken";
      bewerkKnop.addEventListener("click", () => startBewerken(taak, nummer));

      const verwijderKnop = document.createElement("button");
      verwijderKnop.className = "knop-verwijderen";
      verwijderKnop.textContent = "Verwijderen";
      verwijderKnop.addEventListener("click", () => verwijderTaak(taak, nummer));

      knoppen.append(bewerkKnop, verwijderKnop);
      item.append(knoppen);
    }

    takenLijst.append(item);
  });
  formulier.hidden = isVast;
  vastzetKnop.hidden = isVast;
  vastgezetMelding.hidden = !isVast;
  if (isVast) {
    const tijd = tijdTekst(new Date(dag.vastgezetOp));
    vastgezetMelding.textContent = `🔒 Plan vastgezet om ${tijd}`;
  }

  // Een leeg plan vastzetten heeft geen zin
  vastzetKnop.disabled = dag.taken.length === 0;

  // Kopiëren kan alleen als vandaag een plan heeft en morgen nog niet vastzit
  kopieerKnop.hidden = isVast || takenVanVandaag(gegevens).length === 0;
}

// ---------- Plan van vandaag kopiëren ----------

const kopieerKnop = document.querySelector("#kopieer-knop");

// De geplande taken van vandaag (extra taken horen niet bij het plan)
function takenVanVandaag(gegevens) {
  const vandaag = gegevens.dagen[datumSleutel(new Date())];
  return vandaag ? geplandeTaken(vandaag) : [];
}

// Alle taken van een dag, behalve de extra taken
function geplandeTaken(dag) {
  return dag.taken.filter((taak) => !taak.extra);
}

kopieerKnop.addEventListener("click", () => {
  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(morgen()));

  // Staat er al iets voor morgen? Dan eerst vragen of het weg mag.
  if (
    dag.taken.length > 0 &&
    !confirm("Dit vervangt de taken die je al voor morgen hebt gepland. Doorgaan?")
  ) {
    return;
  }

  // Alleen het plan kopiëren, niet wanneer je vandaag gestart of klaar was
  dag.taken = takenVanVandaag(gegevens).map((taak) => ({
    naam: taak.naam,
    begintijd: taak.begintijd,
    duur: taak.duur,
    aanpak: taak.aanpak,
    focusblok: taak.focusblok,
    belangrijkste: Boolean(taak.belangrijkste),
    waarom: taak.waarom || "",
  }));

  bewaarGegevens(gegevens);
  stopBewerken();
  toonMorgen();
});

// Maakt één <li> voor een taak.
// We gebruiken textContent (niet innerHTML) zodat getypte tekst
// altijd als gewone tekst wordt getoond en nooit als HTML-code.
function maakTaakItem(taak) {
  const item = document.createElement("li");

  const kop = document.createElement("div");
  kop.className = "taak-kop";
  const tijd = document.createElement("span");
  tijd.className = "tijd";
  tijd.textContent = `${taak.begintijd}–${eindtijd(taak)}`;
  kop.append(tijd, ` ${taak.naam}`);

  if (taak.extra) {
    const label = document.createElement("span");
    label.className = "label-focus label-extra";
    label.textContent = "➕ Extra";
    kop.append(label);
  }
  if (taak.belangrijkste) {
    const label = document.createElement("span");
    label.className = "label-focus label-belangrijkste";
    label.textContent = "🎯 Belangrijkste";
    kop.append(label);
  }
  if (taak.focusblok) {
    const label = document.createElement("span");
    label.className = "label-focus";
    label.textContent = "⏱️ Focusblok";
    kop.append(label);
  }
  item.append(kop);

  if (taak.aanpak) {
    const aanpak = document.createElement("p");
    aanpak.className = "aanpak";
    aanpak.textContent = taak.aanpak;
    item.append(aanpak);
  }

  if (taak.belangrijkste && taak.waarom) {
    const waarom = document.createElement("p");
    waarom.className = "aanpak";
    waarom.textContent = `Waarom: ${taak.waarom}`;
    item.append(waarom);
  }

  return item;
}

// ---------- Regels voor de belangrijkste taak ----------

const MINIMALE_DUUR_BELANGRIJKSTE = 30;
const waaromVeld = document.querySelector("#waarom-veld");

// Past het formulier aan op het vinkje "belangrijkste":
// het waarom-veld tonen en verplicht maken, en de duur controleren.
function werkBelangrijksteRegelsBij() {
  const velden = formulier.elements;
  const belangrijk = velden.belangrijkste.checked;

  waaromVeld.hidden = !belangrijk;
  velden.waarom.required = belangrijk;

  // setCustomValidity: een eigen foutmelding. Lege tekst = geen fout.
  const teKort = belangrijk && Number(velden.duur.value) < MINIMALE_DUUR_BELANGRIJKSTE;
  velden.duur.setCustomValidity(
    teKort
      ? `De belangrijkste taak moet minstens ${MINIMALE_DUUR_BELANGRIJKSTE} minuten duren.`
      : ""
  );
}

formulier.elements.belangrijkste.addEventListener("change", werkBelangrijksteRegelsBij);
formulier.elements.duur.addEventListener("input", werkBelangrijksteRegelsBij);

// ---------- Bewerken en verwijderen ----------

const opslaanKnop = document.querySelector("#opslaan-knop");
const annuleerKnop = document.querySelector("#annuleer-knop");

// Het nummer van de taak die je aan het bewerken bent, of null als je
// gewoon een nieuwe taak toevoegt
let bewerkNummer = null;

// Zet de gegevens van een taak in het formulier, zodat je ze kunt aanpassen
function startBewerken(taak, nummer) {
  bewerkNummer = nummer;
  const velden = formulier.elements;
  velden.naam.value = taak.naam;
  velden.begintijd.value = taak.begintijd;
  velden.duur.value = taak.duur;
  velden.aanpak.value = taak.aanpak;
  velden.focusblok.checked = taak.focusblok;
  velden.belangrijkste.checked = Boolean(taak.belangrijkste);
  velden.waarom.value = taak.waarom || "";
  werkBelangrijksteRegelsBij();

  opslaanKnop.textContent = "Wijziging opslaan";
  annuleerKnop.hidden = false;
  // Naar het formulier scrollen, zodat je ziet dat je aan het bewerken bent
  formulier.scrollIntoView({ behavior: "smooth" });
}

// Terug naar "nieuwe taak toevoegen"
function stopBewerken() {
  bewerkNummer = null;
  formulier.reset();
  // reset() leegt de velden maar geeft geen signaal; regels dus zelf bijwerken
  werkBelangrijksteRegelsBij();
  opslaanKnop.textContent = "Taak toevoegen";
  annuleerKnop.hidden = true;
}

function verwijderTaak(taak, nummer) {
  // confirm() toont een venster met OK en Annuleren
  if (!confirm(`"${taak.naam}" verwijderen?`)) return;

  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(morgen()));
  // splice haalt 1 element weg op plek "nummer"
  dag.taken.splice(nummer, 1);
  bewaarGegevens(gegevens);

  // Na verwijderen kloppen de nummers niet meer; stop dus met bewerken
  stopBewerken();
  toonMorgen();
}

annuleerKnop.addEventListener("click", stopBewerken);

// Formulier verstuurd: nieuwe taak toevoegen, of de bewerkte taak vervangen
formulier.addEventListener("submit", (gebeurtenis) => {
  // Standaard herlaadt een formulier de pagina; dat willen we niet
  gebeurtenis.preventDefault();

  const velden = formulier.elements;
  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(morgen()));

  // Maar één belangrijkste taak per dag: haal het label weg bij de andere taken
  if (velden.belangrijkste.checked) {
    dag.taken.forEach((taak) => (taak.belangrijkste = false));
  }

  const taak = {
    naam: velden.naam.value.trim(),
    begintijd: velden.begintijd.value,
    duur: Number(velden.duur.value),
    aanpak: velden.aanpak.value.trim(),
    focusblok: velden.focusblok.checked,
    belangrijkste: velden.belangrijkste.checked,
    // De waarom-zin hoort alleen bij de belangrijkste taak
    waarom: velden.belangrijkste.checked ? velden.waarom.value.trim() : "",
  };

  if (bewerkNummer === null) {
    dag.taken.push(taak);
  } else {
    dag.taken[bewerkNummer] = taak;
  }

  bewaarGegevens(gegevens);
  stopBewerken();
  toonMorgen();
});

// "Plan vastzetten": eerst om bevestiging vragen in een eigen venster.
// (confirm() kan dat niet: daar kun je de knopteksten niet zelf kiezen.)
const vastzetDialoog = document.querySelector("#vastzet-dialoog");

vastzetKnop.addEventListener("click", () => vastzetDialoog.showModal());

// Alleen een tik op "Vastzetten" zet het plan vast. Het venster sluit
// daarna vanzelf (dat doet method="dialog"). "Annuleren" en de
// Escape-toets sluiten het venster zonder iets te doen.
vastzetDialoog
  .querySelector(".knop-vastzetten")
  .addEventListener("click", zetPlanVast);

// Het tijdstip bewaren. Dat hebben we nodig voor de score
// (vóór middernacht vastgezet = 20 punten).
function zetPlanVast() {
  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(morgen()));
  dag.vastgezetOp = new Date().toISOString();
  bewaarGegevens(gegevens);
  stopBewerken();
  toonMorgen();
}

// ============================================================
// Scherm "Vandaag"
// ============================================================

const tijdlijn = document.querySelector("#tijdlijn");
const geenPlan = document.querySelector("#geen-plan");
const vandaagDatum = document.querySelector("#vandaag-datum");

function toonVandaag() {
  const vandaag = new Date();
  vandaagDatum.textContent = datumTekst(vandaag);

  const gegevens = laadGegevens();
  const dag = gegevens.dagen[datumSleutel(vandaag)];
  const taken = dag ? dag.taken : [];

  geenPlan.hidden = taken.length > 0;
  tijdlijn.innerHTML = "";

  // We onthouden bij elke taak zijn plek (nummer) in de opgeslagen lijst.
  // Na het sorteren weten we dan nog steeds welke taak we moeten bijwerken.
  const metNummer = taken.map((taak, nummer) => ({ taak, nummer }));
  metNummer.sort((a, b) => a.taak.begintijd.localeCompare(b.taak.begintijd));

  metNummer.forEach(({ taak, nummer }) => {
    const item = maakTaakItem(taak);
    if (taak.klaarOp) item.classList.add("klaar");
    else if (taak.gestartOp) item.classList.add("bezig");

    // Rond vinkje rechtsboven. aria-label is de tekst die een
    // schermlezer voorleest, omdat het rondje zelf geen tekst heeft.
    const vinkje = document.createElement("button");
    vinkje.className = "vinkje-rond";
    vinkje.textContent = taak.klaarOp ? "✓" : "";
    vinkje.setAttribute("aria-label", taak.klaarOp ? "Afvinken ongedaan maken" : "Afvinken");
    vinkje.addEventListener("click", () => wisselKlaar(nummer));
    item.prepend(vinkje);

    const knoppen = document.createElement("div");
    knoppen.className = "knoppen";

    const startKnop = document.createElement("button");
    startKnop.textContent = taak.gestartOp
      ? `Gestart ${tijdTekst(new Date(taak.gestartOp))}`
      : "Gestart";
    startKnop.disabled = Boolean(taak.gestartOp);
    startKnop.addEventListener("click", () => zetTijdstip(nummer, "gestartOp"));

    // Een afgevinkte taak hoeft niet meer gestart te worden
    if (!taak.klaarOp) knoppen.append(startKnop);

    // Een extra taak mag je altijd verwijderen, ook als het plan vastzit:
    // extra taken tellen niet mee voor de score.
    if (taak.extra) {
      const verwijderKnop = document.createElement("button");
      verwijderKnop.className = "knop-verwijderen";
      verwijderKnop.textContent = "Verwijderen";
      verwijderKnop.addEventListener("click", () => verwijderExtraTaak(taak, nummer));
      knoppen.append(verwijderKnop);
    }

    // Alleen een rij knoppen tonen als er ook knoppen in staan
    if (knoppen.children.length > 0) item.append(knoppen);

    // Focustimer bij een focusblok dat nog niet is afgevinkt
    if (taak.focusblok && !taak.klaarOp) {
      item.append(maakFocustimer(taak, nummer));
    }

    // Na het afvinken: een veld voor een korte notitie
    if (taak.klaarOp) {
      const notitie = document.createElement("input");
      notitie.type = "text";
      notitie.className = "notitie";
      notitie.placeholder = "📝 Notitie: hoe ging het?";
      notitie.value = taak.notitie || "";
      notitie.addEventListener("change", () => bewaarNotitie(nummer, notitie.value));
      item.append(notitie);
    }

    tijdlijn.append(item);
  });
}

// Een extra taak van vandaag verwijderen, na een bevestiging
function verwijderExtraTaak(taak, nummer) {
  if (!confirm(`Extra taak "${taak.naam}" verwijderen?`)) return;

  const gegevens = laadGegevens();
  const dag = gegevens.dagen[datumSleutel(new Date())];
  // Voor de zekerheid: alleen weghalen als het echt een extra taak is
  if (!dag.taken[nummer] || !dag.taken[nummer].extra) return;
  dag.taken.splice(nummer, 1); // splice haalt 1 taak weg op plek "nummer"
  bewaarGegevens(gegevens);
  toonVandaag();
}

// Vinkje aantikken: afgerond (tijdstip bewaren) of weer open (tijdstip wissen)
function wisselKlaar(nummer) {
  const gegevens = laadGegevens();
  const taak = gegevens.dagen[datumSleutel(new Date())].taken[nummer];
  taak.klaarOp = taak.klaarOp ? null : new Date().toISOString();
  bewaarGegevens(gegevens);
  toonVandaag();
}

// Bewaart de notitie bij een taak van vandaag
function bewaarNotitie(nummer, tekst) {
  const gegevens = laadGegevens();
  gegevens.dagen[datumSleutel(new Date())].taken[nummer].notitie = tekst.trim();
  bewaarGegevens(gegevens);
}

// Bewaart het huidige tijdstip bij een taak van vandaag (hier: "gestartOp")
function zetTijdstip(nummer, veld) {
  const gegevens = laadGegevens();
  const dag = gegevens.dagen[datumSleutel(new Date())];
  dag.taken[nummer][veld] = new Date().toISOString();
  bewaarGegevens(gegevens);
  toonVandaag();
}

// ---------- Focustimer ----------
//
// We bewaren het moment waarop de timer afloopt ("timerEindOp").
// De resterende tijd is steeds: dat moment min nu. Daardoor klopt de
// timer ook als je de app tussendoor sluit.

function maakFocustimer(taak, nummer) {
  const blok = document.createElement("div");
  blok.className = "focustimer";

  if (taak.timerEindOp) {
    const tijd = document.createElement("span");
    tijd.className = "timer";
    tijd.dataset.eind = taak.timerEindOp;
    tijd.textContent = resterendeTijd(taak.timerEindOp);

    const stopKnop = document.createElement("button");
    stopKnop.textContent = "Stop";
    stopKnop.addEventListener("click", () => stopTimer(nummer));

    blok.append(tijd, stopKnop);
  } else {
    const startKnop = document.createElement("button");
    startKnop.textContent = `⏱️ Start focustimer (${taak.duur} min)`;
    startKnop.addEventListener("click", () => startTimer(nummer));
    blok.append(startKnop);
  }
  return blok;
}

function startTimer(nummer) {
  const gegevens = laadGegevens();
  const taak = gegevens.dagen[datumSleutel(new Date())].taken[nummer];
  // Nu + de geplande duur in milliseconden (1 minuut = 60.000 ms)
  taak.timerEindOp = new Date(Date.now() + taak.duur * 60000).toISOString();
  // Wie de timer start, is met de taak begonnen
  if (!taak.gestartOp) taak.gestartOp = new Date().toISOString();
  bewaarGegevens(gegevens);
  toonVandaag();
}

function stopTimer(nummer) {
  const gegevens = laadGegevens();
  delete gegevens.dagen[datumSleutel(new Date())].taken[nummer].timerEindOp;
  bewaarGegevens(gegevens);
  toonVandaag();
}

// Resterende tijd als "24:59", of een melding als de tijd om is
function resterendeTijd(eindOp) {
  const seconden = Math.ceil((new Date(eindOp) - Date.now()) / 1000);
  if (seconden <= 0) return "Focustijd voorbij ✅";
  const minuten = Math.floor(seconden / 60);
  const rest = seconden % 60;
  return `${minuten}:${String(rest).padStart(2, "0")}`;
}

// Elke seconde alle zichtbare timers bijwerken
function werkTimersBij() {
  document.querySelectorAll(".timer").forEach((tijd) => {
    tijd.textContent = resterendeTijd(tijd.dataset.eind);
  });
}
setInterval(werkTimersBij, 1000);
// Kom je terug in de app, dan meteen bijwerken (niet pas na een seconde)
document.addEventListener("visibilitychange", werkTimersBij);

// ---------- Terugblik ----------

// Vanaf dit uur is het "avond" en verschijnt de terugblik
const AVOND_VANAF = 18;

const terugblikKaart = document.querySelector("#terugblik-kaart");
const terugblikVeld = document.querySelector("#terugblik");

function toonTerugblik() {
  const nu = new Date();
  terugblikKaart.hidden = nu.getHours() < AVOND_VANAF;
  const dag = laadGegevens().dagen[datumSleutel(nu)];
  terugblikVeld.value = dag?.terugblik || "";
}

// Bij elke letter die je typt meteen bewaren, zodat er niets verloren gaat
terugblikVeld.addEventListener("input", () => {
  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(new Date()));
  dag.terugblik = terugblikVeld.value;
  bewaarGegevens(gegevens);
});

// ---------- Extra taken ----------

const extraFormulier = document.querySelector("#extra-formulier");

extraFormulier.addEventListener("submit", (gebeurtenis) => {
  gebeurtenis.preventDefault();
  const velden = extraFormulier.elements;
  const gegevens = laadGegevens();
  // haalDag maakt de dag aan als er nog niets voor vandaag was
  const dag = haalDag(gegevens, datumSleutel(new Date()));

  dag.taken.push({
    naam: velden.naam.value.trim(),
    begintijd: velden.begintijd.value,
    duur: Number(velden.duur.value),
    extra: true,
  });

  bewaarGegevens(gegevens);
  extraFormulier.reset();
  toonVandaag();
});

// ============================================================
// Score
// ============================================================

// Zet "2026-11-18" terug om naar een datum (om 00:00 in je eigen tijdzone)
function datumVanSleutel(sleutel) {
  const [jaar, maand, dag] = sleutel.split("-").map(Number);
  return new Date(jaar, maand - 1, dag);
}

// Een datum een aantal dagen eerder, bijvoorbeeld dagenTerug(vandaag, 1) = gisteren
function dagenTerug(datum, aantal) {
  const nieuw = new Date(datum);
  nieuw.setDate(nieuw.getDate() - aantal);
  return nieuw;
}

// Het moment waarop het geplande blok van een taak afloopt
function eindeBlok(sleutel, taak) {
  const einde = datumVanSleutel(sleutel);
  const [uren, minuten] = taak.begintijd.split(":").map(Number);
  // setHours rekent zelf door: 09:00 + 90 minuten wordt 10:30
  einde.setHours(uren, minuten + taak.duur);
  return einde;
}

// Telt de gewichten van een lijst taken op: belangrijkste = 2, andere = 1
function totaalGewicht(taken) {
  return taken.reduce((som, taak) => som + (taak.belangrijkste ? 2 : 1), 0);
}

// Score van één dag, van 0 tot 100. Een dag zonder taken scoort 0.
// Extra taken tellen niet mee.
function dagScore(sleutel) {
  const dag = laadGegevens().dagen[sleutel];
  if (!dag) return 0;
  const taken = geplandeTaken(dag);
  if (taken.length === 0) return 0;

  let punten = 0;

  // 20 punten: plan vastgezet op de dag ervoor, dus uiterlijk om middernacht
  if (dag.vastgezetOp) {
    const vastgezet = new Date(dag.vastgezetOp);
    const dagErvoor = dagenTerug(datumVanSleutel(sleutel), 1);
    if (datumSleutel(vastgezet) === datumSleutel(dagErvoor)) {
      punten += 20;
    }
  }

  const afgerond = taken.filter((taak) => taak.klaarOp);
  const opTijd = afgerond.filter(
    (taak) => new Date(taak.klaarOp) <= eindeBlok(sleutel, taak)
  );

  // De belangrijkste taak telt dubbel: hij weegt 2, een gewone taak 1.
  // We tellen dus geen taken meer, maar gewichten.
  const gepland = totaalGewicht(taken);

  // 60 x (afgerond / gepland) en 20 x (op tijd afgerond / gepland)
  punten += (60 * totaalGewicht(afgerond)) / gepland;
  punten += (20 * totaalGewicht(opTijd)) / gepland;

  return punten;
}

// Gemiddelde van de 7 dagen vóór vandaag (gisteren t/m 7 dagen terug).
// Vandaag telt niet mee, want die dag is nog niet voorbij.
// Een dag zonder plan telt als 0.
function weekGemiddelde() {
  let totaal = 0;
  for (let i = 1; i <= 7; i++) {
    totaal += dagScore(datumSleutel(dagenTerug(new Date(), i)));
  }
  return totaal / 7;
}

// Telt terug vanaf vandaag zolang elke dag een vastgezet plan heeft
function reeks() {
  const dagen = laadGegevens().dagen;
  let aantal = 0;
  let datum = new Date();
  while (dagen[datumSleutel(datum)]?.vastgezetOp) {
    aantal++;
    datum = dagenTerug(datum, 1);
  }
  return aantal;
}

// Een emoji die past bij de score van vandaag
function scoreEmoji(score) {
  if (score >= 90) return "😎";
  if (score >= 70) return "💪";
  if (score >= 50) return "🙂";
  if (score >= 25) return "😐";
  return "😴";
}

// Punten van deze kalenderweek: maandag tot en met vandaag
function puntenDezeWeek() {
  const vandaag = new Date();
  // getDay() geeft zondag = 0, maandag = 1 ... Zo rekenen we om naar
  // "hoeveel dagen geleden was het maandag" (maandag = 0, zondag = 6).
  const dagenSindsMaandag = (vandaag.getDay() + 6) % 7;
  let totaal = 0;
  for (let i = 0; i <= dagenSindsMaandag; i++) {
    totaal += dagScore(datumSleutel(dagenTerug(vandaag, i)));
  }
  return totaal;
}

// Korte dagnaam en datum, bijvoorbeeld "di 10"
function korteDag(datum) {
  return datum.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" });
}

// Staafgrafiek van de 7 dagen vóór vandaag, oudste links.
// Elke staaf is een <button>: tik erop om de score van die dag te zien.
function tekenGrafiek() {
  const grafiek = document.querySelector("#grafiek");
  const uitleg = document.querySelector("#grafiek-uitleg");
  grafiek.innerHTML = "";

  for (let i = 7; i >= 1; i--) {
    const datum = dagenTerug(new Date(), i);
    const score = Math.round(dagScore(datumSleutel(datum)));
    const tekst = `${datumTekst(datum)}: ${score} punten`;

    const kolom = document.createElement("button");
    kolom.className = "kolom";
    kolom.setAttribute("aria-label", tekst);

    // De hoogte van de staaf is de score als percentage (100 punten = 100%)
    const staaf = document.createElement("div");
    staaf.className = "staaf";
    staaf.style.height = `${score}%`;

    const label = document.createElement("span");
    label.className = "kolom-label";
    label.textContent = korteDag(datum);

    kolom.append(staaf, label);
    kolom.addEventListener("click", () => {
      uitleg.textContent = tekst;
      grafiek.querySelectorAll(".kolom").forEach((k) => k.classList.remove("gekozen"));
      kolom.classList.add("gekozen");
    });
    grafiek.append(kolom);
  }

  uitleg.textContent = "Tik op een staaf voor de score van die dag.";
}

function toonScore() {
  // Math.round rondt af op hele punten, zodat je geen 66.666667 ziet
  const vandaag = Math.round(dagScore(datumSleutel(new Date())));
  document.querySelector("#score-vandaag").textContent = vandaag;
  document.querySelector("#score-emoji").textContent = scoreEmoji(vandaag);

  // Voortgangsbalk: punten deze week van maximaal 7 x 100
  const week = Math.round(puntenDezeWeek());
  document.querySelector("#week-balk-vulling").style.width = `${(week / 700) * 100}%`;
  document.querySelector("#week-balk").setAttribute("aria-valuenow", week);
  document.querySelector("#week-tekst").textContent = `${week} van 700 punten (ma t/m zo)`;

  document.querySelector("#score-week").textContent = Math.round(weekGemiddelde());
  tekenGrafiek();

  document.querySelector("#score-reeks").textContent = `🔥 ${reeks()}`;
}

// ============================================================
// Inloggen met een code van 6 cijfers per e-mail
// ============================================================
//
// Stap 1: je vult je e-mail in, Supabase mailt een code (signInWithOtp).
// Stap 2: je vult de code in, Supabase controleert hem (verifyOtp).
// Daarna onthoudt Supabase zelf dat je bent ingelogd, ook na herladen.

const inlogDialoog = document.querySelector("#inlog-dialoog");
const emailFormulier = document.querySelector("#email-formulier");
const codeFormulier = document.querySelector("#code-formulier");
const inlogFout = document.querySelector("#inlog-fout");
let inlogEmail = "";

function toonInlogFout(tekst) {
  inlogFout.textContent = tekst;
  inlogFout.hidden = !tekst;
}

// Het venster openen, altijd bij stap 1
document.querySelector("#inlog-knop").addEventListener("click", () => {
  emailFormulier.reset();
  codeFormulier.reset();
  emailFormulier.hidden = false;
  codeFormulier.hidden = true;
  toonInlogFout("");
  inlogDialoog.showModal();
});

inlogDialoog.querySelectorAll(".knop-annuleren").forEach((knop) => {
  knop.addEventListener("click", () => inlogDialoog.close());
});

// Een knop uitzetten zolang we op Supabase wachten, zodat je niet twee keer tikt
async function terwijlBezig(formulier, werk) {
  const knop = formulier.querySelector("button[type=submit]");
  knop.disabled = true;
  try {
    await werk();
  } finally {
    knop.disabled = false;
  }
}

// Stap 1: code laten mailen
emailFormulier.addEventListener("submit", (event) => {
  event.preventDefault(); // niet de pagina herladen
  inlogEmail = emailFormulier.email.value.trim();
  terwijlBezig(emailFormulier, async () => {
    toonInlogFout("");
    const { error } = await db.auth.signInWithOtp({ email: inlogEmail });
    if (error) {
      toonInlogFout("Het versturen lukte niet. Probeer het over een paar minuten opnieuw.");
      return;
    }
    document.querySelector("#code-uitleg").textContent =
      `We hebben een code gemaild naar ${inlogEmail}. Vul die hieronder in.`;
    emailFormulier.hidden = true;
    codeFormulier.hidden = false;
    codeFormulier.code.focus();
  });
});

// Stap 2: code controleren
codeFormulier.addEventListener("submit", (event) => {
  event.preventDefault();
  terwijlBezig(codeFormulier, async () => {
    toonInlogFout("");
    const { error } = await db.auth.verifyOtp({
      email: inlogEmail,
      token: codeFormulier.code.value.trim(),
      type: "email",
    });
    if (error) {
      toonInlogFout("Deze code klopt niet of is verlopen.");
      return;
    }
    inlogDialoog.close();
  });
});

document.querySelector("#uitlog-knop").addEventListener("click", async () => {
  // Eerst de herinneringen op dit apparaat uitzetten, anders krijg je ze na uitloggen nog steeds
  await zetHerinneringenUit();
  await db.auth.signOut();
});

// ============================================================
// Synchroniseren met Supabase
// ============================================================
//
// De app bewaart alles nog steeds op het apparaat (localStorage).
// Ben je ingelogd, dan gaat elke wijziging ook naar Supabase,
// en bij het opstarten halen we de online versie op.

// Extra notities op het apparaat:
const SYNC_GEBRUIKER = "dagplanner-gebruiker"; // welk account hier al eens is gesynchroniseerd
const SYNC_WACHT = "dagplanner-wacht"; // "ja" = er zijn wijzigingen die nog niet online staan
const SYNC_BASIS = "dagplanner-basis"; // de online versie die dit apparaat het laatst zag

let gebruiker = null; // de ingelogde gebruiker, of null
let syncTimer = null;
let wijzigingNummer = 0;

function zetSyncStatus(tekst) {
  const status = document.querySelector("#sync-status");
  status.textContent = tekst;
  status.hidden = !tekst;
}

// ---------- Versiecontrole ----------
//
// Elke keer dat we opslaan, krijgt de rij in Supabase een nieuw versienummer:
// het tijdstip in "bijgewerkt_op". Dit apparaat onthoudt de versie die het het
// laatst zag (de "basis"). Bij opslaan zeggen we tegen Supabase:
// "werk alleen bij als je nog op die versie staat".
// Heeft een ander apparaat intussen iets veranderd, dan gebeurt er niets.
// Dan halen we de nieuwe versie op en voegen we samen (zie voegDrieweg).

function laadBasis() {
  const tekst = localStorage.getItem(SYNC_BASIS);
  return tekst ? JSON.parse(tekst) : null;
}

function bewaarBasis(versie, gegevens) {
  localStorage.setItem(SYNC_BASIS, JSON.stringify({ versie, gegevens }));
}

// Samenvoegen met drie versies: de basis (wat we het laatst online zagen),
// lokaal (dit apparaat) en online (wat er nu in Supabase staat).
// Per dag, en voor de instellingen apart:
// - heeft dit apparaat dat stuk niet veranderd? Neem dan de online versie.
// - wel veranderd? Dan houden we onze eigen versie.
// Zo zet een apparaat met oude gegevens geen verwijderde taak terug,
// tenzij het zelf op diezelfde dag iets heeft veranderd.
function voegDrieweg(basis, lokaal, online) {
  const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const kies = (b, l, o) => (zelfde(l, b) ? o : l);

  const datums = new Set([
    ...Object.keys(basis.dagen || {}),
    ...Object.keys(lokaal.dagen || {}),
    ...Object.keys(online.dagen || {}),
  ]);
  const dagen = {};
  for (const datum of datums) {
    const dag = kies(basis.dagen?.[datum], lokaal.dagen?.[datum], online.dagen?.[datum]);
    if (dag !== undefined) dagen[datum] = dag; // undefined = verwijderd
  }
  const samen = { ...online, dagen };
  const instellingen = kies(basis.instellingen, lokaal.instellingen, online.instellingen);
  if (instellingen === undefined) delete samen.instellingen;
  else samen.instellingen = instellingen;
  return samen;
}

// Samenvoegen bij de eerste keer inloggen op een apparaat:
// dagen die alleen op het apparaat staan komen erbij,
// en bij een dag die op beide plekken staat wint de online versie.
// { ...a, ...b } maakt een nieuw object: eerst alles uit a, dan b eroverheen.
function voegSamen(online, lokaal) {
  return { ...online, dagen: { ...lokaal.dagen, ...online.dagen } };
}

async function haalRij() {
  // maybeSingle: we verwachten één rij, of geen (bij de eerste keer)
  return db
    .from("planners")
    .select("gegevens, bijgewerkt_op")
    .eq("user_id", gebruiker.id)
    .maybeSingle();
}

// ---------- Eén ding tegelijk ----------
//
// Versturen en ophalen mogen niet door elkaar heen lopen.
// Daarom zetten we ze in een rij: de volgende begint pas als de vorige klaar is.
let syncRij = Promise.resolve();

function inDeRij(werk) {
  syncRij = syncRij.then(() => werk()).catch(() => zetSyncStatus("⚠️ Niet opgeslagen"));
  return syncRij;
}

// Na een wijziging: wacht 1 seconde en stuur dan alles in één keer.
// Typ je een notitie, dan sturen we dus niet bij elke letter.
function planSync() {
  if (!gebruiker) return;
  wijzigingNummer++;
  localStorage.setItem(SYNC_WACHT, "ja");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(stuurNaarServer, 1000);
}

function stuurNaarServer() {
  return inDeRij(versturen);
}

function haalVanServer() {
  return inDeRij(ophalen);
}

// Alle gegevens en alle dagscores naar Supabase sturen
async function versturen(poging = 1) {
  if (!gebruiker) return;
  const nummer = wijzigingNummer;
  const gegevens = laadGegevens();
  const basis = laadBasis();
  const nieuweVersie = new Date().toISOString();

  let gelukt;
  if (basis) {
    // Alleen bijwerken als de rij nog op onze basisversie staat
    const { data, error } = await db
      .from("planners")
      .update({ gegevens, bijgewerkt_op: nieuweVersie })
      .eq("user_id", gebruiker.id)
      .eq("bijgewerkt_op", basis.versie)
      .select("user_id");
    if (error) throw error;
    gelukt = data.length === 1;
  } else {
    // Nog geen basis: alleen een nieuwe rij maken als er nog geen is
    const { error } = await db
      .from("planners")
      .insert({ user_id: gebruiker.id, gegevens, bijgewerkt_op: nieuweVersie });
    if (error && error.code !== "23505") throw error; // 23505 = bestaat al
    gelukt = !error;
  }

  if (!gelukt) {
    // Een ander apparaat was ons voor. Nieuwe versie ophalen en samenvoegen.
    if (poging > 3) throw new Error("Te vaak geprobeerd");
    const { data: rij, error } = await haalRij();
    if (error) throw error;
    if (rij) {
      const samen = basis
        ? voegDrieweg(basis.gegevens, laadGegevens(), rij.gegevens)
        : { ...rij.gegevens, dagen: { ...rij.gegevens.dagen, ...laadGegevens().dagen } };
      localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(samen));
      bewaarBasis(rij.bijgewerkt_op, rij.gegevens);
    } else {
      localStorage.removeItem(SYNC_BASIS); // rij bestaat niet meer: opnieuw aanmaken
    }
    toonAlles();
    return versturen(poging + 1);
  }

  bewaarBasis(nieuweVersie, gegevens);

  // De dagscores. Die zijn altijd uit de gegevens te berekenen,
  // dus hier is gewoon "toevoegen of bijwerken" (upsert) goed.
  const scores = Object.keys(gegevens.dagen).map((datum) => ({
    user_id: gebruiker.id,
    datum,
    score: Math.round(dagScore(datum)),
  }));
  if (scores.length) {
    const { error } = await db.from("dagscores").upsert(scores);
    if (error) throw error;
  }

  // Alleen "klaar" als er intussen geen nieuwe wijziging is bijgekomen
  if (nummer === wijzigingNummer) localStorage.removeItem(SYNC_WACHT);
  zetSyncStatus("");
}

// De online versie ophalen en op dit apparaat zetten
async function ophalen() {
  if (!gebruiker) return;

  // Staan er nog eigen wijzigingen klaar? Die eerst versturen.
  // De versiecontrole zorgt dat we daarbij niets van een ander apparaat wissen.
  if (localStorage.getItem(SYNC_WACHT)) {
    await versturen();
    toonAlles();
    return;
  }

  const { data, error } = await haalRij();
  if (error) {
    zetSyncStatus("⚠️ Niet bijgewerkt");
    return;
  }

  // Is op dit apparaat nog nooit met een account gesynchroniseerd?
  // Dan zijn de gegevens hier van vóór het inloggen, en die willen we bewaren.
  const eersteKeerHier = !localStorage.getItem(SYNC_GEBRUIKER);

  if (!data) {
    // Nog niets online: alles van dit apparaat gaat omhoog
    localStorage.removeItem(SYNC_BASIS);
    localStorage.setItem(SYNC_WACHT, "ja");
    await versturen();
  } else if (eersteKeerHier) {
    // Online staat al iets: samenvoegen en het resultaat weer online zetten
    const samen = voegSamen(data.gegevens, laadGegevens());
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(samen));
    bewaarBasis(data.bijgewerkt_op, data.gegevens);
    localStorage.setItem(SYNC_WACHT, "ja");
    await versturen();
  } else {
    // Gewone keer: de online versie is de juiste
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(data.gegevens));
    bewaarBasis(data.bijgewerkt_op, data.gegevens);
  }
  localStorage.setItem(SYNC_GEBRUIKER, gebruiker.id);
  zetSyncStatus("");
  toonAlles();
}

// Kom je terug in de app (bijvoorbeeld na je laptop te hebben gebruikt)?
// Dan halen we de nieuwste versie op.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") haalVanServer();
});

// Supabase laat ons weten als je in- of uitlogt (ook bij het opstarten).
db.auth.onAuthStateChange((gebeurtenis, sessie) => {
  gebruiker = sessie ? sessie.user : null;
  const ingelogd = Boolean(gebruiker);
  document.querySelector("#account-tekst").textContent = ingelogd
    ? `☁️ ${gebruiker.email}`
    : "Niet ingelogd";
  document.querySelector("#inlog-knop").hidden = ingelogd;
  document.querySelector("#uitlog-knop").hidden = !ingelogd;

  if (!ingelogd) {
    clearTimeout(syncTimer);
    zetSyncStatus("");
  }
  if (ingelogd && (gebeurtenis === "SIGNED_IN" || gebeurtenis === "INITIAL_SESSION")) {
    // setTimeout: Supabase raadt aan om hier niet direct te wachten op een andere Supabase-vraag
    setTimeout(haalVanServer, 0);
  }
  toonHerinneringKnop();
});

// ============================================================
// Herinneringen (pushmeldingen)
// ============================================================
//
// Aanzetten gaat in drie stappen:
// 1. toestemming vragen aan de iPhone (pas na een tik op de knop),
// 2. een push-abonnement maken: een uniek "adres" voor dit apparaat,
// 3. dat abonnement opslaan in Supabase, zodat de Edge Function weet waarheen.

// De publieke VAPID-sleutel. Die mag openbaar zijn; de private sleutel
// staat alleen in de Supabase-secrets.
const VAPID_PUBLIEK = "BGcfGa2SyRbxMVyrKcOmS0w5zoVMY4RizP571tE8ft40Ki0YnKP-RcaizhirzRoY647CJqTmdTFqx2_tsb7RTzE";

const herinneringKnop = document.querySelector("#herinnering-knop");

// Kan dit apparaat pushmeldingen krijgen? Op de iPhone alleen in de app op het beginscherm.
function pushMogelijk() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function haalAbonnement() {
  // getRegistration geeft "niets" als de service worker niet is aangemeld,
  // in plaats van eeuwig te wachten (zoals .ready zou doen)
  const registratie = await navigator.serviceWorker.getRegistration();
  return registratie ? registratie.pushManager.getSubscription() : null;
}

async function toonHerinneringKnop() {
  if (!gebruiker || !pushMogelijk() || !(await navigator.serviceWorker.getRegistration())) {
    herinneringKnop.hidden = true;
    return;
  }
  const abonnement = await haalAbonnement();
  herinneringKnop.textContent = abonnement
    ? "🔕 Herinneringen uitzetten"
    : "🔔 Herinneringen aanzetten";
  herinneringKnop.hidden = false;
}

// De sleutel staat als tekst (base64url); de browser wil hem als losse bytes
function naarBytes(tekst) {
  const base64 = (tekst + "===".slice((tekst.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (teken) => teken.charCodeAt(0));
}

async function zetHerinneringenAan() {
  // Stap 1: toestemming. Dit moet direct na de tik gebeuren, anders weigert de iPhone.
  const toestemming = await Notification.requestPermission();
  if (toestemming !== "granted") {
    alert("Meldingen zijn niet toegestaan. Je kunt ze aanzetten via Instellingen → Meldingen → Dagplanner.");
    return;
  }

  // Stap 2: abonnement maken. userVisibleOnly: we beloven elke push als melding te tonen.
  const registratie = await navigator.serviceWorker.ready;
  const abonnement = await registratie.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: naarBytes(VAPID_PUBLIEK),
  });

  // Stap 3: opslaan in Supabase. toJSON() geeft het adres en de twee sleutels.
  const gegevens = abonnement.toJSON();
  const { error } = await db.from("push_abonnementen").upsert(
    {
      user_id: gebruiker.id,
      endpoint: gegevens.endpoint,
      p256dh: gegevens.keys.p256dh,
      auth: gegevens.keys.auth,
    },
    { onConflict: "endpoint" } // bestaat dit adres al, werk de rij dan bij
  );
  if (error) {
    await abonnement.unsubscribe();
    alert("Het aanzetten lukte niet. Probeer het later opnieuw.");
  }
}

async function zetHerinneringenUit() {
  if (!pushMogelijk()) return;
  const abonnement = await haalAbonnement();
  if (!abonnement) return;
  await db.from("push_abonnementen").delete().eq("endpoint", abonnement.endpoint);
  await abonnement.unsubscribe();
}

herinneringKnop.addEventListener("click", async () => {
  herinneringKnop.disabled = true;
  try {
    if (await haalAbonnement()) {
      await zetHerinneringenUit();
    } else {
      await zetHerinneringenAan();
    }
  } finally {
    herinneringKnop.disabled = false;
    toonHerinneringKnop();
  }
});

// ============================================================
// Instellingen: kleurenschema kiezen
// ============================================================

// De keuzes, in de volgorde waarin je ze ziet
const THEMAS = [
  { id: "automatisch", naam: "Automatisch" },
  { id: "pastel", naam: "Fris pastel" },
  { id: "licht", naam: "Licht" },
  { id: "donker", naam: "Donker" },
  { id: "fel", naam: "Fel" },
  { id: "blauw", naam: "Rustig blauw" },
  { id: "eigen", naam: "Eigen kleuren" },
];

const themaKeuzes = document.querySelector("#thema-keuzes");

// Eén keer de kaartjes maken: een voorbeeldje plus een radioknop met de naam
function voorbeeld(id) {
  return `
    <span class="thema-voorbeeld" data-thema="${id}" aria-hidden="true">
      <span class="vb-kaart"><span class="vb-stip"></span><span class="vb-tekst"></span></span>
      <span class="vb-knop"></span>
    </span>`;
}

THEMAS.forEach(({ id, naam }) => {
  const keuze = document.createElement("label");
  keuze.className = "thema-keuze";
  // Automatisch: een voorbeeldje van licht (pastel) én donker naast elkaar
  const plaatje =
    id === "automatisch"
      ? `<span class="vb-duo">${voorbeeld("pastel")}${voorbeeld("donker")}</span>`
      : voorbeeld(id);
  keuze.innerHTML = `${plaatje}
    <span class="thema-naam"><input type="radio" name="thema" value="${id}"> ${naam}</span>`;
  themaKeuzes.append(keuze);
});

const eigenKleuren = document.querySelector("#eigen-kleuren");
const waarschuwing = document.querySelector("#contrast-waarschuwing");

// Instellingen aanpassen, bewaren (en dus ook naar Supabase) en meteen tonen
function wijzigInstellingen(wijziging) {
  const gegevens = laadGegevens();
  gegevens.instellingen = { ...(gegevens.instellingen || {}), ...wijziging };
  bewaarGegevens(gegevens);
  pasThemaToe(gegevens.instellingen);
  toonInstellingen();
}

themaKeuzes.addEventListener("change", (event) => {
  wijzigInstellingen({ thema: event.target.value });
});

// Een kleurkiezer verschuiven: meteen toepassen ("input" = tijdens het kiezen)
eigenKleuren.addEventListener("input", (event) => {
  if (event.target.type !== "color") return;
  const eigen = { ...EIGEN_STANDAARD, ...(laadGegevens().instellingen || {}).eigen };
  eigen[event.target.name] = event.target.value;
  wijzigInstellingen({ eigen });
});

document.querySelector("#standaard-knop").addEventListener("click", () => {
  if (!confirm("Terug naar de standaardkleuren? Je eigen kleuren worden gewist.")) return;
  const gegevens = laadGegevens();
  gegevens.instellingen = { ...(gegevens.instellingen || {}), thema: THEMA_STANDAARD };
  delete gegevens.instellingen.eigen;
  bewaarGegevens(gegevens);
  pasThemaToe(gegevens.instellingen);
  toonInstellingen();
});

// Waarschuwingen als iets slecht leesbaar wordt. Je mag het toch zo laten.
function contrastWaarschuwingen(eigen) {
  const meldingen = [];
  const getal = (waarde) => waarde.toFixed(1).replace(".", ",");

  const tekst = contrast(eigen.tekst, eigen.achtergrond);
  if (tekst < 4.5) {
    meldingen.push(`De tekst is slecht leesbaar op deze achtergrond (contrast ${getal(tekst)} : 1).`);
  }
  const knop = contrast(besteTekstOp(eigen.knoppen), eigen.knoppen);
  if (knop < 4.5) {
    meldingen.push(`De tekst op de knoppen is slecht leesbaar (contrast ${getal(knop)} : 1).`);
  }
  const scores = contrast(eigen.knoppen, eigen.achtergrond);
  if (scores < 4.5) {
    meldingen.push(`Scores in de knopkleur zijn slecht leesbaar op de achtergrond (contrast ${getal(scores)} : 1).`);
  }
  return meldingen;
}

// De juiste keuze aangevinkt laten zien, en bij "Eigen kleuren" de kleurkiezers
function toonInstellingen() {
  const instellingen = laadGegevens().instellingen || {};
  const thema = instellingen.thema || THEMA_STANDAARD;
  const eigen = { ...EIGEN_STANDAARD, ...instellingen.eigen };

  themaKeuzes.querySelectorAll("input").forEach((radio) => {
    radio.checked = radio.value === thema;
  });

  // Het voorbeeldje van "Eigen kleuren" in jouw kleuren
  zetEigenKleuren(themaKeuzes.querySelector('.thema-voorbeeld[data-thema="eigen"]'), eigen);

  eigenKleuren.hidden = thema !== "eigen";
  eigenKleuren.querySelectorAll("input").forEach((kiezer) => {
    kiezer.value = eigen[kiezer.name];
  });

  waarschuwing.innerHTML = "";
  if (thema === "eigen") {
    contrastWaarschuwingen(eigen).forEach((tekst) => {
      const regel = document.createElement("p");
      regel.className = "waarschuwing";
      regel.textContent = `⚠️ ${tekst} Minstens 4,5 : 1 is aan te raden.`;
      waarschuwing.append(regel);
    });
  }
}

// Het tandwieltje opent het instellingenscherm.
// Geen van de menuknoppen is dan "actief"; tik er een aan om terug te gaan.
document.querySelector("#instellingen-knop").addEventListener("click", () => {
  toonScherm("scherm-instellingen");
  toonAlles();
});

// ============================================================
// Opstarten
// ============================================================

// Alle schermen vullen. Dit gebeurt ook bij elke wissel van scherm,
// zodat je altijd de juiste dag ziet, ook als de app over middernacht open stond.
function toonAlles() {
  toonMorgen();
  toonVandaag();
  toonTerugblik();
  toonScore();
  toonInstellingen();
  // Thema opnieuw toepassen: misschien is het via een ander apparaat veranderd
  pasThemaToe(laadGegevens().instellingen || {});
}

menuKnoppen.forEach((knop) => knop.addEventListener("click", toonAlles));
toonAlles();

// De service worker aanmelden (nodig voor meldingen).
// Oudere browsers kennen dit niet; dan slaan we het over.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
