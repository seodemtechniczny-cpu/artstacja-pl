// Kącik z kurtyną pod ścianą zachodnią (Blender: rig „kacik”, zasłona 4,6 m): wypieczona kurtyna i lampa podłogowa
// wycięte z atlasu (spacer3d.js), w ich miejscu scena: podest z listwą światła, dwie połówki kurtyny z fałdami, które
// rozsuwają się na boki, gdy spacer podchodzi na wprost (zasuwają po odejściu), a za nimi ściana z wydarzeniami —
// tytuł i trzy karty-plakaty pod reflektorami, każda klikalna (podgląd jak obraz).
import * as T from './vendor/three.min.js';
import { PALETA } from './przedsionek-dane.js';

export const KURTYNA = { x: 0.3, z0: -13.05, z1: -8.35, h: 3.57 };   // płaszczyzna fałd i zasięg wzdłuż ściany
export const LAMPA = { x: 0.7, z: -11.0 };                            // lampa podłogowa z kącika (wycinana z wypieku)
const PODEST = { x: 0.9, h: 0.12 };   // głęboki: przykrywa wypieczony cień starej kurtyny i stopę lampy
const SRODEK = (KURTYNA.z0 + KURTYNA.z1) / 2, SCIANA = { x: 0.03, z0: -12.95, z1: -8.45, y0: PODEST.h, y1: 3.5 };
const WYDARZENIA = [   // z zakładki Wydarzenia (index.html), od najnowszego
  { id: 'wydarzenie-2025', data: '28.10', rok: '2025', tytul: 'Warsztaty malarskie dla dorosłych', miejsce: 'Stacja Artystyczna Rynek', tlo: '#efe7dc' },
  { id: 'wydarzenie-2024', data: '05.10', rok: '2024', tytul: 'Wystawa prac uczestników warsztatów', miejsce: 'ArtNoc 2024 · Stacja Artystyczna Rynek', tlo: '#e4d4c2' },
  { id: 'wydarzenie-2023', data: '07.10', rok: '2023', tytul: 'Wystawa „Uwolnij swoje emocje”', miejsce: 'ArtNoc 2023 · Stacja Artystyczna Rynek', tlo: '#d6bfa7' },
];
const KARTA = { w: 0.8, h: 1.1, y: 1.62 }, KARTY_U = [2.32, 3.22, 4.12];   // u = metry od lewej krawędzi ściany (patrząc z sali)
const zU = u => SCIANA.z1 - u;                                            // patrząc na ścianę W z sali, w prawo maleje z

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return [c, c.getContext('2d')]; };
const tekstura = c => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; };
function zawin(g, s, maks) { const w = s.split(' '), l = ['']; for (const x of w) { const p = (l.at(-1) + ' ' + x).trim(); if (g.measureText(p).width > maks && l.at(-1)) l.push(x); else l[l.length - 1] = p; } return l; }

function scianaTlo() {   // ściana za kurtyną: ciepła plama światła sceny i stożki reflektorów nad kartami (bez tekstu)
  const M = 200, w = SCIANA.z1 - SCIANA.z0, h = SCIANA.y1 - SCIANA.y0, [c, g] = canvas(w * M, h * M), m = v => v * M;
  const t = g.createRadialGradient(m(w * 0.45), m(0.1), 0, m(w * 0.45), m(0.1), m(3.6));
  const k = PALETA.tablica;
  t.addColorStop(0, k[0]); t.addColorStop(0.5, k[1]); t.addColorStop(1, k[2]);
  g.fillStyle = t; g.fillRect(0, 0, c.width, c.height);
  for (const u of KARTY_U) {
    g.save(); g.translate(m(u), 0); g.scale(0.42, 1);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, m(2.7));
    r.addColorStop(0, 'rgba(255, 214, 170, 0.32)'); r.addColorStop(0.75, 'rgba(255, 196, 140, 0.17)'); r.addColorStop(1, 'rgba(255, 190, 130, 0)');
    g.fillStyle = r; g.fillRect(-m(2.7), 0, m(5.4), m(2.7)); g.restore();
    g.save(); g.shadowColor = 'rgba(0, 0, 0, 0.55)'; g.shadowBlur = 18; g.shadowOffsetY = 10; g.fillStyle = '#1b130d';
    g.fillRect(m(u - KARTA.w / 2), m(SCIANA.y1 - KARTA.y - KARTA.h / 2), m(KARTA.w), m(KARTA.h)); g.restore();
  }
  return tekstura(c);
}

function tytul() {   // typografia lewej części ściany, osobna przezroczysta warstwa w wysokiej rozdzielczości (ostra z bliska)
  const M = 1400, w = 1.55, h = 1.6, [c, g] = canvas(w * M, h * M), m = v => v * M;
  const tekst = (s, x, y, font, kolor, odstep = 0) => { g.font = font; g.fillStyle = kolor; g.letterSpacing = `${odstep}px`; g.fillText(s, m(x), m(y)); };
  tekst('03 · WYDARZENIA', 0.02, 0.12, `600 ${m(0.05)}px Manrope`, '#e09a72', m(0.014));
  tekst('Wydarzenia', 0, 0.48, `200 ${m(0.27)}px Manrope`, '#efe7dc', -m(0.01));
  tekst('Wystawy i spotkania', 0.02, 0.66, `300 ${m(0.085)}px Manrope`, '#c9b9a6');
  g.fillStyle = 'rgba(239, 231, 220, 0.4)'; g.fillRect(m(0.02), m(0.82), m(1.4), 3);
  tekst('Najbliższy termin — wkrótce', 0.02, 1.0, `500 ${m(0.075)}px Manrope`, '#efe7dc');
  tekst('Zadzwoń albo napisz, dam znać.', 0.02, 1.12, `300 ${m(0.058)}px Manrope`, '#c9b9a6');
  tekst('605 318 518', 0.02, 1.36, `200 ${m(0.15)}px Manrope`, '#efe7dc');
  return [tekstura(c), w, h];
}

function karta(e) {   // plakat wydarzenia: papier w tonach strony, ciemna typografia
  const M = 1300, [c, g] = canvas(KARTA.w * M, KARTA.h * M), m = v => v * M, W = c.width;
  g.fillStyle = e.tlo; g.fillRect(0, 0, W, c.height);
  const d = g.getImageData(0, 0, W, c.height), p = d.data;   // ziarno papieru
  for (let i = 0; i < p.length; i += 4) { const n = (Math.random() - 0.5) * 7; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(d, 0, 0);
  const tekst = (s, x, y, font, kolor, odstep = 0) => { g.font = font; g.fillStyle = kolor; g.letterSpacing = `${odstep}px`; g.fillText(s, m(x), m(y)); };
  const CIEMNY = '#1f1611', SREDNI = '#6b5847', AKCENT = '#a85530', X = 0.07;
  tekst(`WYDARZENIE · ${e.rok}`, X, 0.12, `600 ${m(0.032)}px Manrope`, AKCENT, m(0.009));
  tekst(e.data, X - 0.008, 0.36, `200 ${m(0.21)}px Manrope`, CIEMNY, -m(0.006));
  tekst(e.rok, X, 0.45, `300 ${m(0.07)}px Manrope`, SREDNI);
  g.fillStyle = 'rgba(31, 22, 17, 0.35)'; g.fillRect(m(X), m(0.53), m(KARTA.w - 2 * X), 3);
  g.font = `500 ${m(0.06)}px Manrope`; g.letterSpacing = '0px';
  zawin(g, e.tytul, m(KARTA.w - 2 * X)).forEach((l, i) => tekst(l, X, 0.64 + i * 0.075, `500 ${m(0.06)}px Manrope`, CIEMNY));
  g.font = `600 ${m(0.028)}px Manrope`; g.letterSpacing = `${m(0.007)}px`;
  zawin(g, e.miejsce.toUpperCase(), m(KARTA.w - 2 * X)).forEach((l, i) => tekst(l, X, 0.84 + i * 0.045, `600 ${m(0.028)}px Manrope`, SREDNI, m(0.007)));
  tekst('Kliknij — szczegóły', X, KARTA.h - 0.06, `500 ${m(0.03)}px Manrope`, AKCENT, m(0.004));
  return tekstura(c);
}

function polowa(zE, kier, mat) {   // połówka kurtyny: siatka N × M, wierzchołki liczone na nowo tylko w ruchu
  const N = 90, Mw = 6, geo = new T.BufferGeometry(), poz = new Float32Array((N + 1) * (Mw + 1) * 3), kol = [], idx = [];
  const szer = Math.abs(SRODEK - zE), baza = new T.Color(PALETA.kurtyna);
  for (let j = 0; j <= Mw; j++) for (let i = 0; i <= N; i++) {
    const s = i / N, faza = s * szer * 9, cien = (0.32 + 0.68 * (0.5 + 0.5 * Math.cos(faza))) * (0.78 + 0.22 * j / Mw);
    kol.push(baza.r * cien, baza.g * cien, baza.b * cien);
  }
  for (let j = 0; j < Mw; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  geo.setAttribute('position', new T.BufferAttribute(poz, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(kol, 3)); geo.setIndex(idx);
  const ustaw = o => {   // o: 0 zasunięta, 1 rozsunięta (zebrana przy krawędzi, głębsze fałdy)
    const w = szer * (1 - 0.82 * o), amp = 0.05 + 0.09 * o;
    for (let j = 0; j <= Mw; j++) for (let i = 0; i <= N; i++) {
      const s = i / N, k = (j * (N + 1) + i) * 3;
      poz[k] = KURTYNA.x + amp * Math.sin(s * szer * 9); poz[k + 1] = PODEST.h + j / Mw * (KURTYNA.h - PODEST.h); poz[k + 2] = zE + kier * s * w;
    }
    geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
  };
  ustaw(0);
  return { mesh: new T.Mesh(geo, mat), ustaw };
}

export async function utworzKurtyne(scena) {
  await Promise.all(['200 100px Manrope', '300 100px Manrope', '500 100px Manrope', '600 100px Manrope'].map(f => document.fonts.load(f).catch(() => {})));
  const grupa = new T.Group(), swiatlo = [];   // materiały, którym światło sceny zapala się razem z rozsuwaniem
  const naScianie = (geo, mat, u, y, x = SCIANA.x) => { const o = new T.Mesh(geo, mat); o.rotation.y = Math.PI / 2; o.position.set(x, y, zU(u)); grupa.add(o); return o; };
  const sw = SCIANA.z1 - SCIANA.z0, sh = SCIANA.y1 - SCIANA.y0;
  const tlo = new T.MeshBasicMaterial({ map: scianaTlo() }); swiatlo.push(tlo);
  naScianie(new T.PlaneGeometry(sw, sh), tlo, sw / 2, (SCIANA.y0 + SCIANA.y1) / 2);
  const [tt, tw, th] = tytul(), mt = new T.MeshBasicMaterial({ map: tt, transparent: true }); swiatlo.push(mt);
  naScianie(new T.PlaneGeometry(tw, th), mt, 0.32 + tw / 2, 1.0 + th / 2, SCIANA.x + 0.005);
  // karty: front (płaszczyzna, klikalna, normalna do sali) + grzbiet 2 cm; góra jaśniejsza od reflektora
  const karty = WYDARZENIA.map((e, i) => {
    const geo = new T.PlaneGeometry(KARTA.w, KARTA.h), kol = [], p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const s = 0.86 + 0.14 * (p.getY(k) / KARTA.h + 0.5); kol.push(s, s * 0.98, s * 0.95); }
    geo.setAttribute('color', new T.Float32BufferAttribute(kol, 3));
    const mat = new T.MeshBasicMaterial({ map: karta(e), vertexColors: true }); swiatlo.push(mat);
    const o = naScianie(geo, mat, KARTY_U[i], KARTA.y, SCIANA.x + 0.035);
    const grzbiet = new T.Mesh(new T.BoxGeometry(0.03, KARTA.h, KARTA.w), new T.MeshBasicMaterial({ color: 0x120c08 }));
    grzbiet.position.set(SCIANA.x + 0.019, KARTA.y, zU(KARTY_U[i])); grupa.add(grzbiet);
    o.userData = { karta: true, info: { id: e.id, tytul: e.tytul, etykieta: `Wydarzenie · ${e.data}.${e.rok} · ${e.miejsce}`,
      pomoc: 'Kółko albo szczypanie — przybliżysz plakat. Esc — powrót.', link: 'Zapytaj o kolejny termin', podpis: `${e.data}.${e.rok} · kliknij` } };
    return o;
  });
  // podest sceny: orzech, jaśniejszy wierzch, listwa ciepłego światła na krawędzi; zakrywa wypieczony cień starej kurtyny
  const pz = KURTYNA.z1 - KURTYNA.z0 + 0.1, kolor = c => new T.MeshBasicMaterial({ color: c });
  const podest = new T.Mesh(new T.BoxGeometry(PODEST.x, PODEST.h, pz), [kolor(0x24170f), kolor(0x0e0906), kolor(0x4a3020), kolor(0x0e0906), kolor(0x1a110b), kolor(0x1a110b)]);
  podest.position.set(PODEST.x / 2, PODEST.h / 2, SRODEK);
  const listwa = new T.Mesh(new T.BoxGeometry(0.012, 0.012, pz - 0.04), kolor(0xe2a46a));
  listwa.position.set(PODEST.x + 0.004, PODEST.h - 0.025, SRODEK);   // przed licem podestu (wspólna płaszczyzna migała)
  grupa.add(podest, listwa);
  const mat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
  const pol = [polowa(KURTYNA.z1, -1, mat), polowa(KURTYNA.z0, 1, mat)];
  grupa.add(...pol.map(q => q.mesh));
  scena.add(grupa);
  const C = new T.Vector3(0.2, 1.6, SRODEK), kier = new T.Vector3(), do_ = new T.Vector3(), ciemno = new T.Color(0x262626), jasno = new T.Color(0xffffff);
  for (const m of swiatlo) m.color.copy(ciemno);
  const gladko = t => t * t * (3 - 2 * t);
  let p = 0, pokaz = -1;
  return {
    karty,
    otwarta: () => p > 0.85,
    aktualizuj(dt, kamera) {   // na wprost i bliżej niż 7,5 m → rozsuwa się; poza tym zasuwa (~1,9 s, bez dobicia)
      kamera.getWorldDirection(kier); do_.subVectors(C, kamera.position);
      const d = do_.length(), cel = d < 7.5 && kier.dot(do_.divideScalar(d)) > 0.5 ? 1 : 0;
      p = Math.min(1, Math.max(0, p + Math.sign(cel - p) * dt / 1.9));
      if (p === pokaz) return;
      pokaz = p;
      for (const q of pol) q.ustaw(gladko(p));
      const s = gladko(Math.min(1, Math.max(0, (p - 0.15) / 0.7)));   // światło sceny za kurtyną (natężenie)
      for (const m of swiatlo) m.color.lerpColors(ciemno, jasno, s);
    },
  };
}
