// Rekwizyty 3D w zakładkach (modele z narzedzia/rekwizyty.py): sztaluga „lira” w Zajęciach — przewijanie obraca ją i maluje płótno
// etapami (puste → podmalówka → kolor → faktura, jak kroki w tekście; kolejny etap kładzie się pasami pędzla, bez
// przenikania); paleta w O mnie — przewijanie ją przechyla i obraca, pędzel rozciera farbę. Jeden renderer WebGL
// przenoszony do kontenera aktywnej zakładki; światło na żywo (małe modele), odbicia z otoczenia budowanego w kodzie.
import * as T from './vendor/three.min.js';

const gladko = t => t * t * (3 - 2 * t), zakres = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));

function otoczenie(renderer) {   // ciepłe panele światła i chłodne tło — odbicia w mosiądzu i lakierze farby
  const s = new T.Scene(); s.background = new T.Color(0x0d1220);
  const panel = (w, h, kol, sila, poz, cel) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(kol).multiplyScalar(sila), side: T.DoubleSide }));
    m.position.set(...poz); m.lookAt(...cel); s.add(m);
  };
  panel(4, 2, 0xffc890, 6, [-3, 4, 3], [0, 0, 0]);
  panel(6, 1, 0xffe0bc, 2.5, [0, 6, 0], [0, 0, 0]);
  panel(3, 3, 0x6f86c0, 1.2, [4, 1, -3], [0, 0, 0]);
  const pm = new T.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.04).texture; pm.dispose();
  return tex;
}
function cien(r) {   // miękki cień kontaktowy (gradient na płaszczyźnie)
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}
function swiatla(scena) {
  scena.add(new T.HemisphereLight(0xffe2c4, 0x1b2238, 0.55));
  const klucz = new T.DirectionalLight(0xffdcb4, 2.6); klucz.position.set(-2.5, 4, 3.5); scena.add(klucz);
  const kontra = new T.DirectionalLight(0x8fa6d8, 0.9); kontra.position.set(3, 2, -3); scena.add(kontra);
}

// płótno: cztery etapy z maską pasów pędzla (pas po pasie, na zmianę w lewo i w prawo, poszarpany brzeg)
function materialPlotna(tex) {
  const m = new T.MeshStandardMaterial({ map: tex[2], roughness: 0.85 });
  m.userData.etap = { value: 0 };
  m.onBeforeCompile = s => {
    s.uniforms.uEtap = m.userData.etap; s.uniforms.uE1 = { value: tex[0] }; s.uniforms.uE2 = { value: tex[1] };
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEtap; uniform sampler2D uE1; uniform sampler2D uE2;')
      .replace('#include <map_fragment>', `
        vec2 uv = vMapUv;
        vec3 st[4];
        st[0] = vec3(0.80, 0.75, 0.64);                       // puste płótno (zagruntowany len)
        st[1] = texture2D(uE1, uv).rgb; st[2] = texture2D(uE2, uv).rgb; st[3] = texture2D(map, uv).rgb;
        float pas = floor(uv.y * 7.0), x = mod(pas, 2.0) < 1.0 ? uv.x : 1.0 - uv.x;
        float brzeg = fract(sin(dot(floor(uv * vec2(90.0, 7.0)), vec2(12.9898, 78.233))) * 43758.5453) * 0.05 + sin(uv.y * 160.0) * 0.012;
        float kolej = (6.0 - pas + x) / 7.4 + brzeg;           // kolejność kładzenia farby w obrębie etapu (od góry)
        float k = min(floor(uEtap), 2.0), f = uEtap - k;
        int ki = int(k);
        vec3 a = ki == 0 ? st[0] : ki == 1 ? st[1] : st[2], b = ki == 0 ? st[1] : ki == 1 ? st[2] : st[3];
        float w = fwidth(kolej) * 1.5;
        diffuseColor.rgb *= mix(a, b, 1.0 - smoothstep(f - w, f + w, kolej));   // twardy, wygładzony brzeg pasa`);
  };
  return m;
}

export async function utworzRekwizyty({ aktywna }) {
  const kontenery = [...document.querySelectorAll('[data-3d]')];
  if (!kontenery.length) return;
  const ruchOgr = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.AgXToneMapping; renderer.toneMappingExposure = 1.35;   // AgX: drewno bez przepalonej pomarańczy (ACES)
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  const env = otoczenie(renderer);
  const loader = new T.GLTFLoader().setDRACOLoader(new T.DRACOLoader().setDecoderPath('vendor/draco/'));
  const tl = new T.TextureLoader(), wczytaj = u => tl.loadAsync(u).then(t => { t.colorSpace = T.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; return t; });

  const SCENY = {
    async sztaluga(el) {
      const [g, ...etapy] = await Promise.all([loader.loadAsync('rekwizyty/sztaluga.glb'), ...[1, 2, 3].map(i => wczytaj(`rekwizyty/etap-${i}.webp`))]);
      const scena = new T.Scene(); scena.environment = env; swiatla(scena);
      const model = g.scene, plotno = model.getObjectByName('plotno_front');
      const mp = materialPlotna(etapy); plotno.material = mp;
      const cn = cien(0.85); cn.position.y = 0.002; model.add(cn); scena.add(model);
      const kam = new T.PerspectiveCamera(28, 1, 0.05, 50);
      const sekcja = el.closest('.sztal');
      return {
        scena, kam,
        postep: () => { const r = sekcja.getBoundingClientRect(); return zakres(-r.top, 0, r.height - innerHeight); },
        ustaw(p) {   // obrót od trzech czwartych do frontu i lekko za; etapy malowania w rytm kroków
          const wasko = kam.aspect < 0.9;
          model.rotation.y = -0.75 + 0.95 * gladko(zakres(p, 0, 0.92));
          const d = (wasko ? 7.4 : 6.2) - 1.2 * gladko(p);   // cała sztaluga (maszt 2,1 m) w kadrze, pod koniec bliżej płótna
          kam.position.set(Math.sin(0.1) * d, 1.2 + 0.1 * p, Math.cos(0.1) * d); kam.lookAt(0, 1.06 + 0.08 * p, 0);
          mp.userData.etap.value = 3 * gladko(zakres(p, 0.06, 0.9));
          return Math.min(3, Math.floor(mp.userData.etap.value + 0.02));   // aktywny krok
        },
      };
    },
    async paleta(el) {
      const g = await loader.loadAsync('rekwizyty/paleta.glb');
      const scena = new T.Scene(); scena.environment = env; swiatla(scena);
      const obrot = new T.Group(); obrot.add(g.scene); scena.add(obrot);
      const pedzel = g.scene.getObjectByName('pedzel_paleta'), p0 = pedzel ? pedzel.position.clone() : null;
      const cn = cien(0.3); cn.position.y = -0.06; scena.add(cn);
      const kam = new T.PerspectiveCamera(30, 1, 0.01, 20); kam.position.set(0, 0.8, 0.82); kam.lookAt(0, -0.01, 0);   // cała paleta w kadrze przy każdym obrocie
      return {
        scena, kam,
        postep: () => { const r = el.getBoundingClientRect(); return zakres(innerHeight - r.top, 0, innerHeight + r.height); },
        ustaw(p) {   // paleta wjeżdża z ukosa, obraca się; pędzel rozciera błękit z bielą
          const e = gladko(p);
          obrot.rotation.set(-0.35 + 0.55 * e, -0.9 + 1.3 * e, 0.25 - 0.3 * e);
          if (pedzel) {   // oś pędzla w czubku włosia: ruch po płaszczyźnie deski (x, z), wysokość stała — trzonek nie wchodzi w paletę
            pedzel.position.x = p0.x + Math.sin(p * Math.PI * 3) * 0.028; pedzel.position.z = p0.z + Math.sin(p * Math.PI * 2) * 0.012;
          }
        },
      };
    },
  };

  // przygotowanie po kolei (bez blokowania przejść): modele, tekstury i shadery na karcie przed pierwszym wejściem
  const gotowe = new Map();
  for (const el of kontenery) {
    const s = await SCENY[el.dataset['3d']](el);
    s.kam.aspect = 1; s.ustaw(ruchOgr ? 1 : 0);
    await renderer.compileAsync(s.scena, s.kam);
    gotowe.set(el, s);
  }
  let biezacy = null, w = 0, h = 0, krok = -1;
  const klatka = () => {
    requestAnimationFrame(klatka);
    const el = kontenery.find(k => k.closest('.zakladka').dataset.z === aktywna() && gotowe.has(k) && (() => { const r = k.getBoundingClientRect(); return r.bottom > -40 && r.top < innerHeight + 40; })());
    if (!el) return;
    const s = gotowe.get(el);
    if (biezacy !== el) { biezacy = el; el.append(renderer.domElement); w = h = 0; }
    const r = el.getBoundingClientRect();
    if (r.width !== w || r.height !== h) { w = r.width; h = r.height; renderer.setSize(w, h, false); s.kam.aspect = w / h; s.kam.updateProjectionMatrix(); }
    const k = s.ustaw(ruchOgr ? 1 : s.postep());
    if (k !== undefined && k !== krok) { krok = k; el.dispatchEvent(new CustomEvent('krok', { detail: k, bubbles: true })); }
    renderer.render(s.scena, s.kam);
  };
  requestAnimationFrame(klatka);
}
