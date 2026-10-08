// Przedsionek galerii przed zachodnią ścianą sali (współrzędne three.js: x w głąb sali, y w górę, z = −y Blendera).
// Wspólne dla sceny 3D (przedsionek.js) i rysunku na ekranie wejścia (wejscie.js) — kreska ma trafić w te same krawędzie.
export const SCIANA = -0.21;                                   // lico ściany zachodniej od strony przedsionka (ściana: x −0,2…0)
export const OTWOR = { z0: -5.65, z1: -3.55, h: 2.75 };        // otwór drzwiowy (w sali: y Blendera 3,55–5,65, obok baru)
export const PRZ = { x0: -9, z0: -8, z1: -1.2, h: 3 };         // przedsionek: tył, boki, sufit
export const OBRAZY = [                                        // p04 po lewej, p08 po prawej (patrząc na drzwi)
  { plik: 'obrazy/p04.webp', szkic: 'wejscie/p04-szkic.webp', z: -6.85, y: 1.55, h: 1.08, prop: 537 / 720 },
  { plik: 'obrazy/p08.webp', szkic: 'wejscie/p08-szkic.webp', z: -2.35, y: 1.55, h: 1.08, prop: 553 / 720 },
];
export const HFOV = 2 * Math.atan(36 / 2 / 16);               // obiektyw 16 mm jak w trasie (trasa.json)
export const pionowyKat = asp => Math.min(80, Math.max(50, 2 * Math.atan(Math.tan(HFOV / 2) / asp) * 180 / Math.PI));   // jak mierz() w spacer3d.js
export const SRODEK = (OTWOR.z0 + OTWOR.z1) / 2;
// kamera na starcie: na osi drzwi, tak daleko, żeby oba obrazy były w kadrze (telefon w pionie stoi dalej)
export function startPoza(asp) {
  const pol = 2.75 + 0.45;                                     // pół szerokości kadru na ścianie: obrazy z zapasem
  const hfov = 2 * Math.atan(Math.tan(pionowyKat(asp) * Math.PI / 360) * asp);
  const d = Math.min(8.2, Math.max(4.2, pol / Math.tan(hfov / 2)));
  return { poz: [SCIANA - d, 1.6, SRODEK], cel: [0, 1.42, SRODEK] };
}
// rysunek: odcinki 3D [[x,y,z],[x,y,z]] w grupach (kolejność i opóźnienie kreślenia)
export function linie(xKam) {
  const W = SCIANA, H = PRZ.h, { z0, z1 } = PRZ, xb = xKam + 0.6;   // ściany boczne tylko przed kamerą
  const o = [], drzwi = [], obrazy = [];
  o.push([[W, 0, z0], [W, 0, z1]], [[W, H, z0], [W, H, z1]], [[W, 0, z0], [W, H, z0]], [[W, 0, z1], [W, H, z1]],
    [[W, 0, z0], [xb, 0, z0]], [[W, 0, z1], [xb, 0, z1]], [[W, H, z0], [xb, H, z0]], [[W, H, z1], [xb, H, z1]]);
  const a = OTWOR.z0, b = OTWOR.z1, h = OTWOR.h, r = 0.07;
  drzwi.push([[W, 0, a - r], [W, h + r, a - r]], [[W, h + r, a - r], [W, h + r, b + r]], [[W, h + r, b + r], [W, 0, b + r]]);
  for (const [p, q] of [[a, SRODEK], [SRODEK, b]]) {           // dwa skrzydła: rama, szczeble co 0,69 m, pręt uchwytu
    const s = q > p ? 1 : -1, w = Math.abs(q - p), p1 = p + s * 0.02, q1 = q - s * 0.01;
    drzwi.push([[W, 0.02, p1], [W, h - 0.02, p1]], [[W, h - 0.02, p1], [W, h - 0.02, q1]], [[W, h - 0.02, q1], [W, 0.02, q1]], [[W, 0.02, q1], [W, 0.02, p1]]);
    for (const y of [0.69, 1.38, 2.07]) drzwi.push([[W, y, p1], [W, y, q1]]);
    drzwi.push([[W, 0.02, p + s * w / 2], [W, h - 0.02, p + s * w / 2]]);
  }
  for (const ob of OBRAZY) {
    const w = ob.h * ob.prop, y0 = ob.y - ob.h / 2, y1 = ob.y + ob.h / 2, za = ob.z - w / 2, zb = ob.z + w / 2;
    obrazy.push([[W, y1, za], [W, y1, zb]], [[W, y1, zb], [W, y0, zb]], [[W, y0, zb], [W, y0, za]], [[W, y0, za], [W, y1, za]]);
  }
  return { sala: o, drzwi, obrazy };
}

// Paleta sali od 07.10 (Michał: ciemny navy, wizualizacje szkic/warianty): sala wypieczona w niej w Blenderze (spacer.py),
// tu kolory canvasów przedsionka i ściany za kurtyną — granat ścian, jasny mikrocement, ciepłe światło na wierzchu.
export const PALETA = {
  sciana: ['#243049', '#1b253a', '#141c2d', '#0c121e'],    // od poświaty LED pod sufitem w dół (jak wypiek sali za szybą)
  posadzka: ['#b9b5ae', '#958f87', '#5f5b55'],             // mikrocement: od ściany z drzwiami w głąb
  tablica: ['#323f57', '#1f283d', '#0e131c'],               // ściana za kurtyną: plama światła sceny → brzegi
  kurtyna: '#a8783f',                                        // aksamit ochra/karmel
};
