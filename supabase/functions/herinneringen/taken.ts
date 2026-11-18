// Het rekenwerk: welke taken beginnen binnen 30 minuten, in Nederlandse tijd?
// Dit staat in een eigen bestand, zodat we het los kunnen testen (taken_test.ts).

const MINUTEN_VOORAF = 30;
const TIJDZONE = "Europe/Amsterdam";

// Datum ("2026-11-18") en minuten sinds middernacht, in Nederlandse tijd.
// Intl rekent zelf met zomer- en wintertijd.
export function nederlandseTijd(moment: Date) {
  const delen = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIJDZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(moment);
  const d = Object.fromEntries(delen.map((deel) => [deel.type, deel.value]));
  return {
    datum: `${d.year}-${d.month}-${d.day}`,
    minuten: Number(d.hour) * 60 + Number(d.minute),
  };
}

type Taak = { naam: string; begintijd: string; klaarOp?: string | null };
type Herinnering = { datum: string; taak: Taak; overMinuten: number };

// Welke taken van deze gebruiker beginnen binnen 30 minuten?
// We kijken naar vandaag én morgen, voor een taak om 00:15 als het nu 23:50 is.
export function takenOmTeHerinneren(
  gegevens: { dagen?: Record<string, { taken?: Taak[] }> },
  nu: Date,
): Herinnering[] {
  const vandaag = nederlandseTijd(nu);
  const morgen = nederlandseTijd(new Date(nu.getTime() + 24 * 60 * 60 * 1000));
  const resultaat: Herinnering[] = [];

  for (const [datum, extraMinuten] of [[vandaag.datum, 0], [morgen.datum, 24 * 60]] as const) {
    const taken = gegevens.dagen?.[datum]?.taken ?? [];
    for (const taak of taken) {
      if (taak.klaarOp) continue; // al afgevinkt: geen melding
      const [uur, minuut] = taak.begintijd.split(":").map(Number);
      const overMinuten = uur * 60 + minuut + extraMinuten - vandaag.minuten;
      if (overMinuten > 0 && overMinuten <= MINUTEN_VOORAF) {
        resultaat.push({ datum, taak, overMinuten });
      }
    }
  }
  return resultaat;
}

