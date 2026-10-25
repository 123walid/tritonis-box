import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  ink: 0x153c43, teal: 0x0d6670, aqua: 0x39a9ad, orange: 0xf26a2e,
  black: 0x171d20, dark: 0x283137, steel: 0xaab4b5, white: 0xf0f1ec,
  blue: 0x1975a8, yellow: 0xf2c14e, brown: 0x79513a, violet: 0x795b9a,
  green: 0x2e9b71, red: 0xc94d43, pvc: 0xd7ded8, copper: 0xc4824b,
};

export function material(color, roughness = 0.65, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
export const M = {
  black: material(C.black, 0.8), dark: material(C.dark, 0.72),
  steel: material(C.steel, 0.28, 0.72), white: material(C.white, 0.55),
  teal: material(C.teal, 0.55), orange: material(C.orange, 0.55),
  blue: material(C.blue, 0.5), green: material(C.green, 0.55),
  copper: material(C.copper, 0.3, 0.65), pvc: material(C.pvc, 0.72),
};

export function box(w, h, d, mat, x = 0, y = 0, z = 0, radius = 0.04) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 4, h / 4, d / 4)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function cyl(r, h, mat, x = 0, y = 0, z = 0, segments = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function marker(parent, name, x, y, z) {
  const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o;
}
export function worldPos(o) { return o.getWorldPosition(new THREE.Vector3()); }
export function cylinderBetween(a, b, radius, mat, segments = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = cyl(radius, dir.length(), mat, 0, 0, 0, segments);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
export function cable(points, color, radius = 0.032, name = '') {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(32, points.length * 16), radius, 8, false), material(color, 0.6));
  mesh.castShadow = true; mesh.name = name; mesh.userData.cable = true;
  return mesh;
}
export function screw(parent, x, y, z, r = 0.065) {
  const s = cyl(r, 0.055, M.steel, x, y, z, 20); s.rotation.x = Math.PI / 2; parent.add(s);
  const slot = box(r * 1.25, 0.014, 0.012, M.dark, x, y, z + 0.033, 0); parent.add(slot);
  return s;
}
export function textTexture(text, opts = {}) {
  const { bg = null, fg = '#153c43', size = 54, weight = 700, align = 'center', padding = 26, border = null, aspect = 2 } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(128, Math.min(1024, Math.round(canvas.width / Math.max(aspect, 0.25))));
  const ctx = canvas.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10); }
  ctx.fillStyle = fg; ctx.textAlign = align; ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lineHeight = size * 1.2; const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  ctx.font = `${weight} ${size}px "Avenir Next", "Segoe UI", sans-serif`;
  const x = align === 'left' ? padding : align === 'right' ? canvas.width - padding : canvas.width / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight, canvas.width - padding * 2));
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8; return tex;
}
export function label(text, w, h, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: textTexture(text, { ...opts, aspect: w / h }), transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); p.renderOrder = 5; return p;
}
export function info(group, title, body, specs = []) {
  group.userData.info = { title, body, specs }; return group;
}
function led(color = C.green) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.35 });
}

export function createSSR(side = 'A1') {
  const g = new THREE.Group();
  const channel = side === 'A1' ? 1 : 2;
  const phase = side === 'A1' ? 'L1' : 'L2';
  // The relay body sits inside the closed enclosure. Only this upper AC terminal
  // deck projects through the top wall; DC terminals 3–4 remain concealed.
  g.add(box(1.02, 1.5, 0.42, M.steel, 0, 0, 0, 0.055));
  g.add(box(0.94, 1.4, 0.45, M.white, 0, 0, 0.02, 0.04));
  const face = label(`SSR-40DA-H\n90–480 V AC\nDC → AC`, 0.78, 0.7, { fg: '#27343a', size: 60, weight: 700 });
  face.position.set(0, -0.18, 0.252); g.add(face);
  g.add(box(1.16, 0.34, 0.64, M.dark, 0, 0.78, 0.12, 0.045));
  [-0.3, 0.3].forEach((x, i) => {
    const terminal = cyl(0.095, 0.075, M.steel, x, 0.99, 0.12, 24); g.add(terminal);
    g.add(box(0.13, 0.014, 0.025, M.dark, x, 1.033, 0.12, 0.005));
    const txt = label(i === 0 ? `1  ${phase} IN` : `2  → ${side}`, 0.5, 0.19, { bg: '#f7f8f2', fg: '#102f35', size: 76, weight: 800 });
    txt.position.set(x, 0.77, 0.455); g.add(txt);
  });
  const channelLabel = label(`SSR${channel}  •  ${phase} / ${side}`, 1.08, 0.19, { bg: '#153c43', fg: '#ffffff', size: 72, weight: 800 });
  channelLabel.position.set(0, 0.53, 0.445); g.add(channelLabel);
  const coverMat = new THREE.MeshPhysicalMaterial({ color: 0xd8eeed, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0, depthWrite: false });
  const cover = box(1.12, 0.15, 0.68, coverMat, 0, 1.05, 0.12, 0.035); cover.castShadow = false; g.add(cover);
  const in1 = marker(g, `${side.toLowerCase()}Input`, -0.3, 1.12, 0.12);
  const out1 = marker(g, `${side.toLowerCase()}Output`, 0.3, 1.12, 0.12);
  const ctrlPlus = marker(g, 'controlPlus', 0.25, -0.65, 0.1);
  const ctrlMinus = marker(g, 'controlMinus', -0.25, -0.65, 0.1);
  const status = cyl(0.055, 0.03, led(C.orange), 0, 0.94, 0.46, 20); status.rotation.x = Math.PI / 2; g.add(status);
  info(g, `SSR${channel} • ${phase} to ${side}`, `The SSR body and DC control terminals are inside the closed enclosure. Covered upper terminals 1–2 switch ${phase} to contactor coil ${side}.`, ['SSR-40DA-H class', '90–480 V AC output', '4–32 V DC internal control']);
  return { group: g, input: in1, output: out1, ctrlPlus, ctrlMinus, status };
}

export function createEnclosure(logoTexture) {
  const g = new THREE.Group();
  const mount = box(3.95, 3.18, 0.15, M.dark, 0, 0, -0.64, 0.08); g.add(mount);
  [[-1.75, 1.38], [1.75, 1.38], [-1.75, -1.38], [1.75, -1.38]].forEach(([x, y]) => screw(g, x, y, -0.54, 0.08));
  g.add(box(3.45, 2.78, 0.28, M.black, 0, 0, -0.43, 0.13));
  g.add(box(3.45, 0.2, 1.05, M.black, 0, 1.29, 0, 0.06));
  g.add(box(3.45, 0.2, 1.05, M.black, 0, -1.29, 0, 0.06));
  g.add(box(0.2, 2.45, 1.05, M.black, -1.625, 0, 0, 0.06));
  g.add(box(0.2, 2.45, 1.05, M.black, 1.625, 0, 0, 0.06));
  const gasket = new THREE.Group();
  gasket.add(box(3.25, 0.09, 0.06, M.dark, 0, 1.245, 0.53, 0.025));
  gasket.add(box(3.25, 0.09, 0.06, M.dark, 0, -1.245, 0.53, 0.025));
  gasket.add(box(0.09, 2.4, 0.06, M.dark, -1.58, 0, 0.53, 0.025));
  gasket.add(box(0.09, 2.4, 0.06, M.dark, 1.58, 0, 0.53, 0.025));
  g.add(gasket);
  const internals = new THREE.Group(); g.add(internals);
  const din = box(2.8, 0.1, 0.12, M.steel, 0, 0.46, 0.14, 0.01); internals.add(din);
  const psu = box(1.03, 0.85, 0.48, M.steel, -0.9, 0.67, 0.21, 0.035); internals.add(psu);
  for (let i = 0; i < 6; i++) psu.add(box(0.055, 0.54, 0.02, M.dark, -0.34 + i * 0.135, 0, 0.25, 0.005));
  const psuLabel = label('ISOLATED PSU\n5 V DC', 0.74, 0.29, { fg: '#263a40', size: 58 }); psuLabel.position.set(-0.9, 0.67, 0.47); internals.add(psuLabel);
  const suppression = box(0.83, 0.85, 0.52, M.dark, 0.25, 0.67, 0.2, 0.04); internals.add(suppression);
  const suppressionLabel = label('AC COIL\nRC / MOV', 0.69, 0.35, { bg: '#e8e7db', fg: '#263a40', size: 52 }); suppressionLabel.position.set(0.25, 0.67, 0.47); internals.add(suppressionLabel);
  const driver = box(0.76, 0.85, 0.16, M.teal, 1.08, 0.66, 0.19, 0.025); internals.add(driver);
  const driverLabel = label('DUAL SSR\nDRIVER', 0.58, 0.32, { fg: '#f4f3e9', size: 54 }); driverLabel.position.set(1.08, 0.66, 0.285); internals.add(driverLabel);
  const esp = box(1.32, 0.74, 0.14, material(0x246b55, 0.7), -0.68, -0.53, 0.18, 0.025); internals.add(esp);
  esp.add(box(0.58, 0.4, 0.12, M.steel, -0.12, 0, 0.11, 0.02));
  for (let i = 0; i < 10; i++) { esp.add(box(0.035, 0.09, 0.035, M.copper, -0.55 + i * 0.12, 0.37, 0.02, 0)); esp.add(box(0.035, 0.09, 0.035, M.copper, -0.55 + i * 0.12, -0.37, 0.02, 0)); }
  const espLabel = label('ESP32\nMQTT + CONTROL', 0.75, 0.27, { fg: '#f4f3e9', size: 48 }); espLabel.position.set(-0.68, -0.53, 0.34); internals.add(espLabel);
  const afe = box(1.12, 0.73, 0.14, material(0x317e88, 0.65), 0.8, -0.52, 0.18, 0.025); internals.add(afe);
  const afeLabel = label('CT BIAS + ADC\nNPN INPUT', 0.88, 0.31, { fg: '#f4f3e9', size: 47 }); afeLabel.position.set(0.8, -0.52, 0.275); internals.add(afeLabel);
  for (let i = 0; i < 5; i++) { const tb = box(0.22, 0.24, 0.22, i < 2 ? M.blue : M.orange, -1.12 + i * 0.52, -1.02, 0.17, 0.02); internals.add(tb); }
  const separation = label('SELV / SENSOR ZONE', 1.75, 0.18, { fg: '#39a9ad', size: 66 }); separation.position.set(0.38, -1.03, 0.39); internals.add(separation);
  const front = new THREE.Group(); g.add(front);
  front.add(box(3.22, 2.55, 0.17, M.black, 0, 0, 0.65, 0.11));
  front.add(box(2.64, 1.84, 0.045, M.white, 0, 0, 0.755, 0.025));
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, depthWrite: false });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.13, 1.32), logoMat); logo.position.set(0, 0, 0.783); front.add(logo);
  [[-1.2, 0.79], [1.2, 0.79], [-1.2, -0.79], [1.2, -0.79]].forEach(([x, y]) => screw(front, x, y, 0.79, 0.065));
  const productLabel = label('SMART PUMP CONTROLLER  •  REV B', 2.55, 0.21, { fg: '#153c43', size: 68, weight: 800 }); productLabel.position.set(0, -1.06, 0.75); front.add(productLabel);
  const gland = cyl(0.2, 0.34, M.dark, 0, 1.48, -0.02); g.add(gland);
  const power = marker(g, 'power', 0, 1.67, -0.02);
  const jack = new THREE.Group(); jack.position.set(-0.88, -1.4, 0); g.add(jack);
  jack.add(cyl(0.19, 0.24, M.dark)); jack.add(cyl(0.13, 0.27, M.steel, 0, -0.04, 0));
  const jackLabel = label('CURRENT • CT  /  BLUE', 1.24, 0.22, { bg: '#153c43', fg: '#ffffff', size: 70, weight: 800 }); jackLabel.position.set(-0.88, -1.09, 0.58); g.add(jackLabel);
  const currentPort = marker(jack, 'currentPort', 0, -0.18, 0);
  info(jack, 'Current sensor input', 'Recessed 3.5 mm jack for the SCT-013-030. Inside, a bias/protection network adapts the 1 V AC signal for the ADC.', ['30 A : 1 V', 'Internal CT burden', 'No second burden resistor']);
  const water = new THREE.Group(); water.position.set(0.88, -1.4, 0); g.add(water);
  water.add(box(0.58, 0.2, 0.42, M.dark, 0, 0, 0, 0.035));
  water.add(box(0.48, 0.22, 0.32, M.white, 0, -0.13, 0, 0.025));
  water.add(box(0.2, 0.07, 0.12, M.white, 0, -0.27, 0, 0.012));
  for (let i = 0; i < 4; i++) water.add(box(0.035, 0.065, 0.055, M.copper, -0.15 + i * 0.1, -0.255, 0, 0.005));
  const waterLabel = label('WATER • 4 PIN  /  YELLOW', 1.42, 0.22, { bg: '#153c43', fg: '#ffffff', size: 66, weight: 800 }); waterLabel.position.set(0.88, -1.09, 0.58); g.add(waterLabel);
  const waterPort = marker(water, 'waterPort', 0, -0.31, 0);
  info(water, 'Flat four-pin water input', 'Downward-facing white rectangular connector for the XKC-Y25-NPN. The yellow external cable distinguishes it from the blue CT cable.', ['Flat four-pin connector', '5–12 V DC supply', '3.3 V pull-up and common ground']);
  const ssr1 = createSSR('A1'); ssr1.group.position.set(-1.04, 0.68, 0.03); g.add(ssr1.group);
  const ssr2 = createSSR('A2'); ssr2.group.position.set(1.04, 0.68, 0.03); g.add(ssr2.group);
  info(g, 'Tritonis smart pump controller', 'Closed weatherproof ESP32 controller with internal SSR bodies, covered upper two-phase coil terminals, and bottom-facing color-coded sensor inputs.', ['L1 → SSR1 → A1', 'L2 → SSR2 → A2', '380/400 V AC coil • Rev B']);
  return { group: g, front, internals, power, currentPort, waterPort, jack, water, ssr1, ssr2 };
}

export function createContactor() {
  const g = new THREE.Group();
  const rail = box(2.25, 0.12, 0.16, M.steel, 0, 0.35, -0.57, 0.015); g.add(rail);
  const body = box(1.48, 1.64, 0.94, material(0x4a5558, 0.62), 0, 0.55, 0, 0.055); g.add(body);
  const actuator = box(0.48, 0.7, 0.13, M.dark, -0.2, 0.6, 0.53, 0.02); g.add(actuator);
  actuator.add(box(0.13, 0.38, 0.05, M.black, 0, 0, 0.08, 0.01));
  const face = label('K1  •  3 POLE\n380/400 V AC COIL', 0.9, 0.4, { bg: '#f7f8f2', fg: '#153c43', size: 58, weight: 800 }); face.position.set(0.23, 0.08, 0.493); g.add(face);
  [-0.5, 0, 0.5].forEach((x, i) => { screw(g, x, 1.19, 0.5, 0.1); const l = label(`${1 + i * 2}/L${i + 1}`, 0.38, 0.16, { fg: '#d7dfdb', size: 64 }); l.position.set(x, 1.39, 0.48); g.add(l); });
  const a1 = marker(g, 'A1', 0.74, 1.14, 0.3); screw(g, 0.74, 1.14, 0.42, 0.075);
  const a1Label = label('A1', 0.24, 0.16, { fg: '#f2c14e', size: 90 }); a1Label.position.set(0.74, 1.4, 0.49); g.add(a1Label);
  const overload = box(1.5, 1.3, 0.9, M.white, 0, -1.0, 0, 0.045); g.add(overload);
  overload.add(box(1.15, 0.32, 0.05, material(0x6ba5b0, 0.6), 0, 0.4, 0.47, 0.02));
  const dial = cyl(0.19, 0.08, M.blue, 0.15, -0.05, 0.5, 32); dial.rotation.x = Math.PI / 2; overload.add(dial);
  const stop = cyl(0.14, 0.09, material(C.red, 0.5), -0.43, -0.05, 0.5, 28); stop.rotation.x = Math.PI / 2; overload.add(stop);
  const olLabel = label('MOTOR OVERLOAD\nRESET  •  TEST', 0.88, 0.27, { fg: '#203c42', size: 51 }); olLabel.position.set(0, -0.43, 0.48); overload.add(olLabel);
  const tMarkers = [];
  [-0.5, 0, 0.5].forEach((x, i) => { screw(g, x, -1.52, 0.49, 0.1); const l = label(`${2 + i * 2}/T${i + 1}`, 0.38, 0.16, { fg: '#203c42', size: 64 }); l.position.set(x, -1.72, 0.48); g.add(l); tMarkers.push(marker(g, `T${i + 1}`, x, -1.72, 0.3)); });
  const a2 = marker(g, 'A2', 0.74, -1.42, 0.3); screw(g, 0.74, -1.42, 0.42, 0.075);
  const a2Label = label('A2', 0.24, 0.16, { fg: '#795b9a', size: 90 }); a2Label.position.set(0.74, -1.68, 0.49); g.add(a2Label);
  const coilLed = cyl(0.07, 0.04, led(), 0.48, 0.65, 0.54, 20); coilLed.rotation.x = Math.PI / 2; g.add(coilLed);
  info(g, 'K1 contactor + motor overload', 'Three-pole contactor with a 380/400 V AC line-to-line coil. Applying L1/L2 through the two SSR channels across A1/A2 closes the main contacts; the overload protects the pump motor.', ['Siemens-style three-pole form', 'A1/A2 • 380/400 V AC', 'No neutral in the coil circuit']);
  return { group: g, actuator, coilLed, a1, a2, t: tMarkers };
}

export function createCurrentSensor() {
  const g = new THREE.Group();
  const jawA = box(0.64, 0.85, 0.38, M.blue, -0.19, 0, 0, 0.1); g.add(jawA);
  const jawB = box(0.64, 0.85, 0.38, M.blue, 0.19, 0, 0, 0.1); g.add(jawB);
  const aperture = cyl(0.22, 0.42, M.dark, 0, 0, 0, 32); aperture.rotation.x = Math.PI / 2; g.add(aperture);
  const core = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 12, 32), M.steel); g.add(core);
  const ctLabel = label('SCT-013-030\n30 A : 1 V', 0.72, 0.3, { fg: '#f4f3e9', size: 50 }); ctLabel.position.set(0, -0.1, 0.22); g.add(ctLabel);
  const cableAnchor = marker(g, 'ctCable', 0.48, -0.35, 0);
  info(g, 'SCT-013-030 current clamp', 'The split core closes around one insulated load conductor only—never around two conductors or the whole cable.', ['Clamp on T1 only', '30 A : 1 V AC', 'Arrow toward pump load']);
  return { group: g, jawA, jawB, cableAnchor };
}

export function createWaterSensor() {
  const g = new THREE.Group();
  g.add(cyl(0.38, 0.17, M.white, 0, 0, 0, 40));
  g.add(cyl(0.3, 0.025, material(0xe2e8e3, 0.5), 0, 0.1, 0, 40));
  const status = cyl(0.045, 0.025, led(C.red), 0, 0.125, 0, 16); g.add(status);
  const sensorLabel = label('XKC-Y25\nNPN', 0.47, 0.24, { fg: '#203c42', size: 58 }); sensorLabel.rotation.x = -Math.PI / 2; sensorLabel.position.set(0, 0.125, 0.08); g.add(sensorLabel);
  const cableAnchor = marker(g, 'waterCable', 0, 0, -0.4);
  info(g, 'XKC-Y25-NPN water sensor', 'Capacitive non-contact sensing through a plastic pipe wall. The sensing face sits flush against clean PVC/HDPE—no metal between sensor and water.', ['Brown: +5–12 V', 'Blue: GND', 'Yellow: NPN output', 'Black: mode']);
  return { group: g, status, cableAnchor };
}

export function createEnvironment() {
  const g = new THREE.Group();
  const wallMat = material(0xb8b7aa, 0.95);
  const wall = box(18, 9.2, 0.35, wallMat, 0, 4.4, -1.35, 0.04); g.add(wall);
  for (let i = 0; i < 28; i++) {
    const x = -8.5 + (i % 14) * 1.3, y = 0.45 + Math.floor(i / 14) * 8.0;
    g.add(box(1.15, 0.06, 0.04, material(0xa6a699, 1), x, y, -1.15, 0.01));
  }
  const mounting = box(11.4, 6.6, 0.12, material(0x9fa9a4, 0.82), -0.2, 4.1, -1.08, 0.035); g.add(mounting);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), material(0x88968a, 1)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const outlet = new THREE.Group(); outlet.position.set(-3, 7.1, -0.9); g.add(outlet);
  outlet.add(box(1.15, 1.0, 0.25, M.white, 0, 0, 0, 0.06));
  outlet.add(box(0.66, 0.6, 0.09, M.dark, 0, 0, 0.16, 0.035));
  outlet.add(box(0.32, 0.4, 0.19, M.black, 0, -0.05, 0.26, 0.03));
  const outletCover = box(1.2, 1.06, 0.05, new THREE.MeshPhysicalMaterial({ color: 0xd5e2df, transparent: true, opacity: 0.25, depthWrite: false }), 0, 0.58, 0.26, 0.04); outletCover.rotation.x = -0.55; outlet.add(outletCover);
  const outletAnchor = marker(outlet, 'outlet', 0, -0.25, 0.34);
  const safety = label('PUMP STATION  •  CONTROL + FEEDBACK', 5.4, 0.38, { bg: '#153c43', fg: '#f4f3e9', size: 54, weight: 650 }); safety.position.set(1.7, 7.65, -0.96); g.add(safety);
  return { group: g, outlet, outletAnchor };
}

export function createWaterStation() {
  const g = new THREE.Group();
  const pipeMat = new THREE.MeshPhysicalMaterial({ color: C.pvc, roughness: 0.45, transparent: true, opacity: 0.76, depthWrite: true });
  const left = cylinderBetween(new THREE.Vector3(-1.2, 0.95, 1.65), new THREE.Vector3(2.1, 0.95, 1.65), 0.36, M.teal, 40); g.add(left);
  const pvc = cylinderBetween(new THREE.Vector3(2.1, 0.95, 1.65), new THREE.Vector3(5.0, 0.95, 1.65), 0.36, pipeMat, 40); g.add(pvc);
  [2.1, 5.0].forEach(x => { const flange = cyl(0.47, 0.15, M.pvc, x, 0.95, 1.65, 40); flange.rotation.z = Math.PI / 2; g.add(flange); });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2c9fc0, emissive: 0x0b546c, emissiveIntensity: 0.18, transparent: true, opacity: 0.65, roughness: 0.2 });
  const water = cylinderBetween(new THREE.Vector3(2.12, 0.95, 1.65), new THREE.Vector3(4.98, 0.95, 1.65), 0.25, waterMat, 32); g.add(water);
  const flow = new THREE.Group(); g.add(flow);
  for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb5f1ef })); flow.add(p); }
  const pump = new THREE.Group(); pump.position.set(6.05, 1.02, 1.65); g.add(pump);
  const pumpBody = cyl(0.69, 1.25, M.teal, 0, 0, 0, 40); pumpBody.rotation.z = Math.PI / 2; pump.add(pumpBody);
  const fan = new THREE.Group(); fan.position.x = 0.67; pump.add(fan);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 10, 32), M.dark); rim.rotation.y = Math.PI / 2; fan.add(rim);
  for (let i = 0; i < 6; i++) { const blade = box(0.06, 0.38, 0.13, M.steel, 0, 0.26, 0, 0.03); blade.rotation.x = i * Math.PI / 3; fan.add(blade); }
  pump.add(box(1.55, 0.18, 1.05, M.dark, 0, -0.72, 0, 0.035));
  const motorCable = marker(pump, 'motorCable', 0, 0.7, 0);
  info(pump, 'Irrigation pump', 'Animated load. Running current and water flow follow the contactor state in the simulation.', ['Closed-loop feedback', 'Dry-run / no-flow monitoring concept']);
  const pipeLabel = label('NON-METALLIC PVC SECTION', 2.35, 0.25, { bg: '#f0f1ec', fg: '#153c43', size: 55 }); pipeLabel.position.set(3.5, 0.34, 1.72); pipeLabel.rotation.x = -0.35; g.add(pipeLabel);
  return { group: g, flow, water, fan, motorCable };
}
