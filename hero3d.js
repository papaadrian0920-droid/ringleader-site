// The 3D hero: a phone floating over the Ringleader radar, playing a real missed-call conversation on its screen.
// Missed call = a red ring pulses out. Texted back = green rings. Booked = a burst, and a green pillar rises on the radar.
// The texts on the screen are the real default auto-text. If 3D can't run, the flat phone in the page stays instead.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const stage = document.getElementById("stage");
const hero = document.querySelector(".hero");
const narrow = matchMedia("(max-width: 900px)");
const small = narrow.matches;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const GREEN = "#C8FF2E", RED = "#FF5340";

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
} catch (err) {
  throw err; // the flat phone stays
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);
renderer.domElement.setAttribute("aria-hidden", "true");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 3.4, 17.5);
const rig = new THREE.Group(); // everything that tilts with the mouse
scene.add(rig);

scene.add(new THREE.HemisphereLight("#BFD0FF", "#1A1C12", 0.7));
const key = new THREE.DirectionalLight("#FFFFFF", 1.4); key.position.set(-4, 6, 8); scene.add(key);
const rimL = new THREE.PointLight(GREEN, 18, 12, 2); rimL.position.set(3.5, 1.5, -2); scene.add(rimL);

// ---------- the phone ----------
const phone = new THREE.Group();
phone.scale.setScalar(1.28);
rig.add(phone);
const body = new THREE.Mesh(new RoundedBoxGeometry(2.1, 4.3, 0.24, 6, 0.32), new THREE.MeshStandardMaterial({ color: "#121316", metalness: 0.7, roughness: 0.32 }));
phone.add(body);
const band = new THREE.Mesh(new RoundedBoxGeometry(2.14, 4.34, 0.16, 6, 0.33), new THREE.MeshStandardMaterial({ color: "#2A2C30", metalness: 0.9, roughness: 0.25 }));
phone.add(band);
const SW = 600, SH = 1260;
const sc = document.createElement("canvas"); sc.width = SW; sc.height = SH;
const g = sc.getContext("2d");
const screenTex = new THREE.CanvasTexture(sc);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 4;
const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 4.03), new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, toneMapped: false }));
screen.position.z = 0.125;
phone.add(screen);
const cam = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: "#050505" }));
cam.position.set(0, 1.88, 0.127); phone.add(cam);

// ---------- the radar floor, with a sweep and pillars for booked jobs ----------
const floorY = -2.9;
const fc = document.createElement("canvas"); fc.width = fc.height = 1024;
{
  const f = fc.getContext("2d"), c = 512;
  const gr = f.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, "rgba(200,255,46,.16)"); gr.addColorStop(1, "rgba(200,255,46,0)");
  f.fillStyle = gr; f.fillRect(0, 0, 1024, 1024);
  f.strokeStyle = "rgba(200,255,46,.55)"; f.lineWidth = 3; f.beginPath(); f.arc(c, c, 500, 0, 7); f.stroke();
  f.setLineDash([10, 14]); f.lineWidth = 2;
  for (const r of [380, 260, 140]) { f.strokeStyle = `rgba(255,255,255,${r === 140 ? 0.25 : 0.12})`; f.beginPath(); f.arc(c, c, r, 0, 7); f.stroke(); }
  f.setLineDash([]); f.strokeStyle = "rgba(255,255,255,.07)";
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; f.beginPath(); f.moveTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60); f.lineTo(c + Math.cos(a) * 500, c + Math.sin(a) * 500); f.stroke(); }
}
const floorTex = new THREE.CanvasTexture(fc);
const floor = new THREE.Mesh(new THREE.CircleGeometry(5.7, 96), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, toneMapped: false }));
floor.rotation.x = -Math.PI / 2; floor.position.y = floorY;
rig.add(floor);
const swc = document.createElement("canvas"); swc.width = swc.height = 512;
{
  const f = swc.getContext("2d");
  for (let k = 0; k < 40; k++) {
    f.beginPath(); f.moveTo(256, 256); f.arc(256, 256, 250, -k * 0.022, -(k + 1) * 0.022, true); f.closePath();
    f.fillStyle = `rgba(200,255,46,${0.28 * (1 - k / 40)})`; f.fill();
  }
}
const sweep = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(swc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
sweep.rotation.x = -Math.PI / 2; sweep.position.y = floorY + 0.01;
rig.add(sweep);
const pillarMat = new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 1.3, roughness: 0.4 });
const capMat = new THREE.MeshBasicMaterial({ color: "#F2FFC9", toneMapped: false });
const pillars = [];
let pillarSeed = 3;
function addPillar(height) {
  pillarSeed = (pillarSeed * 9301 + 49297) % 233280;
  const a = pillarSeed / 233280 * Math.PI * 2, r = 1.9 + (pillarSeed % 97) / 97 * 3.0;
  const grp = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 10).translate(0, 0.5, 0), pillarMat);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), capMat);
  grp.add(col, cap);
  grp.position.set(Math.cos(a) * r, floorY, Math.sin(a) * r);
  rig.add(grp);
  pillars.push({ grp, col, cap, h: height, born: clock, dying: -1 });
  if (pillars.length > 14) pillars[0].dying = clock; // oldest shrinks away
}

// ---------- rings that pulse out from the phone ----------
const ringGeo = new THREE.TorusGeometry(1, 0.025, 8, 96);
const rings = [];
function pulse(color, count = 1, delay = 0.22) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = floorY + 0.02;
    rig.add(m);
    rings.push({ m, t0: clock + i * delay });
  }
}

// ---------- little cards orbiting the phone ----------
function chip(text, dot) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 140;
  const f = c.getContext("2d");
  f.fillStyle = "rgba(20,20,22,.92)"; f.strokeStyle = "rgba(255,255,255,.14)"; f.lineWidth = 3;
  f.beginPath(); f.roundRect(4, 4, 632, 132, 66); f.fill(); f.stroke();
  f.fillStyle = dot; f.beginPath(); f.arc(72, 70, 18, 0, 7); f.fill();
  f.fillStyle = "#F4F4F1"; f.font = "700 46px 'Instrument Sans', sans-serif"; f.textBaseline = "middle"; f.fillText(text, 112, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.48), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
  if (narrow.matches) m.scale.setScalar(0.7);
  rig.add(m);
  return m;
}
let chips = [];
function makeChips() {
  chips.forEach((c) => rig.remove(c.m));
  chips = [
    { m: chip("Missed call · 2:14 PM", RED), a: 0.4, y: 2.1, r: 4.0 },
    { m: chip("Texted back in 4 sec", GREEN), a: 2.5, y: -1.2, r: 4.3 },
    { m: chip("+$450 booked", GREEN), a: 4.5, y: 0.9, r: 4.1 }
  ];
}

// ---------- the conversation on the screen ----------
// Linda's phone (the caller). Grey bubbles come from the shop, green ones are Linda.
const SCRIPT = [
  { at: 0.4, kind: "missed" },
  { at: 1.3, kind: "typing" },
  { at: 2.3, from: "shop", text: "Hi! This is Mike's Plumbing. Sorry we missed your call, we're probably on a job. What can we help you with? Reply here and we'll get right back to you. Reply STOP to opt out.", note: "4 seconds after the missed call" },
  { at: 5.2, from: "me", text: "Water heater is leaking in the garage. Can someone come today?" },
  { at: 7.6, from: "shop", text: "Hi Linda, this is Mike. I can be there at 4 today. Does that work?" },
  { at: 9.6, from: "me", text: "Yes please!" },
  { at: 10.6, kind: "booked" }
];
const LOOP = 14;
const font = (w, s) => `${w} ${s}px 'Instrument Sans', system-ui, sans-serif`;
function wrap(text, maxW) {
  const words = text.split(" "), lines = []; let line = "";
  for (const w of words) { const test = line ? line + " " + w : w; if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
  if (line) lines.push(line);
  return lines;
}
const easeOut = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
function drawScreen(lt) {
  g.clearRect(0, 0, SW, SH);
  g.save();
  g.beginPath(); g.roundRect(0, 0, SW, SH, 64); g.clip();
  g.fillStyle = "#0C0C0E"; g.fillRect(0, 0, SW, SH);
  // status bar and header
  g.fillStyle = "#F4F4F1"; g.font = font(700, 30); g.textBaseline = "alphabetic"; g.fillText("2:14", 52, 66);
  g.fillRect(SW - 110, 46, 52, 22); g.fillStyle = "#0C0C0E"; g.fillRect(SW - 106, 50, 40, 14); g.fillStyle = GREEN; g.fillRect(SW - 106, 50, 30, 14);
  g.fillStyle = "#1A1A1D"; g.fillRect(0, 96, SW, 120);
  g.fillStyle = GREEN; g.beginPath(); g.arc(90, 156, 36, 0, 7); g.fill();
  g.fillStyle = "#0C0C0E"; g.font = font(800, 30); g.textAlign = "center"; g.fillText("MP", 90, 167); g.textAlign = "left";
  g.fillStyle = "#F4F4F1"; g.font = font(700, 34); g.fillText("Mike's Plumbing", 146, 150);
  g.fillStyle = "#9A9A94"; g.font = font(500, 24); g.fillText("Text message", 146, 184);
  let y = 260;
  const fade = lt > LOOP - 1 ? 1 - (lt - (LOOP - 1)) : 1;
  g.globalAlpha = Math.max(0, fade);
  for (const step of SCRIPT) {
    const k = easeOut((lt - step.at) / 0.4);
    if (k <= 0) break;
    if (step.kind === "typing") {
      const next = SCRIPT[SCRIPT.indexOf(step) + 1];
      if (lt >= next.at) continue;
      g.fillStyle = "#26262B"; g.beginPath(); g.roundRect(40, y, 130, 66, 33); g.fill();
      for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(244,244,241,${0.4 + 0.6 * Math.abs(Math.sin(lt * 5 + i))})`; g.beginPath(); g.arc(78 + i * 28, y + 33, 8, 0, 7); g.fill(); }
      continue;
    }
    if (step.kind === "missed") {
      g.save(); g.globalAlpha *= k; g.translate(0, (1 - k) * -20);
      g.fillStyle = "rgba(255,83,64,.14)"; g.beginPath(); g.roundRect(SW / 2 - 190, y, 380, 58, 29); g.fill();
      g.fillStyle = RED; g.font = font(700, 26); g.textAlign = "center"; g.fillText("Missed call · 2:14 PM", SW / 2, y + 38); g.textAlign = "left";
      g.restore(); y += 96; continue;
    }
    if (step.kind === "booked") {
      g.save(); g.globalAlpha *= k;
      const s = 0.8 + 0.2 * k;
      g.translate(SW / 2, y + 70); g.scale(s, s); g.rotate(-0.05);
      g.fillStyle = GREEN; g.beginPath(); g.roundRect(-210, -62, 420, 124, 24); g.fill();
      g.fillStyle = "#0C0C0E"; g.font = "900 54px Archivo, 'Arial Black', sans-serif"; g.textAlign = "center"; g.fillText("BOOKED $450", 0, 18);
      g.restore(); continue;
    }
    g.font = font(500, 29);
    const me = step.from === "me", maxW = 380, lines = wrap(step.text, maxW - 48);
    const bw = Math.min(maxW, Math.max(...lines.map((l) => g.measureText(l).width)) + 48), bh = lines.length * 40 + 30;
    const x = me ? SW - 40 - bw : 40;
    g.save(); g.globalAlpha *= k; g.translate(0, (1 - k) * 24);
    g.fillStyle = me ? GREEN : "#26262B"; g.beginPath(); g.roundRect(x, y, bw, bh, 30); g.fill();
    g.fillStyle = me ? "#0C0C0E" : "#F4F4F1";
    lines.forEach((l, i) => g.fillText(l, x + 24, y + 46 + i * 40));
    g.restore();
    y += bh + 16;
    if (step.note) { g.save(); g.globalAlpha *= k; g.fillStyle = GREEN; g.font = font(600, 22); g.fillText("↑ " + step.note, 44, y + 10); g.restore(); y += 40; }
  }
  g.restore();
  screenTex.needsUpdate = true;
}

// ---------- glow ----------
let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.9));
  composer.addPass(new OutputPass());
} catch (err) { composer = null; }

let W = 1, H = 1;
function resize() {
  W = stage.clientWidth; H = stage.clientHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  // wide screens: the phone sits on the right, clear of the headline
  if (!narrow.matches && camera.aspect > 1.15) camera.setViewOffset(W, H, -W * 0.22, 0, W, H);
  else camera.setViewOffset(W, H, 0, H * 0.04, W, H);
  camera.position.z = camera.aspect < 0.9 ? 27 / Math.max(camera.aspect, 0.6) * 0.6 : 17.5;
  camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); }
}
resize();
// re-measure whenever the space changes (including when the hero switches to its 3D layout)
new ResizeObserver(resize).observe(stage);

// ---------- motion ----------
let mx = 0, my = 0, tx = 0, ty = 0;
addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
let clock = still ? 11.4 : 0, last = performance.now(), lastLoop = -1, drawn = -1, running = true;
const fired = new Set();
function frame(now) {
  const dt = Math.min(1, (now - last) / 1000); last = now; clock += still ? 0 : dt;
  const intro = easeOut(clock / 1.8);
  // the phone floats in, then bobs and leans toward the cursor
  tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05;
  phone.position.y = 0.15 + (1 - intro) * -3 + Math.sin(clock * 1.1) * 0.08;
  phone.rotation.set(-0.06 + ty * 0.25, -0.26 + tx * 0.5 + (1 - intro) * 2.4, 0.03);
  rig.rotation.y = tx * 0.12;
  rig.rotation.x = ty * 0.05;
  sweep.rotation.z = -clock * 1.4;
  // the story loop
  const loop = Math.floor(clock / LOOP), lt = clock % LOOP;
  if (loop !== lastLoop) { lastLoop = loop; fired.clear(); }
  const fire = (name, at, fn) => { if (lt >= at && !fired.has(name)) { fired.add(name); fn(); } };
  fire("missed", 0.4, () => pulse(RED, 2, 0.3));
  fire("texted", 2.3, () => pulse(GREEN, 3));
  fire("booked", 10.6, () => { pulse(GREEN, 5, 0.12); addPillar(0.5 + Math.random() * 1.0); });
  // redraw the screen about 30 times a second (it's a big texture)
  const tick = Math.floor(clock * 30);
  if (tick !== drawn) { drawn = tick; drawScreen(lt); }
  // rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i], k = (clock - r.t0) / 2.4;
    if (k < 0) continue;
    if (k >= 1) { rig.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); continue; }
    const s = 0.8 + k * 5.8; r.m.scale.set(s, s, 1); r.m.material.opacity = 0.9 * (1 - k);
  }
  // pillars grow in, the oldest shrink away
  for (let i = pillars.length - 1; i >= 0; i--) {
    const p = pillars[i];
    let k = easeOut((clock - p.born) / 0.9);
    if (p.dying >= 0) { k = 1 - easeOut((clock - p.dying) / 0.8); if (k <= 0) { rig.remove(p.grp); pillars.splice(i, 1); continue; } }
    p.col.scale.y = Math.max(0.001, p.h * k); p.cap.position.y = p.h * k; p.cap.scale.setScalar(Math.max(0.001, k));
  }
  // chips orbit and face the camera
  chips.forEach((c, i) => {
    const a = c.a + clock * 0.16;
    c.m.position.set(Math.cos(a) * c.r, c.y + Math.sin(clock * 0.9 + i) * 0.12, Math.sin(a) * c.r);
    c.m.quaternion.copy(camera.quaternion);
    c.m.material.opacity = intro * (0.55 + 0.45 * Math.max(0, Math.sin(a + 1.2)));
  });
  camera.lookAt(0, -0.55, 0);
  if (composer) composer.render(); else renderer.render(scene, camera);
}
function loopFn(now) { if (!running) return; frame(now); requestAnimationFrame(loopFn); }
function setRunning(on) { if (on === running) return; running = on; if (on) { last = performance.now(); requestAnimationFrame(loopFn); } }
if ("IntersectionObserver" in window) new IntersectionObserver((es) => setRunning(es[0].isIntersecting && !document.hidden)).observe(stage);
document.addEventListener("visibilitychange", () => setRunning(!document.hidden));

// start once the fonts are in, so the texts on the screen use the right typeface
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  makeChips();
  for (let i = 0; i < 5; i++) addPillar(0.45 + ((i * 37) % 10) / 10 * 1.0); // a few jobs already booked
  pillars.forEach((p) => { p.born = -1; });
  hero.classList.add("has-3d");
  requestAnimationFrame(loopFn);
});
