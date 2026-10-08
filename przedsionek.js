// Przedsionek galerii w scenie three.js: ściany, podłoga i sufit z „wypiekiem” malowanym na canvasie (ten sam granat
// i światło co sala), dwa obrazy pod reflektorami, przeszklone drzwi dwuskrzydłowe w stalowych ramach. W ścianie sali
// wycięty otwór (discard w shaderze wypieku), skrzydła otwierają się do środka sali.
import * as T from './vendor/three.min.js';
import { SCIANA, OTWOR, PRZ, OBRAZY, SRODEK, PALETA } from './przedsionek-dane.js';
const SC = PALETA.sciana, PO = PALETA.posadzka;

const PX = 300;   // pikseli canvasu na metr
function plotno(w, h, rysuj) {
  const c = document.createElement('canvas'); c.width = Math.round(w * PX); c.height = Math.round(h * PX);
  const g = c.getContext('2d'); rysuj(g, c.width, c.height);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function ziarno(g, w, h, a) {   // lekka faktura tynku/drewna, raz przy tworzeniu
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const n = (Math.random() - 0.5) * a; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(d, 0, 0);
}
function stozek(g, x, y, rx, ry, moc) {   // plama reflektora na ścianie (elipsa od oprawy w dół)
  g.save(); g.translate(x, y); g.scale(rx / ry, 1);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, ry);
  r.addColorStop(0, `rgba(255, 214, 170, ${0.42 * moc})`); r.addColorStop(0.72, `rgba(255, 196, 140, ${0.24 * moc})`);
  r.addColorStop(0.95, `rgba(255, 190, 130, ${0.06 * moc})`); r.addColorStop(1, 'rgba(255, 190, 130, 0)');
  g.fillStyle = r; g.fillRect(-ry, 0, 2 * ry, ry); g.restore();
}
// prostokąt w płaszczyźnie: funkcja (u, v) → [x, y, z], UV 0–1 na całe płótno
function plat(rog, u0, u1, v0, v1, mat) {
  const geo = new T.BufferGeometry(), p = [], uv = [];
  for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]]) { p.push(...rog(u, v)); uv.push(u, v); }
  geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return new T.Mesh(geo, mat);
}
const pudlo = (sx, sy, sz, kolor, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), new T.MeshBasicMaterial({ color: kolor })); m.position.set(x, y, z); return m; };

export async function utworzPrzedsionek(scena) {
  const grupa = new T.Group(), W = SCIANA, H = PRZ.h, sz = PRZ.z1 - PRZ.z0, gl = W - PRZ.x0;
  const zU = z => (z - PRZ.z0) / sz;
  // ściana z drzwiami: tynk w ciepłym brązie, poświata LED spod sufitu, stożki reflektorów nad obrazami, cienie obrazów
  const sciana = plotno(sz, H, (g, w, h) => {
    const t = g.createLinearGradient(0, 0, 0, h);
    t.addColorStop(0, SC[0]); t.addColorStop(0.08, SC[1]); t.addColorStop(0.4, SC[2]); t.addColorStop(1, SC[3]);
    g.fillStyle = t; g.fillRect(0, 0, w, h);
    for (const ob of OBRAZY) {
      const x = zU(ob.z) * w, wp = ob.h * ob.prop * PX, hp = ob.h * PX, yp = (H - ob.y) * PX;
      stozek(g, x, 0.02 * PX, wp * 0.95, yp + hp * 0.75, 1);
      g.save(); g.shadowColor = 'rgba(0, 0, 0, 0.6)'; g.shadowBlur = 34; g.shadowOffsetY = 16; g.fillStyle = '#1a110b';
      g.fillRect(x - wp / 2, yp - hp / 2, wp, hp); g.restore();
    }
    const d = (OTWOR.z0 - PRZ.z0) / sz * w, e = (OTWOR.z1 - PRZ.z0) / sz * w;   // światło sali przez szkło kładzie się na ościeżach
    const sw = g.createLinearGradient(0, (H - OTWOR.h) * PX, 0, h);
    sw.addColorStop(0, 'rgba(255, 190, 130, 0)'); sw.addColorStop(1, 'rgba(255, 190, 130, 0.08)');
    g.fillStyle = sw; g.fillRect(d - 0.25 * PX, (H - OTWOR.h) * PX, e - d + 0.5 * PX, OTWOR.h * PX);
    g.fillStyle = '#100a07'; g.fillRect(0, h - 0.07 * PX, w, 0.07 * PX);    // cokół
    ziarno(g, w, h, 7);
  });
  const mSc = new T.MeshBasicMaterial({ map: sciana, side: T.DoubleSide });
  const naScianie = (u, v) => [W, v * H, PRZ.z0 + u * sz];
  const ua = zU(OTWOR.z0), ub = zU(OTWOR.z1), vh = OTWOR.h / H;
  grupa.add(plat(naScianie, 0, ua, 0, 1, mSc), plat(naScianie, ub, 1, 0, 1, mSc), plat(naScianie, ua, ub, vh, 1, mSc));
  // podłoga: mikrocement, plamy światła pod obrazami i ciepły klin światła z sali przed drzwiami
  const podloga = plotno(gl, sz, (g, w, h) => {   // u: od ściany w tył przedsionka, v: z
    const t = g.createLinearGradient(0, 0, w, 0); t.addColorStop(0, PO[0]); t.addColorStop(0.45, PO[1]); t.addColorStop(1, PO[2]);
    g.fillStyle = t; g.fillRect(0, 0, w, h);
    for (const ob of OBRAZY) {   // canvas odwrócony w pionie (flipY): z → 1 − v
      const zy = (1 - zU(ob.z)) * h, r = g.createRadialGradient(0.5 * PX, zy, 0, 0.5 * PX, zy, 1.3 * PX); r.addColorStop(0, 'rgba(255, 196, 140, 0.16)'); r.addColorStop(1, 'rgba(255, 196, 140, 0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }
    const zc = zU(SRODEK) * h, ow = (OTWOR.z1 - OTWOR.z0) * PX;
    const k = g.createLinearGradient(0, 0, 2.6 * PX, 0); k.addColorStop(0, 'rgba(255, 200, 140, 0.3)'); k.addColorStop(1, 'rgba(255, 200, 140, 0)');
    g.fillStyle = k; g.beginPath(); g.moveTo(0, zc - ow / 2); g.lineTo(2.6 * PX, zc - ow * 0.9); g.lineTo(2.6 * PX, zc + ow * 0.9); g.lineTo(0, zc + ow / 2); g.fill();
    ziarno(g, w, h, 6);
  });
  grupa.add(plat((u, v) => [W - u * gl, 0, PRZ.z0 + v * sz], 0, 1, 0, 1, new T.MeshBasicMaterial({ map: podloga, side: T.DoubleSide })));
  // sufit: ciemny, jaśniejszy przy ścianie z drzwiami (poświata LED)
  const sufit = plotno(gl / 4, sz / 4, (g, w, h) => {
    const t = g.createLinearGradient(0, 0, w, 0); t.addColorStop(0, '#3a2a1f'); t.addColorStop(0.06, '#1f1610'); t.addColorStop(1, '#0e0a07');
    g.fillStyle = t; g.fillRect(0, 0, w, h);
  });
  grupa.add(plat((u, v) => [W - u * gl, H, PRZ.z0 + v * sz], 0, 1, 0, 1, new T.MeshBasicMaterial({ map: sufit, side: T.DoubleSide })));
  // ściany boczne: brąz gasnący w głąb przedsionka
  const bok = plotno(gl / 2, H / 2, (g, w, h) => {
    const t = g.createLinearGradient(0, 0, w, 0); t.addColorStop(0, SC[1]); t.addColorStop(1, SC[3]);
    g.fillStyle = t; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255, 190, 130, 0.07)'); v.addColorStop(0.2, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const mBok = new T.MeshBasicMaterial({ map: bok, side: T.DoubleSide });
  grupa.add(plat((u, v) => [W - u * gl, v * H, PRZ.z0], 0, 1, 0, 1, mBok), plat((u, v) => [W - u * gl, v * H, PRZ.z1], 0, 1, 0, 1, mBok));
  grupa.add(pudlo(0.03, 0.012, sz, 0xe2a46a, W - 0.12, H - 0.02, (PRZ.z0 + PRZ.z1) / 2));   // listwa LED przy suficie
  // obrazy: płótno 3,5 cm, front z pracą (góra jaśniejsza — reflektor), boki ciemne; oprawy reflektorów na suficie
  const ladowacz = new T.TextureLoader(), bokPl = new T.MeshBasicMaterial({ color: 0x15100c });
  const tekstury = await Promise.all(OBRAZY.map(ob => ladowacz.loadAsync(ob.plik)));
  for (const [i, ob] of OBRAZY.entries()) {
    const t = tekstury[i]; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    const w = ob.h * ob.prop, geo = new T.BoxGeometry(w, ob.h, 0.035), kol = [], pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const k = 0.8 + 0.22 * (pos.getY(i) / ob.h + 0.5); kol.push(k, k * 0.97, k * 0.93); }
    geo.setAttribute('color', new T.Float32BufferAttribute(kol, 3));
    const front = new T.MeshBasicMaterial({ map: t, vertexColors: true });
    const m = new T.Mesh(geo, [bokPl, bokPl, bokPl, bokPl, front, bokPl]);
    m.rotation.y = -Math.PI / 2; m.position.set(W - 0.03, ob.y, ob.z);
    grupa.add(m, pudlo(0.09, 0.16, 0.09, 0x0b0807, W - 0.75, H - 0.08, ob.z));
  }
  // otwór: ościeża i nadproże w grubości ściany, opaska od strony przedsionka
  const STAL = 0x131110, a = OTWOR.z0, b = OTWOR.z1, h = OTWOR.h;
  grupa.add(pudlo(0.22, h, 0.03, STAL, -0.1, h / 2, a - 0.015), pudlo(0.22, h, 0.03, STAL, -0.1, h / 2, b + 0.015), pudlo(0.22, 0.03, b - a + 0.06, STAL, -0.1, h + 0.015, SRODEK));
  grupa.add(pudlo(0.02, h + 0.07, 0.07, STAL, W - 0.01, (h + 0.07) / 2, a - 0.035), pudlo(0.02, h + 0.07, 0.07, STAL, W - 0.01, (h + 0.07) / 2, b + 0.035), pudlo(0.02, 0.07, b - a + 0.14, STAL, W - 0.01, h + 0.035, SRODEK));
  // próg w grubości ściany: bez niego między podłogą sali a podłogą przedsionka prześwitywało tło (kropki przy podłodze)
  grupa.add(pudlo(-W + 0.06, 0.024, b - a, STAL, W / 2 + 0.02, -0.008, SRODEK));
  // skrzydła: stalowa rama 4,5 cm, szczeble, szkło z ciepłym odcieniem, mosiężny pręt; zawias przy ościeżu, otwierają się do sali
  const szklo = new T.MeshBasicMaterial({ color: 0x3a2c22, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
  const mosiadz = new T.MeshBasicMaterial({ color: 0xb48a52 });
  const skrzydla = [[a, 1], [b, -1]].map(([z, s]) => {
    const piv = new T.Group(), w = (b - a) / 2 - 0.012; piv.position.set(-0.1, 0, z);
    const L = (sx, sy, sz_, x, y, zz) => piv.add(pudlo(sx, sy, sz_, STAL, x, y, zz));
    L(0.05, h - 0.01, 0.045, 0, h / 2, s * 0.0225); L(0.05, h - 0.01, 0.045, 0, h / 2, s * (w - 0.0225));
    L(0.05, 0.045, w, 0, h - 0.03, s * w / 2); L(0.05, 0.1, w, 0, 0.05, s * w / 2);
    for (const y of [0.69, 1.38, 2.07]) L(0.03, 0.02, w, 0, y, s * w / 2);
    L(0.03, h - 0.08, 0.02, 0, h / 2, s * w / 2);
    const sz2 = new T.Mesh(new T.PlaneGeometry(w, h - 0.08), szklo); sz2.rotation.y = Math.PI / 2; sz2.position.set(0, h / 2, s * w / 2); piv.add(sz2);
    const pr = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 1.1, 10), mosiadz); pr.position.set(-0.07, 1.15, s * (w - 0.09)); piv.add(pr);
    piv.userData.s = s; grupa.add(piv);
    return piv;
  });
  // przeszklenia sali: nadproża, parapety i słupki na stykach ze ścianami — ramy z Blendera nie domykały się z sufitem,
  // podłogą i ścianami, przez szczeliny prześwitywało miasto (kropkowane jasne linie). Współrzędne jak przeszklenie() w spacer.py.
  const RAMA = 0x0b0908, Hs = 3.6;
  for (const [x0, z0, x1, z1] of [[24.05, 0.2, 24.05, -16.2], [-0.2, -16.05, 13.0, -16.05], [19.5, 0.05, 24.2, 0.05]]) {
    const dl = Math.hypot(x1 - x0, z1 - z0), wzdluzX = Math.abs(x1 - x0) > 0.5, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const [sx, sz_] = wzdluzX ? [dl, 0.16] : [0.16, dl];
    grupa.add(pudlo(sx, 0.1, sz_, RAMA, cx, Hs - 0.04, cz), pudlo(sx, 0.08, sz_, RAMA, cx, 0.03, cz));
  }
  for (const [x, z] of [[13.0, -16.05], [19.5, 0.05], [24.05, 0.05], [24.05, -16.05], [0.0, -16.05]]) grupa.add(pudlo(0.16, Hs + 0.02, 0.16, RAMA, x, Hs / 2, z));
  scena.add(grupa);
  return {
    otworz(u) { for (const p of skrzydla) p.rotation.y = p.userData.s * u * Math.PI * 0.47; },   // 0 zamknięte, 1 = ~85° do sali
  };
}
