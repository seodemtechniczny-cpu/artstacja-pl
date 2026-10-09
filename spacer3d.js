// Spacer 3D (hero): sala z Blendera ze światłem wypieczonym w Cycles (atlasy, MeshBasicMaterial), żywe miasto (miasto.js),
// kamera z trasy z Blendera (narzedzia/spacer_3d.py). Nieskończony spacer kółkiem/palcem, klik w obraz = podjazd kamery
// i przybliżanie do faktury, tabliczki przy bliskich obrazach, lekki ruch kamery za kursorem. Postęp ładowania → ekran ładowania.
import * as T from './vendor/three.min.js';
import { utworzMiasto } from './miasto.js';
import { utworzPrzedsionek } from './przedsionek.js';
import { startPoza, SRODEK, SCIANA, OTWOR } from './przedsionek-dane.js';
import { utworzKurtyne, KURTYNA, LAMPA } from './kurtyna.js';

// obraz w scenie → plik i tytuł (kolejność obrazów ze spacer.py, wypisana przez narzedzia/spacer_ladowanie.py)
const TYTULY = ['Błękitny wieczór', 'Wiatr w grzywie', 'Spacer w błękicie', 'Cisza', 'Zatoka o zmierzchu', 'Deszcz w Paryżu', 'Pod złotym słońcem', 'Dwie strony'];   // robocze (09.10), do podmiany na tytuły Magdy — też index.html i narzedzia/buduj.mjs
const PLIK = { bar: 1, wneka_0: 2, wneka_1: 3, wneka_2: 4, sztaluga_0: 5, sztaluga_1: 6, oparty_1: 7, oparty_2: 8, kacik: 1, w1: 2, w2_pd: 3, w2_pn: 4 };

// próbkowanie wypieku: z bliska (teksel atlasu większy niż piksel) dwusześcienny B-spline z 4 próbek zamiast liniowego —
// plamy reflektorów i cienie bez schodków i bloków kompresji; z daleka zwykłe mipmapy
const BSPLINE = `vec4 wypiekProbka(sampler2D t, vec2 uv) {
  vec2 sz = vec2(textureSize(t, 0)), q = uv * sz, dx = dFdx(uv), dy = dFdy(uv);   // pochodne przed rozgałęzieniem:
  if (BEZ_BIK || max(length(dx * sz), length(dy * sz)) > 0.7) return textureGrad(t, uv, dx, dy);   // texture2D w gałęzi
  // brała zły poziom mipmapy tam, gdzie sąsiednie piksele szły drugą gałęzią — kropkowane linie na ścianach
  vec2 c = q - 0.5, i = floor(c), f = c - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (-f3 + 3.0 * f2 - 3.0 * f + 1.0) / 6.0, w1 = (3.0 * f3 - 6.0 * f2 + 4.0) / 6.0, w2 = (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0) / 6.0, w3 = f3 / 6.0;
  vec2 s0 = w0 + w1, s1 = w2 + w3, o0 = (i - 0.5 + w1 / s0) / sz, o1 = (i + 1.5 + w3 / s1) / sz;
  return mix(mix(textureLod(t, vec2(o1.x, o1.y), 0.0), textureLod(t, vec2(o0.x, o1.y), 0.0), s0.x),
             mix(textureLod(t, vec2(o1.x, o0.y), 0.0), textureLod(t, vec2(o0.x, o0.y), 0.0), s0.x), s0.y);
}`;
function przerobWypiek(mat, { wyciecia = [], barwy = [] }) {   // wycięcia (discard) i przebarwienia stref w świecie
  const v3 = a => `vec3(${a.map(x => x.toFixed(3)).join(',')})`, lin = h => { const c = new T.Color(h); return v3([c.r, c.g, c.b]); };
  const tnij = wyciecia.map(([a, b]) => `(all(greaterThan(vSwiat, ${v3(a)})) && all(lessThan(vSwiat, ${v3(b)})))`).join(' || ') || 'false';
  const barw = barwy.map(b => {
    const war = b.pud ? `all(greaterThan(vSwiat, ${v3(b.pud[0])})) && all(lessThan(vSwiat, ${v3(b.pud[1])}))`
      : `distance(vSwiat.xz, vec2(${b.wal[0].toFixed(3)}, ${b.wal[1].toFixed(3)})) < ${b.wal[2].toFixed(3)} && vSwiat.y > ${b.wal[3].toFixed(3)} && vSwiat.y < ${b.wal[4].toFixed(3)}`;
    // jasność wypieku ściśnięta łagodnie (plamy bez przepalenia) × nowy kolor × część barwy światła (ciepło 3000 K: zieleń
    // w plamie reflektora idzie w oliwkę, nie w neon)
    if (b.sciskanie) return `if (${war}) { float l = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-4); diffuseColor.rgb = ${lin(b.kolor)} * (1.0 - exp(-l * ${b.sciskanie.toFixed(1)})) * ${b.mnoz.toFixed(2)} * pow(diffuseColor.rgb / l, vec3(0.35)); }`;
    return b.albedo ? `if (${war}) diffuseColor.rgb *= ${lin(b.kolor)} / ${v3(b.albedo)} * ${b.moc.toFixed(3)};`
      : `if (${war}) diffuseColor.rgb = ${lin(b.kolor)} * dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * 2.2;`;
  }).join('\n  ');
  mat.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSwiat;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSwiat = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vSwiat;\n#define BEZ_BIK ${false}\n${BSPLINE}`)
      .replace('void main() {', `void main() {\n  if (${tnij}) discard;`)
      .replace('#include <map_fragment>', `diffuseColor *= wypiekProbka(map, vMapUv);\n  ${barw}`);
  };
  mat.customProgramCacheKey = () => tnij + barw;   // bez tego sala i meble (ta sama funkcja onBeforeCompile) dostawały
  // jeden wspólny program — przebarwienia i wycięcia jednego materiału trafiały do drugiego albo znikały
  mat.dithering = true;   // rozbija pasy 8-bitowych gradientów (plamy reflektorów)
  mat.needsUpdate = true;
}

export async function utworzSpacer({ kadr, postep, czyAktywny, podglad: ui, przerwa = async () => {}, wejscie = false }) {
  const cv = kadr.querySelector('canvas');
  const DIAG = false ? (window.__diag = []) : null;
  const EKRANOW = 10, maly = Math.min(screen.width, screen.height) < 900;
  const PROBA = '';   // diagnostyka potoku (np. ?diag&proba=bezaa)
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: !PROBA.includes('bezaa'), powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, maly ? 2 : 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;   // atlasy są już po AgX z Blendera
  const scena = new T.Scene(), kamera = new T.PerspectiveCamera(60, 16 / 9, 0.05, 4000);

  // ---------- ładowanie z prawdziwym postępem (bajty z fetch), dalej parsowanie z pamięci
  const pliki = { glb: 'scena/sala.glb', sala: `scena/atlas-sala${maly ? '-4k' : ''}.webp`, meble: `scena/atlas-meble${maly ? '-4k' : ''}.webp`, trasa: 'scena/trasa.json' };
  const WAGI = { glb: 5.0, sala: maly ? 0.2 : 0.65, meble: maly ? 0.75 : 1.5, trasa: 0.06 };   // MB, gdy serwer nie poda długości
  const pobrane = {}, razem = Object.values(WAGI).reduce((a, b) => a + b, 0) * 1e6;
  const zglos = () => postep(0.7 * Math.min(1, Object.values(pobrane).reduce((a, b) => a + b, 0) / razem));   // pobieranie = 70%, reszta: rozpakowanie i karta
  const pobierz = async (k) => {
    const r = await fetch(pliki[k]);
    const dl = +r.headers.get('content-length') || WAGI[k] * 1e6, czytnik = r.body.getReader(), kawalki = [];
    let n = 0;
    for (;;) { const { done, value } = await czytnik.read(); if (done) break; kawalki.push(value); n += value.length; pobrane[k] = n / dl * WAGI[k] * 1e6; zglos(); }
    return new Blob(kawalki);
  };
  // atlasy: pamięć karty rezerwowana na starcie, zanim ruszy rysunek wejścia (rezerwacja ~360 MB = gubiona klatka), potem
  // cały atlas jednym wywołaniem, gdy rysunek jedzie już na kompozytorze (wysyłka 8192² blokuje główny wątek ~1 s).
  // Własna tekstura WebGL (sRGB, niezmienna, z miejscem na mipmapy) podpięta jako ExternalTexture.
  const gl = renderer.getContext();
  const ATLAS = maly ? 4096 : 8192, miejsca = [0, 1].map(() => {
    const tex = gl.createTexture();
    renderer.state.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, Math.log2(ATLAS) + 1, gl.SRGB8_ALPHA8, ATLAS, ATLAS);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));   // pierwszy zapis teraz: sterownik zajmuje pamięć od razu
    return tex;
  });
  async function wgrajNaraz(blob, tex) {
    const bmp = await createImageBitmap(blob);
    renderer.state.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, bmp.width, bmp.height, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    bmp.close();
    return { tex };
  }
  function dokoncz({ tex }) {   // mipmapy i filtrowanie
    renderer.state.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, PROBA.includes('bezmip') ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = renderer.extensions.get('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, PROBA.includes('bezan') ? 1 : renderer.capabilities.getMaxAnisotropy());
    const t = new T.ExternalTexture(tex); t.colorSpace = T.SRGBColorSpace; t.flipY = false;   // UV glTF → bez odwracania
    return t;
  }
  // widoczność obrazów z każdej próbki trasy (promienie przez ściany policzone raz: window.__widocznosc w trybie ?diag)
  const widokP = fetch('scena/widocznosc.json').then(r => r.json()).catch(() => null);
  const [glbBlob, salaBlob, mebleBlob, trasaBlob] = await Promise.all(['glb', 'sala', 'meble', 'trasa'].map(pobierz));
  const widok = await widokP;
  const CZAS = (n) => DIAG && console.log('CZAS', n, Math.round(performance.now()));
  CZAS('pobrane');
  // rozpakowanie, wysyłka atlasów i kompilacja blokują główny wątek: ruszamy, gdy rysunek wejścia jedzie już na kompozytorze
  await przerwa();
  const atlasyP = Promise.all([wgrajNaraz(salaBlob, miejsca[0]), wgrajNaraz(mebleBlob, miejsca[1])]);
  const loader = new T.GLTFLoader().setDRACOLoader(new T.DRACOLoader().setDecoderPath('vendor/draco/'));
  const [gltf, trasa] = await Promise.all([loader.parseAsync(await glbBlob.arrayBuffer(), ''), trasaBlob.text().then(JSON.parse)]);
  const [atlasSala, atlasMeble] = (await atlasyP).map(dokoncz);
  CZAS('atlasy na karcie');

  CZAS('rozpakowane'); postep(0.82);
  const WYPIEK = { sala: new T.MeshBasicMaterial({ map: atlasSala }), meble: new T.MeshBasicMaterial({ map: atlasMeble }) };
  // wypiek przerabiany w shaderze (bez ponownego wypiekania w Blenderze): otwór drzwi z przedsionka, wypieczona kurtyna
  // (w jej miejscu ruchoma, kurtyna.js), a blat baru i hokery w barwach kontrastujących z jasną ladą — kolor docelowy ×
  // jasność wypieku, więc światło, cienie i plama reflektora zostają
  const OTW = [[SCIANA - 0.05, 0.01, OTWOR.z0], [0.03, OTWOR.h, OTWOR.z1]];
  przerobWypiek(WYPIEK.sala, { wyciecia: [OTW] });
  przerobWypiek(WYPIEK.meble, {
    wyciecia: [OTW, [[0.05, 0.0, KURTYNA.z0 - 0.05], [0.42, 3.62, KURTYNA.z1 + 0.05]],             // kurtyna
      [[LAMPA.x - 0.3, 0.035, LAMPA.z - 0.18], [LAMPA.x + 0.5, 1.75, LAMPA.z + 0.18]]],              // lampa przed sceną (ramię z kloszem w stronę sali; od 3,5 cm — dywan zostaje, stopę kryje podest)
    barwy: [
      { pud: [[2.85, 1.016, -2.70], [7.55, 1.09, -1.90]], kolor: '#2a1f19' },                                   // blat: ciemny kamień
      ...[3.8, 5.2, 6.6].map(x => ({ wal: [x, -3.0, 0.24, 0.7, 0.83], kolor: '#5a3620' })),                    // siedziska: orzech
      ...[3.8, 5.2, 6.6].map(x => ({ wal: [x, -3.0, 0.27, 0.035, 0.7], kolor: '#16110e' })),                   // nogi: czarna stal (nad dywanem)
    ],
  });
  const obrazy = [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.wypiek) { o.material = WYPIEK[o.userData.wypiek]; return; }
    if (o.userData.obraz) {
      o.material = new T.MeshBasicMaterial({ map: o.material.map });   // wypiek obrazu (1024 px, ze światłem reflektora)
      const id = o.name.replace(/^obraz_/, ''), nr = PLIK[id] || 1;
      o.userData.info = { id, nr, plik: `obrazy/p0${nr}-duzy.webp`, tytul: TYTULY[nr - 1] };
      obrazy.push(o);
      return;
    }
    const m = o.material;   // rośliny: światło na żywo; doniczka jednolita terakota
    o.material = /_pot(\.\d+)?$/.test(m.name) ? new T.MeshLambertMaterial({ color: 0x9a5a36 })
      : new T.MeshLambertMaterial({ map: m.map, color: m.color, alphaTest: 0.5, side: T.DoubleSide });
  });
  scena.add(gltf.scene, new T.HemisphereLight(0xffd6a8, 0x2a1d14, 1.4));
  const przedMiastem = scena.children.length;
  const miasto = utworzMiasto(scena);
  const miastoObj = scena.children.slice(przedMiastem);
  const przed = await utworzPrzedsionek(scena);
  const kurtyna = await utworzKurtyne(scena);
  obrazy.push(...kurtyna.karty);   // karty wydarzeń otwierają się w podglądzie jak obrazy

  // ---------- trasa i nieskończony spacer
  const P = trasa.probek, poz = trasa.poz, cel = trasa.cel, hfov = 2 * Math.atan(trasa.matryca_mm / 2 / trasa.obiektyw_mm);
  const a3 = new T.Vector3(), b3 = new T.Vector3(), spacerPoz = new T.Vector3(), spacerKw = new T.Quaternion();
  function ustawSpacer(f) {   // poza spaceru na trasie (bez ruchu za kursorem) → spacerPoz / spacerKw
    f = ((f % P) + P) % P;
    const i0 = Math.floor(f) % P, i1 = (i0 + 1) % P, u = f - Math.floor(f);
    a3.fromArray(poz, i0 * 3); b3.fromArray(poz, i1 * 3); spacerPoz.lerpVectors(a3, b3, u);
    a3.fromArray(cel, i0 * 3); b3.fromArray(cel, i1 * 3); a3.lerp(b3, u);
    kamera.position.copy(spacerPoz); kamera.lookAt(a3); spacerKw.copy(kamera.quaternion);
  }
  const startKw = new T.Quaternion();
  function ustawStart() {   // kamera w przedsionku, na osi drzwi (odległość zależy od proporcji ekranu)
    const s = startPoza(kamera.aspect);
    kamera.position.fromArray(s.poz); kamera.lookAt(...s.cel); startKw.copy(kamera.quaternion);
  }
  const gladko = t => t * t * t * (t * (t * 6 - 15) + 10);   // smootherstep: rusza i staje bez szarpnięcia
  let wej = null;
  function wejdz() {   // przejście z przedsionka przez drzwi do pierwszego kadru spaceru
    if (stan !== 'przedsionek') return Promise.resolve();
    ustawStart();
    const p0 = kamera.position.clone(), q0 = startKw.clone();
    ustawSpacer(0);
    const p3 = spacerPoz.clone(), q1 = spacerKw.clone();
    kamera.position.copy(p0); kamera.quaternion.copy(q0);
    const p = [p0, new T.Vector3(-0.6, 1.6, SRODEK), new T.Vector3(3.4, 1.6, SRODEK - 0.6), p3];
    const dl = 2.4 + p0.distanceTo(p3) * 0.22;
    stan = 'wejscie';
    return new Promise(r => { wej = { t0: performance.now(), dl, p, q0, q1, koniec: r }; });
  }
  let L = 9000;
  function mierz() {
    const W = kadr.clientWidth, H = kadr.clientHeight;
    L = Math.round(Math.max(7000, H * EKRANOW));
    renderer.setSize(W, H, false);
    kamera.aspect = W / H;
    kamera.fov = Math.min(80, Math.max(50, 2 * Math.atan(Math.tan(hfov / 2) / kamera.aspect) * 180 / Math.PI));
    kamera.updateProjectionMatrix();
  }
  let stan = wejscie ? 'przedsionek' : 'spacer';   // przedsionek | wejscie | spacer | dojazd | podglad | powrot
  const wSpacerze = () => czyAktywny() && stan === 'spacer';
  let doCelu = 0, droga = 0, f = 0, ostatni = 0;
  const MNOZNIK = 0.5, DROGA = 4, DOCIAG = 11;
  addEventListener('wheel', e => {
    if (!czyAktywny() || e.ctrlKey) return;
    if (stan === 'podglad') { e.preventDefault(); zoomCel = Math.min(1, Math.max(0, zoomCel - e.deltaY * 0.0012)); celZoomu(e); return; }
    if (stan !== 'spacer') { e.preventDefault(); return; }
    e.preventDefault();
    doCelu += (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * MNOZNIK;
  }, { passive: false });
  let dotyk = null, szczyp = null;
  kadr.addEventListener('touchstart', e => {
    dotyk = e.touches[0].clientY;
    szczyp = e.touches.length === 2 ? Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) : null;
  }, { passive: true });
  kadr.addEventListener('touchmove', e => {
    if (!czyAktywny()) return;
    e.preventDefault();
    if (stan === 'podglad' && e.touches.length === 2 && szczyp) {   // szczypanie = przybliżanie
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomCel = Math.min(1, Math.max(0, zoomCel + (d - szczyp) * 0.004)); szczyp = d;
      celZoomu({ clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2, clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2 });
      return;
    }
    if (stan !== 'spacer' || dotyk === null) return;
    const y = e.touches[0].clientY; doCelu += (dotyk - y) * 1.6; dotyk = y;
  }, { passive: false });
  kadr.addEventListener('touchend', () => { dotyk = null; szczyp = null; });
  addEventListener('keydown', e => {
    if (!wSpacerze() || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); doCelu += (e.key === 'ArrowDown' ? 1 : -1) * innerHeight * 0.25; }
  });

  // ---------- kursor: wskazanie obrazu (raycasting), lekki ruch kamery za kursorem
  const ray = new T.Raycaster(), wsk = new T.Vector2(), mysz = { x: 0, y: 0, gx: 0, gy: 0 };
  let nadObrazem = null, wskazNowe = false, wcisk = null;
  // podgląd: przeciąganie obraca kamerę wokół obrazu (widać bok płótna i grubość farby na krawędzi)
  let obrotCel = 0, obrot = 0, ciag = null;
  kadr.addEventListener('pointermove', e => {
    if (stan === 'podglad' && ciag && e.buttons) { obrotCel = Math.max(-0.75, Math.min(0.75, ciag[1] + (e.clientX - ciag[0]) / innerWidth * 2.2)); }
    wsk.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); wskazNowe = true;
    if (e.pointerType === 'mouse') { mysz.x = wsk.x; mysz.y = wsk.y; }
    ui.kursor(e.clientX, e.clientY);
  });
  kadr.addEventListener('pointerleave', () => { nadObrazem = null; ui.kursorNad(null); kadr.style.cursor = ''; });
  const trafiony = () => {   // karty wydarzeń za zasuniętą kurtyną nie łapią kliknięć
    ray.setFromCamera(wsk, kamera);
    return ray.intersectObjects(obrazy, false).find(h => !h.object.userData.karta || h.object === otwarty || kurtyna.otwarta()) || null;
  };
  kadr.addEventListener('pointerdown', e => { wcisk = e.target === cv ? [e.clientX, e.clientY] : null; ciag = wcisk && stan === 'podglad' ? [e.clientX, obrotCel] : null; });   // tylko klik w scenę, nie w napisy i przyciski
  kadr.addEventListener('pointerup', e => {
    if (!wcisk || Math.hypot(e.clientX - wcisk[0], e.clientY - wcisk[1]) > 6 || !czyAktywny()) return;
    wsk.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const h = trafiony();
    if (stan === 'spacer' && h) otworz(h.object, true);
    else if (stan === 'podglad' && (!h || h.object !== otwarty)) zamknij(true);
  });

  // ---------- podgląd obrazu: podjazd, przybliżanie, powrót
  let otwarty = null, ruch = null, zoom = 0, zoomCel = 0;
  const podPoz = new T.Vector3(), podKw = new T.Quaternion(), srodek = new T.Vector3(), normalna = new T.Vector3(), punktZoomu = new T.Vector3();
  let odlBazowa = 2, odlMin = 0.35;
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function pozaPodgladu(o) {
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    bb.getCenter(srodek); o.localToWorld(srodek);
    const nrm = o.geometry.attributes.normal;
    normalna.fromBufferAttribute(nrm, 0).applyNormalMatrix(new T.Matrix3().getNormalMatrix(o.matrixWorld)).normalize();
    if (normalna.dot(a3.subVectors(kamera.position, srodek)) < 0) normalna.negate();
    const rozm = new T.Vector3(); bb.getSize(rozm); rozm.multiply(o.getWorldScale(new T.Vector3()));
    const wymiary = [rozm.x, rozm.y, rozm.z].sort((a, b) => b - a), h = wymiary[0], w = wymiary[1];   // płaski obraz: dwa największe wymiary
    const tv = Math.tan(kamera.fov * Math.PI / 360), th = tv * kamera.aspect;
    odlBazowa = Math.max(h * 0.62 / tv, w * 0.62 / th); odlMin = Math.max(0.18, odlBazowa * 0.16);
    podPoz.copy(srodek).addScaledVector(normalna, odlBazowa);
    const m = new T.Matrix4().lookAt(podPoz, srodek, new T.Vector3(0, 1, 0)); podKw.setFromRotationMatrix(m);
  }
  function otworz(o, historia) {
    if (stan !== 'spacer') return;
    otwarty = o; pozaPodgladu(o); zoom = zoomCel = 0; obrot = obrotCel = 0; punktZoomu.copy(srodek);
    ruch = { od: kamera.position.clone(), odKw: kamera.quaternion.clone(), doP: podPoz.clone(), doKw: podKw.clone(), t0: performance.now(), dl: 1300, potem: 'podglad' };
    stan = 'dojazd'; ui.kursorNad(null);
    ui.otworz(o.userData.info);
    if (historia) history.pushState({ podglad: o.userData.info.id }, '', `#/obraz/${o.userData.info.id}`);
    ostrzObraz(o);
  }
  function zamknij(historia) {
    if (stan !== 'podglad' && stan !== 'dojazd') return;
    // pozycja startowa PRZED liczeniem pozy na trasie: ustawSpacer przestawia kamerę, więc wcześniej powrót był skokiem
    const od = kamera.position.clone(), odKw = kamera.quaternion.clone();
    ustawSpacer(f);
    kamera.position.copy(od); kamera.quaternion.copy(odKw);
    ruch = { od, odKw, doP: spacerPoz.clone(), doKw: spacerKw.clone(), t0: performance.now(), dl: 1400, potem: 'spacer' };
    stan = 'powrot'; ui.zamknij(); obrotCel = 0;
    if (historia && history.state && history.state.podglad) history.back();
  }
  function celZoomu(e) {   // przybliżanie w stronę punktu obrazu pod kursorem
    wsk.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const h = trafiony();
    if (h && h.object === otwarty) punktZoomu.lerp(h.point, zoom < 0.05 ? 1 : 0.35);
  }
  // ostra wersja obrazu: oryginał w pełnej rozdzielczości × barwa z wypieku w dużej skali (stosunek rozmytych kolorów, kanał
  // po kanale, w tej samej skali ~128 px) — faktura farby z oryginału, a ciepło reflektora i tonowanie AgX z renderu,
  // więc obraz po przybliżeniu ma tę samą barwę co w spacerze (sam stosunek jasności gubił odcień: obraz zmieniał barwę)
  // tylko dla otwartego obrazu: 12 ostrych tekstur naraz obciążało WebKit na telefonie (30 kl./s na całej stronie)
  async function ostrzObraz(o) {
    if (o.userData.ostry || !o.userData.info.plik) return;   // karta wydarzenia: tekstura już ostra
    o.userData.ostry = 'laduje';
    const t = await new T.TextureLoader().loadAsync(o.userData.info.plik);
    if (otwarty !== o) { t.dispose(); o.userData.ostry = null; return; }   // zamknięty, zanim doszedł
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const wypiekMat = o.material, wyp = wypiekMat.map;
    o.material = new T.ShaderMaterial({
      uniforms: { ostry: { value: t }, wypiek: { value: wyp } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D ostry; uniform sampler2D wypiek; varying vec2 vUv;
        void main(){
          vec2 uo = vec2(vUv.x, 1.0 - vUv.y);
          vec3 o = texture2D(ostry, uo).rgb;
          float lw = log2(float(textureSize(wypiek, 0).y) / 128.0), lo = log2(float(textureSize(ostry, 0).y) / 128.0);
          vec3 barwa = textureLod(wypiek, vUv, lw).rgb / max(textureLod(ostry, uo, lo).rgb, vec3(0.02));
          gl_FragColor = vec4(o * clamp(barwa, 0.0, 3.0), 1.0);
          #include <colorspace_fragment>
        }`,   // tekstury sRGB próbkowane liniowo: bez tego wyjście było ciemne i przesycone
    });
    o.userData.wypiekMat = wypiekMat; o.userData.ostry = t;
  }
  function stepObraz(o) {   // po wyjściu z podglądu: z powrotem wypiek, ostra tekstura zwolniona z karty
    if (!(o.userData.ostry instanceof T.Texture)) return;
    o.material.dispose(); o.userData.ostry.dispose();
    o.material = o.userData.wypiekMat; o.userData.ostry = null;
  }

  // ---------- tabliczki przy bliskich obrazach (do 2 naraz) i pętla
  const tmp = new T.Vector3(), kier = new T.Vector3(), OS_Y = new T.Vector3(0, 1, 0);
  function tabliczki() {
    if (stan !== 'spacer') { ui.tabliczki([]); return; }
    kamera.getWorldDirection(kier);
    const lista = [], probka = Math.round(((f % P) + P) % P) % P;
    for (const o of obrazy) {
      if (widok && widok[o.userData.info.id]?.[probka] !== '1') continue;   // zasłonięty ścianą z tego miejsca trasy
      o.getWorldPosition(tmp);
      const d = tmp.distanceTo(kamera.position);
      if (d > 4.8) continue;
      if (kier.dot(a3.subVectors(tmp, kamera.position).normalize()) < 0.55) continue;
      o.geometry.computeBoundingBox();
      const dol = o.geometry.boundingBox; tmp.set((dol.min.x + dol.max.x) / 2, dol.min.y, (dol.min.z + dol.max.z) / 2); o.localToWorld(tmp);
      tmp.project(kamera);
      if (Math.abs(tmp.x) > 0.9 || tmp.y < -0.85 || tmp.y > 0.9) continue;
      lista.push({ id: o.userData.info.id, tytul: o.userData.info.tytul, podpis: o.userData.info.podpis, x: (tmp.x + 1) / 2 * innerWidth, y: (1 - tmp.y) / 2 * innerHeight, d });
    }
    lista.sort((a, b) => a.d - b.d);
    const [t1, t2] = lista;   // dwie tabliczki nie mogą na siebie nachodzić: wtedy tylko bliższy obraz
    ui.tabliczki(t2 && Math.abs(t1.x - t2.x) < 240 && Math.abs(t1.y - t2.y) < 56 ? [t1] : lista.slice(0, 2));
  }
  function klatka(teraz) {
    const dt = Math.min(0.05, (teraz - (ostatni || teraz)) / 1000); ostatni = teraz;
    droga += (doCelu - droga) * (1 - Math.exp(-dt * DROGA));
    f += (droga / L * P - f) * (1 - Math.exp(-dt * DOCIAG));
    if (stan === 'spacer') {
      ustawSpacer(f);
      mysz.gx += (mysz.x - mysz.gx) * (1 - Math.exp(-dt * 3)); mysz.gy += (mysz.y - mysz.gy) * (1 - Math.exp(-dt * 3));
      kamera.rotateY(-mysz.gx * 0.035); kamera.rotateX(mysz.gy * 0.02);   // ~2° w bok, ~1° w pion za kursorem
      if (wskazNowe) {
        wskazNowe = false;
        const h = trafiony(), o = h && h.object;
        if (o !== nadObrazem) { nadObrazem = o; ui.kursorNad(o ? o.userData.info : null); kadr.style.cursor = o ? 'pointer' : ''; }
      }
    } else if (stan === 'przedsionek') {
      ustawStart();
    } else if (stan === 'wejscie') {
      const u = (teraz - wej.t0) / 1000, k = Math.min(1, Math.max(0, (u - 0.5) / wej.dl)), e = gladko(k);
      przed.otworz(easeInOut(Math.min(1, u / 1.6)));
      const m = 1 - e;   // krzywa Béziera: prosto przez drzwi, potem łuk w prawo do baru
      kamera.position.set(0, 0, 0).addScaledVector(wej.p[0], m * m * m).addScaledVector(wej.p[1], 3 * m * m * e).addScaledVector(wej.p[2], 3 * m * e * e).addScaledVector(wej.p[3], e * e * e);
      kamera.quaternion.slerpQuaternions(wej.q0, wej.q1, gladko(Math.min(1, Math.max(0, (e - 0.3) / 0.7))));   // obrót głowy po przejściu progu
      if (k >= 1) { stan = 'spacer'; f = doCelu = droga = 0; mysz.gx = mysz.gy = 0; wej.koniec(); wej = null; }
    } else if (ruch) {
      const u = Math.min(1, (teraz - ruch.t0) / ruch.dl), e = easeInOut(u);
      kamera.position.lerpVectors(ruch.od, ruch.doP, e); kamera.quaternion.slerpQuaternions(ruch.odKw, ruch.doKw, e);
      if (u >= 1) { stan = ruch.potem; ruch = null; if (stan === 'spacer' && otwarty) { stepObraz(otwarty); otwarty = null; mysz.gx = mysz.gy = 0; } }   // ruch za kursorem narasta od zera, bez doskoku
    } else if (stan === 'podglad') {
      zoom += (zoomCel - zoom) * (1 - Math.exp(-dt * 7));
      const odl = odlBazowa + (odlMin - odlBazowa) * zoom;
      obrot += (obrotCel - obrot) * (1 - Math.exp(-dt * 6));
      tmp.copy(srodek).lerp(punktZoomu, zoom);
      kier.copy(normalna).applyAxisAngle(OS_Y, obrot);
      kamera.position.copy(tmp).addScaledVector(kier, odl);
      kamera.lookAt(tmp);
    }
    tabliczki();
    kurtyna.aktualizuj(dt, kamera);
    miasto.aktualizuj(teraz / 1000, kamera);
    const t0 = performance.now();
    renderer.render(scena, kamera);
    if (DIAG) DIAG.push([performance.now() - t0, Math.round(((f % P) + P) % P)]);
  }
  let widac = true;
  const petla = () => renderer.setAnimationLoop(widac && document.visibilityState === 'visible' ? klatka : null);
  new IntersectionObserver(([e]) => { widac = e.isIntersecting; ostatni = 0; petla(); }).observe(kadr);
  document.addEventListener('visibilitychange', () => { ostatni = 0; petla(); });
  addEventListener('resize', mierz);
  postep(0.9);
  CZAS('przed kompilacją');
  scena.traverse(o => { if (o.isMesh && o.material.map) renderer.initTexture(o.material.map); });
  CZAS('tekstury na karcie');
  await renderer.compileAsync(scena, kamera);
  CZAS('skompilowane');
  mierz(); if (stan === 'przedsionek') ustawStart(); else ustawSpacer(0); klatka(performance.now()); CZAS('pierwsza klatka'); petla();
  postep(1);

  if (DIAG) { window.__f = () => f; window.__ptaki = () => {
    if (!miasto.ptaki.visible) return null;
    const m = new T.Matrix4(), v = new T.Vector3(); miasto.ptaki.getMatrixAt(0, m); v.setFromMatrixPosition(m).project(kamera);
    return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight), +v.z.toFixed(3)];
  }; window.__obrazy = () => obrazy.map(o => { o.getWorldPosition(tmp); tmp.project(kamera); return [o.userData.info.id, Math.round((tmp.x + 1) / 2 * innerWidth), Math.round((1 - tmp.y) / 2 * innerHeight), +tmp.z.toFixed(3)]; }); window.__stan = () => [stan, +zoom.toFixed(2)]; window.__szczeliny = () => { scena.background = new T.Color(1, 0, 1); for (const o of miastoObj) o.visible = false; }; window.__gdzie = pts => { const r = new T.Raycaster(), v = new T.Vector2(), wyn = []; gltf.scene.updateMatrixWorld(); for (const [x, y] of pts) { let best = null; for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) { v.set((x + dx) / innerWidth * 2 - 1, -((y + dy) / innerHeight) * 2 + 1); r.setFromCamera(v, kamera); const h = r.intersectObject(gltf.scene, true)[0]; if (h && (!best || h.distance < best.distance)) best = h; } if (best) wyn.push([...best.point.toArray().map(q => +q.toFixed(2)), best.object.userData.wypiek, best.uv ? +best.uv.x.toFixed(5) : null, best.uv ? +best.uv.y.toFixed(5) : null]); } return wyn; }; window.__obrot = (y, x) => { mysz.x = y; mysz.y = x; mysz.gx = y; mysz.gy = x; }; window.__idzDo = n => { f = n; droga = doCelu = n / P * L; }; window.__zamien = () => { const o = otwarty; if (!o?.userData.wypiekMat) return false; const m = o.material; o.material = o.userData.wypiekMat; o.userData.wypiekMat = m; return true; }; window.__poza = (p, c, fov) => { stan = 'diag'; kamera.position.set(...p); kamera.lookAt(...c); if (fov) { kamera.fov = fov; kamera.updateProjectionMatrix(); } }; window.__kam = () => kamera.position.toArray(); window.__doSpaceru = () => { stan = 'spacer'; }; window.__widocznosc = () => {   // narzędzie: widoczność obrazów z każdej próbki trasy → scena/widocznosc.json
      const sciany = []; gltf.scene.traverse(o => { if (o.isMesh && o.userData.wypiek) sciany.push(o); });
      const r = new T.Raycaster(), c = new T.Vector3(), k = new T.Vector3(), wyn = {};
      for (const o of obrazy) {
        o.geometry.computeBoundingBox(); o.geometry.boundingBox.getCenter(c); o.localToWorld(c);
        let s = '';
        for (let i = 0; i < P; i++) {
          k.fromArray(poz, i * 3); const d = c.distanceTo(k);
          if (d > 5) { s += '0'; continue; }
          r.set(k, c.clone().sub(k).normalize()); r.far = d - 0.06;
          s += r.intersectObjects(sciany, false).length ? '0' : '1';
        }
        wyn[o.userData.info.id] = s;
      }
      return wyn;
    };
    window.__rogiObrazu = id => {   // rogi w świecie wg UV obrazu: LG (0,0), PG (1,0), PD (1,1), LD (0,1) — dla ekranu ładowania
      const o = obrazy.find(x => x.userData.info.id === id), g = o.geometry, uv = g.attributes.uv, poz = g.attributes.position;
      return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => { let best = 0, bd = 9; for (let i = 0; i < uv.count; i++) { const d = Math.hypot(uv.getX(i) - u, uv.getY(i) - v); if (d < bd) { bd = d; best = i; } } return new T.Vector3().fromBufferAttribute(poz, best).applyMatrix4(o.matrixWorld).toArray().map(x => +x.toFixed(4)); });
    }; }
  return {
    idz: px => { doCelu += px; },
    otworzId: (id, historia = false) => { const o = obrazy.find(x => x.userData.info.id === id); if (o) otworz(o, historia); },
    zamknij: () => zamknij(false),
    stan: () => stan,
    wejdz,
  };
}
