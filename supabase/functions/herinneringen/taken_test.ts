// Tests voor het rekenwerk. Uitvoeren met: deno test supabase/functions/herinneringen
import { assertEquals } from "jsr:@std/assert@1";
import { takenOmTeHerinneren } from "./taken.ts";

const gegevens = {
  dagen: {
    "2026-11-18": {
      taken: [
        { naam: "Over 30 min", begintijd: "10:00" },
        { naam: "Over 31 min", begintijd: "10:01" },
        { naam: "Afgevinkt", begintijd: "09:45", klaarOp: "2026-11-18T08:00:00Z" },
        { naam: "Al begonnen", begintijd: "09:30" },
      ],
    },
  },
};

Deno.test("winter: 09:30 Nederlandse tijd is 08:30 UTC", () => {
  const namen = takenOmTeHerinneren(gegevens, new Date("2026-11-18T08:30:00Z")).map((h) => h.taak.naam);
  assertEquals(namen, ["Over 30 min"]);
});

Deno.test("zomer: 09:30 Nederlandse tijd is 07:30 UTC", () => {
  const zomer = { dagen: { "2026-07-01": { taken: [{ naam: "Hardlopen", begintijd: "10:00" }] } } };
  assertEquals(takenOmTeHerinneren(zomer, new Date("2026-07-01T07:30:00Z")).length, 1);
  assertEquals(takenOmTeHerinneren(zomer, new Date("2026-07-01T08:30:00Z")).length, 0); // dat zou 09:30 UTC-tijd zijn
});

Deno.test("over middernacht: om 23:50 een herinnering voor 00:15 morgen", () => {
  const nacht = { dagen: { "2026-11-19": { taken: [{ naam: "Vroeg", begintijd: "00:15" }] } } };
  const h = takenOmTeHerinneren(nacht, new Date("2026-11-18T22:50:00Z"));
  assertEquals(h.map((x) => [x.datum, x.overMinuten]), [["2026-11-19", 25]]);
});

Deno.test("geen dagen: geen herinneringen", () => {
  assertEquals(takenOmTeHerinneren({}, new Date()), []);
});
