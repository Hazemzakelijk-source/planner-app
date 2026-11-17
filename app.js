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
    vastgezetMelding.textContent = `Plan vastgezet om ${tijd}`;
  }

  // Een leeg plan vastzetten heeft geen zin
  vastzetKnop.disabled = dag.taken.length === 0;
}

// Maakt één <li> voor een taak.
// We gebruiken textContent (niet innerHTML) zodat getypte tekst
// altijd als gewone tekst wordt getoond en nooit als HTML-code.
function maakTaakItem(taak) {
  const item = document.createElement("li");

  const kop = document.createElement("div");
  const tijd = document.createElement("span");
  tijd.className = "tijd";
  tijd.textContent = `${taak.begintijd}–${eindtijd(taak)}`;
  kop.append(tijd, ` ${taak.naam}`);

  if (taak.belangrijkste) {
    const label = document.createElement("span");
    label.className = "label-focus label-belangrijkste";
    label.textContent = "Belangrijkste";
    kop.append(label);
  }
  if (taak.focusblok) {
    const label = document.createElement("span");
    label.className = "label-focus";
    label.textContent = "Focusblok";
    kop.append(label);
  }
  item.append(kop);

  if (taak.aanpak) {
    const aanpak = document.createElement("p");
    aanpak.className = "aanpak";
    aanpak.textContent = taak.aanpak;
    item.append(aanpak);
  }

  return item;
}

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

  opslaanKnop.textContent = "Wijziging opslaan";
  annuleerKnop.hidden = false;
  // Naar het formulier scrollen, zodat je ziet dat je aan het bewerken bent
  formulier.scrollIntoView({ behavior: "smooth" });
}

// Terug naar "nieuwe taak toevoegen"
function stopBewerken() {
  bewerkNummer = null;
  formulier.reset();
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

// "Plan vastzetten": het tijdstip bewaren. Dat hebben we later nodig
// voor de score (vóór 23:00 vastgezet = 20 punten).
vastzetKnop.addEventListener("click", () => {
  const gegevens = laadGegevens();
  const dag = haalDag(gegevens, datumSleutel(morgen()));
  dag.vastgezetOp = new Date().toISOString();
  bewaarGegevens(gegevens);
  stopBewerken();
  toonMorgen();
});

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

    const knoppen = document.createElement("div");
    knoppen.className = "knoppen";

    const startKnop = document.createElement("button");
    startKnop.textContent = taak.gestartOp
      ? `Gestart ${tijdTekst(new Date(taak.gestartOp))}`
      : "Gestart";
    startKnop.disabled = Boolean(taak.gestartOp);
    startKnop.addEventListener("click", () => zetTijdstip(nummer, "gestartOp"));

    const klaarKnop = document.createElement("button");
    klaarKnop.className = "knop-klaar";
    klaarKnop.textContent = taak.klaarOp
      ? `Klaar ${tijdTekst(new Date(taak.klaarOp))}`
      : "Klaar";
    // Klaar kan pas als de taak gestart is, en maar één keer
    klaarKnop.disabled = !taak.gestartOp || Boolean(taak.klaarOp);
    klaarKnop.addEventListener("click", () => zetTijdstip(nummer, "klaarOp"));

    knoppen.append(startKnop, klaarKnop);
    item.append(knoppen);
    tijdlijn.append(item);
  });
}

// Bewaart het huidige tijdstip bij een taak van vandaag,
// als "gestartOp" of als "klaarOp"
function zetTijdstip(nummer, veld) {
  const gegevens = laadGegevens();
  const dag = gegevens.dagen[datumSleutel(new Date())];
  dag.taken[nummer][veld] = new Date().toISOString();
  bewaarGegevens(gegevens);
  toonVandaag();
}

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
function dagScore(sleutel) {
  const dag = laadGegevens().dagen[sleutel];
  if (!dag || dag.taken.length === 0) return 0;

  let punten = 0;

  // 20 punten: plan vastgezet op de avond ervoor, vóór 23:00
  if (dag.vastgezetOp) {
    const vastgezet = new Date(dag.vastgezetOp);
    const avondErvoor = dagenTerug(datumVanSleutel(sleutel), 1);
    if (
      datumSleutel(vastgezet) === datumSleutel(avondErvoor) &&
      vastgezet.getHours() < 23
    ) {
      punten += 20;
    }
  }

  const afgerond = dag.taken.filter((taak) => taak.klaarOp);
  const opTijd = afgerond.filter(
    (taak) => new Date(taak.klaarOp) <= eindeBlok(sleutel, taak)
  );

  // De belangrijkste taak telt dubbel: hij weegt 2, een gewone taak 1.
  // We tellen dus geen taken meer, maar gewichten.
  const gepland = totaalGewicht(dag.taken);

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

function toonScore() {
  // Math.round rondt af op hele punten, zodat je geen 66.666667 ziet
  document.querySelector("#score-vandaag").textContent = Math.round(
    dagScore(datumSleutel(new Date()))
  );
  document.querySelector("#score-week").textContent = Math.round(weekGemiddelde());
  document.querySelector("#score-reeks").textContent = reeks();
}

// ============================================================
// Opstarten
// ============================================================

// Alle schermen vullen. Dit gebeurt ook bij elke wissel van scherm,
// zodat je altijd de juiste dag ziet, ook als de app over middernacht open stond.
function toonAlles() {
  toonMorgen();
  toonVandaag();
  toonScore();
}

menuKnoppen.forEach((knop) => knop.addEventListener("click", toonAlles));
toonAlles();
