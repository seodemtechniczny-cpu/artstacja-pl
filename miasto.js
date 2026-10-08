// Wieczorny Nowy Jork za szkłem: siatka ulic, budynki (jeden InstancedMesh, okna z shadera), niebo o zmierzchu, księżyc,
// jadące auta (światła), radiowozy, od czasu do czasu klucz ptaków. Układ three.js: Y w górę, sala na x 0…24, z 0…−16,
// podłoga sali y = 0, ulice 62 m niżej (20. piętro). Kolory w przestrzeni wyświetlania, jak wypiek sali (bez tone mappingu).
import * as T from './vendor/three.min.js';

const ZIEMIA = -62, SRODEK = new T.Vector2(12, -8);
const BLOK_X = 80, BLOK_Z = 44, ULICA = 16;         // kwartał i szerokość ulicy (m), jak siatka Manhattanu
const ZASIEG = 1400, PUSTO = 140;                    // dokąd sięga miasto; wolne pole wokół naszego budynku
const MGLA = 'vec3(0.055, 0.045, 0.06)';

let ziarno = 11;
const los = () => { ziarno = (ziarno * 16807) % 2147483647; return ziarno / 2147483647; };

export function utworzMiasto(scena) {
  const grupa = new T.Group();
  scena.add(grupa);

  // ---------- niebo: kopuła z gradientem (ciemno pod horyzontem, wąska łuna, granat wyżej) i kilka gwiazd
  const niebo = new T.Mesh(new T.SphereGeometry(2600, 48, 24), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vK; void main(){ vK = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vK;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        float y = vK.y;
        vec3 c = mix(${MGLA}, vec3(0.30, 0.13, 0.07), smoothstep(-0.04, 0.0, y));
        c = mix(c, vec3(0.11, 0.07, 0.12), smoothstep(0.0, 0.08, y));
        c = mix(c, vec3(0.012, 0.016, 0.045), smoothstep(0.06, 0.45, y));
        vec3 g = floor(vK * 380.0);                       // gwiazdy: rzadkie, tylko wysoko
        float s = step(0.9975, h(g)) * smoothstep(0.18, 0.4, y);
        gl_FragColor = vec4(c + s * 0.55, 1.0);
      }`,
  }));
  niebo.renderOrder = -2;
  grupa.add(niebo);

  // ---------- księżyc nad wschodnim horyzontem (widać go z przeszkleń E i z narożnika S) + miękka poświata
  const kier = new T.Vector3(0.93, 0.2, 0.32).normalize(), ks = new T.Vector3(SRODEK.x, 0, SRODEK.y).addScaledVector(kier, 2200);
  const ksiezyc = new T.Mesh(new T.CircleGeometry(30, 48), new T.MeshBasicMaterial({ color: 0xf4ead2, fog: false }));
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,236,200,0.35)'); gr.addColorStop(0.35, 'rgba(255,220,180,0.10)'); gr.addColorStop(1, 'rgba(255,210,170,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const poswiata = new T.Mesh(new T.PlaneGeometry(360, 360), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  for (const o of [ksiezyc, poswiata]) { o.position.copy(ks); o.lookAt(SRODEK.x, 0, SRODEK.y); o.renderOrder = -1; grupa.add(o); }

  // ---------- siatka ulic i kwartały
  const ulice = [];   // {os: 'x'|'z', stala, od, do}
  const xs = [], zs = [];
  for (let x = -ZASIEG; x <= ZASIEG; x += BLOK_X + ULICA) xs.push(SRODEK.x + x);
  for (let z = -ZASIEG; z <= ZASIEG; z += BLOK_Z + ULICA) zs.push(SRODEK.y + z);
  const bud = [];     // [x, z, szer, gleb, wys]
  for (const x0 of xs) for (const z0 of zs) {
    const cx = x0 + BLOK_X / 2, cz = z0 + BLOK_Z / 2;
    if (Math.hypot(cx - SRODEK.x, cz - SRODEK.y) < PUSTO) continue;
    const n = los() < 0.5 ? 1 : 2;   // jeden albo dwa budynki na kwartał
    for (let k = 0; k < n; k++) {
      const szer = n === 1 ? BLOK_X - 6 : BLOK_X / 2 - 5, gleb = BLOK_Z - 6;
      const bx = n === 1 ? cx : x0 + (k + 0.5) * BLOK_X / 2;
      const daleko = Math.hypot(bx - SRODEK.x, cz - SRODEK.y) / ZASIEG;
      // większość niżej niż nasze piętro (widać dachy), wieże częściej dalej — sylwetka śródmieścia na horyzoncie
      // blisko niskie (patrzymy z góry na dachy i ulice), dalej coraz wyżej; wieże tylko w dalszym śródmieściu
      const wieza = daleko > 0.35 && los() < 0.02 + 0.07 * daleko;
      const wys = wieza ? 140 + los() * 220 : 8 + los() * (14 + 90 * daleko);
      bud.push([bx, cz, szer * (0.75 + los() * 0.25), gleb * (0.75 + los() * 0.25), wys, wieza]);
    }
  }
  for (const x of xs) ulice.push({ os: 'z', stala: x - ULICA / 2, od: zs[0], do: zs[zs.length - 1] });
  for (const z of zs) ulice.push({ os: 'x', stala: z - ULICA / 2, od: xs[0], do: xs[xs.length - 1] });

  // ---------- budynki: jedna siatka z instancjami, okna liczone w shaderze z położenia na elewacji
  const ilosc = bud.length + bud.filter(b => b[5]).length;   // wieże dostają zwieńczenie
  const geo = new T.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const rnd = new Float32Array(ilosc);
  const mat = new T.ShaderMaterial({
    uniforms: { czas: { value: 0 } },
    vertexShader: `attribute float los; varying vec3 vW; varying vec3 vN; varying float vL; varying float vD;
      void main(){
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(instanceMatrix) * normal); vL = los;
        vec4 v = viewMatrix * w; vD = -v.z;
        gl_Position = projectionMatrix * v;
      }`,
    fragmentShader: `uniform float czas; varying vec3 vW; varying vec3 vN; varying float vL; varying float vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        vec3 elew = vec3(0.022, 0.02, 0.026);
        if (vN.y > 0.5) { gl_FragColor = vec4(mix(elew * 0.8, ${MGLA}, smoothstep(250.0, 2400.0, vD)), 1.0); return; }   // dach
        float poz = abs(vN.x) > 0.5 ? vW.z : vW.x;
        vec2 uv = vec2(poz / 2.0, (vW.y - (${ZIEMIA.toFixed(1)})) / 3.4);
        vec2 f = fract(uv), id = floor(uv);
        vec2 fw = fwidth(uv);
        // okno z miękką krawędzią (bez migotania siatki przy ruchu); daleko średnia jasność zamiast siatki
        vec2 o = smoothstep(vec2(0.18, 0.30) - fw, vec2(0.18, 0.30) + fw, f) * (1.0 - smoothstep(vec2(0.82, 0.78) - fw, vec2(0.82, 0.78) + fw, f));
        float r = h(vec3(id, vL * 97.0));
        // co jakiś czas ktoś zapala albo gasi światło (rzadko, bez migania): los zmienia się co 25–70 s dla okna
        float okres = 25.0 + 45.0 * h(vec3(id.yx, vL));
        float r2 = h(vec3(id, floor(czas / okres + h(vec3(id, 3.0)))));
        float pali = step(0.72, r) * step(0.08, r2) + step(r, 0.72) * step(0.985, r2);
        vec3 kol = mix(vec3(1.0, 0.55, 0.24), vec3(1.0, 0.82, 0.58), h(vec3(id, vL * 13.0)));
        float okno = o.x * o.y * pali;
        float daleko = smoothstep(0.35, 0.9, max(fw.x, fw.y));
        vec3 c = elew + kol * mix(okno * 0.85, 0.085, daleko);
        c = mix(c, ${MGLA}, smoothstep(250.0, 2400.0, vD));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const budynki = new T.InstancedMesh(geo, mat, ilosc);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sk = new T.Vector3(), pz = new T.Vector3();
  let i = 0;
  for (const [x, z, sx, sz, wys, wieza] of bud) {
    budynki.setMatrixAt(i, m4.compose(pz.set(x, ZIEMIA, z), q, sk.set(sx, wys, sz))); rnd[i++] = los();
    if (wieza) { budynki.setMatrixAt(i, m4.compose(pz.set(x, ZIEMIA + wys, z), q, sk.set(sx * 0.6, 22, sz * 0.6))); rnd[i++] = los(); }
  }
  geo.setAttribute('los', new T.InstancedBufferAttribute(rnd, 1));
  budynki.frustumCulled = false;
  grupa.add(budynki);
  // iglice wież (cienkie, jasnoszare, z czerwonym światłem ostrzegawczym na szczycie — stałym)
  const wieze = bud.filter(b => b[5]);
  const iglice = new T.InstancedMesh(new T.BoxGeometry(1.4, 46, 1.4).translate(0, 23, 0), new T.MeshBasicMaterial({ color: 0x3a3436 }), wieze.length);
  const ostrz = new T.InstancedMesh(new T.SphereGeometry(1.6, 8, 6), new T.MeshBasicMaterial({ color: 0xff3a24, fog: false }), wieze.length);
  wieze.forEach(([x, z, , , wys], k) => {
    iglice.setMatrixAt(k, m4.makeTranslation(x, ZIEMIA + wys + 22, z));
    ostrz.setMatrixAt(k, m4.makeTranslation(x, ZIEMIA + wys + 68, z));
  });
  grupa.add(iglice, ostrz);

  // ziemia i delikatna łuna ulic
  const ziemia = new T.Mesh(new T.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x0b0806 }));
  ziemia.position.y = ZIEMIA;
  grupa.add(ziemia);
  const pasy = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x2a160b }), ulice.length);
  ulice.forEach((u, k) => {
    const dl = u.do - u.od, sr = (u.od + u.do) / 2;
    pasy.setMatrixAt(k, u.os === 'x' ? m4.compose(pz.set(sr, ZIEMIA + 0.05, u.stala), q, sk.set(dl, 1, ULICA * 0.8)) : m4.compose(pz.set(u.stala, ZIEMIA + 0.05, sr), q, sk.set(ULICA * 0.8, 1, dl)));
  });
  grupa.add(pasy);

  // ---------- auta: światła (przednie ciepłobiałe, tylne czerwone) jadące po ulicach w obie strony
  const AUT = 360, auta = [];
  for (let k = 0; k < AUT; k++) {
    // większość aut na ulicach do ~700 m od sali: tam je widać, dalej giną między budynkami
    const pula = los() < 0.8 ? ulice.filter(u => Math.abs(u.stala - (u.os === 'x' ? SRODEK.y : SRODEK.x)) < 700) : ulice;
    const u = pula[Math.floor(los() * pula.length)], kierunek = los() < 0.5 ? 1 : -1;
    auta.push({ u, kierunek, v: 7 + los() * 9, faza: los(), pas: kierunek * (2 + los() * 2.5) });
  }
  const POLICJA = 3;   // pierwsze trzy auta to radiowozy, na ulicach najbliżej sali (inaczej giną w tłumie świateł)
  const bliskie = ulice.filter(u => Math.abs(u.stala - (u.os === 'x' ? SRODEK.y : SRODEK.x)) < 260);
  for (let k = 0; k < POLICJA; k++) auta[k].u = bliskie[Math.floor(los() * bliskie.length)];
  const swiatla = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshBasicMaterial({ fog: false }), AUT);
  const kol = new T.Color();
  auta.forEach((a, k) => swiatla.setColorAt(k, kol.set(a.kierunek > 0 ? 0xfff0d8 : 0xff2a12)));
  swiatla.frustumCulled = false;
  grupa.add(swiatla);

  // ---------- ptaki: klucz 7 sylwetek, przelatuje co 20–40 s przed przeszkleniami
  const v = new T.BufferGeometry();
  v.setAttribute('position', new T.Float32BufferAttribute([-1, 0.25, 0, 0, 0, 0, -0.15, -0.12, 0, 1, 0.25, 0, 0.15, -0.12, 0, 0, 0, 0], 3));
  const ptaki = new T.InstancedMesh(v, new T.MeshBasicMaterial({ color: 0x8a7266, side: T.DoubleSide, fog: false }), 7)   // podświetlone od dołu łuną miasta — ciemne ginęły na nocnym niebie;
  ptaki.frustumCulled = false;
  ptaki.visible = false;
  grupa.add(ptaki);
  let przelot = null, nastepny = 3 + los() * 4;   // pierwszy przelot zaraz po wejściu, potem co 20–40 s
  const nowyPrzelot = (t, kamera) => {
    // klucz przecina widok przed kamerą (70–140 m dalej, nad naszym piętrem), z lewa na prawo albo odwrotnie;
    // gdy kamera patrzy na ścianę, ptaki lecą za nią (zasłonięte) — tak jak w prawdziwej sali
    const przod = kamera.getWorldDirection(new T.Vector3()).setY(0).normalize(), bok = new T.Vector3(-przod.z, 0, przod.x);
    const c = kamera.position.clone().addScaledVector(przod, 70 + los() * 70); c.y = 6 + los() * 22;
    const s = los() < 0.5 ? 1 : -1;
    przelot = { a: c.clone().addScaledVector(bok, -110 * s), b: c.clone().addScaledVector(bok, 110 * s), t0: t, dl: 16 + los() * 8 };
  };

  return {
    ptaki,   // do pomiarów (?diag)
    aktualizuj(t, kamera) {
      mat.uniforms.czas.value = t;
      auta.forEach((a, k) => {
        const dl = a.u.do - a.u.od, s = ((a.faza * dl + a.kierunek * a.v * t) % dl + dl) % dl + a.u.od;
        const policja = k < POLICJA, r = policja ? 2.6 : 1.9;
        if (a.u.os === 'x') m4.compose(pz.set(s, ZIEMIA + 1, a.u.stala + a.pas), q, sk.set(r, r, r));
        else m4.compose(pz.set(a.u.stala + a.pas, ZIEMIA + 1, s), q, sk.set(r, r, r));
        swiatla.setMatrixAt(k, m4);
        // radiowóz: belka na zmianę czerwona i niebieska, spokojnie (0,45 s), bez rozświetlania sceny
        if (policja) swiatla.setColorAt(k, kol.set(Math.floor(t / 0.45 + k) % 2 ? 0x3a6bff : 0xff2a2a));
      });
      swiatla.instanceMatrix.needsUpdate = true;
      swiatla.instanceColor.needsUpdate = true;
      if (!przelot && t > nastepny) nowyPrzelot(t, kamera);
      if (przelot) {
        const u = (t - przelot.t0) / przelot.dl;
        if (u > 1) { przelot = null; ptaki.visible = false; nastepny = t + 20 + los() * 20; }
        else {
          ptaki.visible = true;
          const kier = sk.subVectors(przelot.b, przelot.a).normalize(), bok = new T.Vector3(-kier.z, 0, kier.x);
          for (let k = 0; k < 7; k++) {
            const rzad = Math.ceil(k / 2), strona = k % 2 ? 1 : -1;
            const p = pz.lerpVectors(przelot.a, przelot.b, u).addScaledVector(kier, -rzad * 2.2).addScaledVector(bok, strona * rzad * 1.8);
            p.y += Math.sin(t * 1.3 + k) * 0.3;
            const mach = 0.55 + 0.45 * Math.sin(t * 9 + k * 0.8);   // machanie skrzydłami
            ptaki.setMatrixAt(k, m4.compose(p, kamera.quaternion, new T.Vector3(0.9, 0.9 * mach, 0.9)));
          }
          ptaki.instanceMatrix.needsUpdate = true;
        }
      }
    },
  };
}
