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
