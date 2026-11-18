// ============================================================
// Service worker: een klein script dat de telefoon op de achtergrond
// wakker maakt, ook als de app dicht is. Wij gebruiken het alleen
// voor meldingen; het bewaart geen bestanden.
// ============================================================

// Er komt een pushbericht binnen van de Edge Function: toon het als melding.
self.addEventListener("push", (event) => {
  const bericht = event.data ? event.data.json() : {};
  // waitUntil: houd de service worker wakker tot de melding er staat
  event.waitUntil(
    self.registration.showNotification(bericht.titel || "Dagplanner", {
      body: bericht.tekst || "",
      tag: bericht.tag, // zelfde tag = vervang de oude melding in plaats van een tweede
    })
  );
});

// Je tikt op de melding: open de app (of breng hem naar voren als hij al open is).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((vensters) => {
      if (vensters.length > 0) return vensters[0].focus();
      return clients.openWindow("./");
    })
  );
});
