// Ekran wejścia: w trakcie ładowania kadr przedsionka rysuje się kreską (krawędzie, drzwi, obrazy jako szkic ołówkiem)
// dokładnie w miejscach, w których stoją w 3D, a obrazy szkicują się ołówkiem i malują pędzlem. Gotowa scena: rysunek
// ustępuje od drzwi na boki i zostaje ten sam kadr w 3D. Klik/Enter: drzwi się otwierają, kamera wchodzi do sali i kończy w pierwszym kadrze spaceru.
import { OBRAZY, OTWOR, SCIANA, SRODEK, startPoza, pionowyKat, linie } from './przedsionek-dane.js';

const el = document.getElementById('wejscie'), napis = document.getElementById('kliknij');
const ROOT = new URL('./', document.baseURI).pathname;   // '/' na domenie (<base href="/">), katalog projektu w podglądzie
const naStarcie = [ROOT, ROOT + 'index.html'].includes(location.pathname) && !location.hash;   // tylko wejście na stronę główną
if (!naStarcie || matchMedia('(prefers-reduced-motion: reduce)').matches || !document.createElement('canvas').getContext('webgl2')) { el.remove(); napis.remove(); }
else {
  document.body.classList.add('przed-wejsciem');
  const W = innerWidth, H = innerHeight, asp = W / H, px = v => Math.round(v * 10) / 10;
  const { poz: POZ, cel: CEL } = startPoza(asp), tv = Math.tan(pionowyKat(asp) * Math.PI / 360);
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const przod = norm(sub(CEL, POZ)), prawo = norm(cross(przod, [0, 1, 0])), gora = cross(prawo, przod);
  const rzut = X => { const d = sub(X, POZ), z = dot(d, przod); return [(dot(d, prawo) / (z * tv * asp) + 1) / 2 * W, (1 - dot(d, gora) / (z * tv)) / 2 * H]; };

  // Cały rysunek to przejścia transform (kompozytor): kreski skalowane od zera, szkic i kolor obrazów odsłaniane oknem
  // przesuwanym w bok. Kompozytor animuje je dalej, gdy główny wątek liczy scenę 3D, więc scena przygotowuje się
  // w trakcie rysowania, a kolor wchodzi zaraz po ostatniej kresce (wcześniej SVG + maski z filtrem: główny wątek).
  // treść rysunku w jednej warstwie; na odsłonięcie powstają z niej dwie połówki (kurtyna od osi drzwi na boki),
  // dlatego cały ruch steruje klasa na .wejscie i zmienne CSS w stylach elementów (kopia ma je w sobie)
  const L = linie(POZ[0]), tresc = document.createElement('div');
  tresc.className = 'we-tresc'; tresc.style.cssText = `width:${W}px;height:${H}px`;
  tresc.append(el.querySelector('.we-prog'));
  const kresl = (lista, od, krok, klasa = '') => lista.forEach(([a, b], i) => {
    const [x0, y0] = rzut(a), [x1, y1] = rzut(b);
    const k = document.createElement('i');
    k.className = 'we-l ' + klasa;
    k.style.cssText = `left:${px(x0)}px;top:${px(y0)}px;width:${px(Math.hypot(x1 - x0, y1 - y0))}px;--a:${Math.atan2(y1 - y0, x1 - x0)}rad;transition-delay:${od + i * krok}ms`;
    tresc.append(k);
  });
  kresl(L.sala, 0, 40);
  kresl(L.drzwi.slice(0, 3), 250, 60);
  kresl(L.drzwi.slice(3), 420, 18, 'r');
  kresl(L.obrazy, 560, 40);

  // obrazy na płótnie (homografia z rzutu rogów): szkic ołówkiem odsłaniany pięcioma pasami od lewej (jak kreślenie
  // wiersz po wierszu), potem kolor czterema pociągnięciami pędzla na zmianę w prawo i w lewo, z postrzępionym czołem
  const homografia = (q, A, B) => {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const det = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
    const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
    return `matrix3d(${a / A},${c / A},0,${g / A},${b / B},${e / B},0,${h / B},0,0,1,0,${x0},${y0},0,1)`;
  };
  // czoło pędzla: maska z poszarpaną krawędzią (stała; przesuwa się razem z oknem)
  const czolo = (strona) => {
    let d = 'M0 0', n = 14;
    for (let j = 0; j <= n; j++) d += `L${(strona > 0 ? 100 - (j % 2 ? 9 : 2) - Math.random() * 6 : (j % 2 ? 9 : 2) + Math.random() * 6).toFixed(1)} ${(j / n * 100).toFixed(1)}`;
    d = strona > 0 ? `M0 0${d.slice(4)}L0 100Z` : `M100 0${d.slice(4)}L100 100Z`;
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${d}'/></svg>`)}")`;
  };
  const MASKA = [czolo(1), czolo(-1)];
  const okno = (rodzic, src, B, y, h, strona, opozn, czas, maska) => {   // pas obrazu odsłaniany przesuwanym oknem
    const o = document.createElement('div'), w = document.createElement('div');
    o.className = 'we-okno'; w.className = 'we-okno-w';
    o.style.cssText = `left:${strona > 0 ? 0 : -16}px;top:${y}px;height:${h}px;--k:${strona};transition-duration:${czas}ms;transition-delay:${opozn}ms` + (maska ? `;mask-image:${maska};-webkit-mask-image:${maska}` : '');
    w.style.cssText = `transition-duration:${czas}ms;transition-delay:${opozn}ms`;
    w.innerHTML = `<img alt="" crossorigin="anonymous" src="${src}" style="left:${strona > 0 ? 0 : 16}px;top:${-y}px;height:${B}px">`;   // okno 116 px: poszarpane czoło kończy poza płótnem
    o.append(w); rodzic.append(o);
  };
  OBRAZY.forEach((ob, i) => {
    const w = ob.h * ob.prop, B = Math.round(100 / ob.prop), y0 = ob.y - ob.h / 2, y1 = ob.y + ob.h / 2, za = ob.z - w / 2, zb = ob.z + w / 2;
    const q = [[SCIANA, y1, za], [SCIANA, y1, zb], [SCIANA, y0, zb], [SCIANA, y0, za]].map(rzut);
    const div = document.createElement('div');
    div.className = 'we-szkic';
    div.style.cssText = `width:100px;height:${B}px;transform:${homografia(q, 100, B)}`;
    for (let k = 0; k < 5; k++) okno(div, ob.szkic, B, Math.round(k * B / 5), Math.ceil(B / 5) + 1, 1, 650 + i * 120 + k * 110, 380);
    for (let k = 0; k < 4; k++) { const s = k % 2 ? -1 : 1; okno(div, ob.plik, B, Math.round(k * B / 4), Math.ceil(B / 4) + 1, s, 1350 + i * 140 + k * 170, 460, MASKA[s > 0 ? 0 : 1]); }
    tresc.append(div);
  });

  // postęp = kreska progu pod drzwiami; napis „Kliknij” na drzwiach
  const [pa, pb] = [rzut([SCIANA, 0, OTWOR.z0]), rzut([SCIANA, 0, OTWOR.z1])];
  const prog = tresc.querySelector('.we-prog');
  Object.assign(prog.style, { left: px(pa[0]) + 'px', top: px(pa[1] - 1) + 'px', width: px(pb[0] - pa[0]) + 'px' });
  const [nx, ny] = rzut([SCIANA - 0.75, 0, SRODEK]);   // na podłodze przed progiem, nie na szkle i uchwytach
  Object.assign(napis.style, { left: px(nx) + 'px', top: px(ny) + 'px' });
  // otwór drzwi na ekranie: od niego rysunek ustępuje rzeczywistości
  const g0 = rzut([SCIANA, OTWOR.h, OTWOR.z0]), g1 = rzut([SCIANA, OTWOR.h, OTWOR.z1]);
  const otw = [g0[0], g0[1], g1[0], pb[1]];

  const czekaj = ms => new Promise(r => setTimeout(r, ms));
  let postepNa = 0, pokazany = false;
  const pasek = v => { el.style.setProperty('--p', v); };
  let ruszyl; const rysuje = new Promise(r => { ruszyl = r; });
  const wstep = (async () => {
    await czekaj(180);                                                // kreska rusza po starcie strony (parsowanie skryptów), bez czekania na obrazy
    el.classList.add('rysuj');
    const t0 = performance.now(), doCzasu = ms => czekaj(Math.max(0, t0 + ms - performance.now()));   // terminy od startu rysunku:
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));               // zwykłe odliczanie spóźniało się
    ruszyl();                                                         // o blokady głównego wątku (scena liczy się w tym czasie)
    await doCzasu(900); pokazany = true; pasek(postepNa);
    await doCzasu(1900);                                              // ostatnie pociągnięcia pędzla jeszcze jadą: kurtyna od środka na zakładkę
  })();
  let poWstepie = false; wstep.then(() => { poWstepie = true; });
  // dwie połówki rysunku rozdzielone na osi drzwi (kopia treści po prawej)
  const cx = Math.round((otw[0] + otw[2]) / 2);
  el.style.cssText = `--cx:${cx}px;--s:${Math.max(cx, W - cx) + 4}px`;
  const lewa = document.createElement('div'), prawa = document.createElement('div');
  lewa.className = 'we-pol l'; prawa.className = 'we-pol p';
  prawa.append(tresc.cloneNode(true)); lewa.append(tresc);
  el.append(lewa, prawa);

  window.__ladowanie = {
    postep(pr) { postepNa = Math.max(postepNa, Math.min(1, pr / 0.7)); if (pokazany && pr <= 0.7) pasek(postepNa); },   // tylko pobieranie; dalej kadr stoi
    przerwa() { return rysuje; },   // ciężka praca sceny w trakcie rysunku (animacje na kompozytorze)
    async koniec(spacer) {
      const spoznona = poWstepie;                                     // scena gotowa dopiero po rysunku: pierwsze klatki pod nim
      pasek(1);
      await wstep;
      if (spoznona) await czekaj(220);
      // klik/Enter liczy się od początku odsłaniania; wejście rusza, gdy rysunek zejdzie
      let klik; const klikniety = new Promise(r => { klik = r; });
      const idz = e => { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; if (e.type === 'keydown') e.preventDefault(); removeEventListener('keydown', idz); document.querySelector('.kadr').removeEventListener('click', idz); klik(); };
      addEventListener('keydown', idz); document.querySelector('.kadr').addEventListener('click', idz);
      window.__wejscieGotowe = performance.now();
      // rysunek rozsuwa się od osi drzwi na boki (jak kurtyna), pod nim ten sam kadr w 3D — sam transform, kompozytor
      el.classList.add('odslon');
      await czekaj(1150);
      el.remove();
      napis.classList.add('widac');
      await klikniety;
      napis.classList.remove('widac');
      setTimeout(() => napis.remove(), 850);   // po schowaniu precz (napis jest przypięty do ekranu — szedł z kamerą do sali)
      await spacer.wejdz();
      document.body.classList.remove('przed-wejsciem');
    },
  };
}
