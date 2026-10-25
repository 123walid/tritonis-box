import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnclosure, createContactor, createCurrentSensor, createWaterSensor, createEnvironment, createWaterStation, cable, worldPos, material, label, C } from './models.js';
import { VIEWS, STEPS } from './data.js';
import { createUI } from './ui.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('t');
const DURATION = 12;
const container = document.getElementById('scene-container');
const poster = document.getElementById('scene-poster');
const state = { view: 'overview', step: -1, pumpCommand: true, waterPresent: true, pumpRunning: false, current: 0, wires: true, labels: true, calls: 0, triangles: 0 };
let ui;

async function boot() {
  const logoTexture = await new THREE.TextureLoader().loadAsync('/tritonis-logo.png');
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '3D Tritonis installation. Use the adjacent view buttons and guided installation controls as keyboard alternatives.');
  renderer.domElement.setAttribute('role', 'img');

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdce6e1);
  scene.fog = new THREE.Fog(0xdce6e1, 28, 78);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.075; controls.minDistance = 4; controls.maxDistance = 35;
  controls.maxPolarAngle = Math.PI * 0.58; controls.minPolarAngle = 0.18;
  let cameraGoal = null;
  controls.addEventListener('start', () => { cameraGoal = null; });

  scene.add(new THREE.HemisphereLight(0xeaf7f2, 0x5e675c, 2.0));
  const sun = new THREE.DirectionalLight(0xfff2d9, 3.2); sun.position.set(-8, 16, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -8; sun.shadow.camera.near = 1; sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0004; scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9ecbd1, 1.0); fill.position.set(10, 6, 8); scene.add(fill);

  const environment = createEnvironment(); scene.add(environment.group);
  const enclosure = createEnclosure(logoTexture); enclosure.group.position.set(-3, 4.15, 0); scene.add(enclosure.group);
  const contactor = createContactor(); contactor.group.position.set(2.4, 4.4, -0.18); scene.add(contactor.group);
  const waterStation = createWaterStation(); scene.add(waterStation.group);
  const ct = createCurrentSensor(); scene.add(ct.group);
  const waterSensor = createWaterSensor(); waterSensor.group.position.set(3.5, 1.43, 1.65); scene.add(waterSensor.group);

  // Distant, low-contrast agricultural masses keep the horizon spatially grounded.
  const horizon = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 3) * 2, 20, 10), material(0xaabdb1, 1));
    mound.scale.y = 0.22; mound.position.set(-45 + i * 8.5, -0.8, -35 - (i % 2) * 8); horizon.add(mound);
  }
  scene.add(horizon);
  scene.updateMatrixWorld(true);

  const ctCenter = worldPos(contactor.t[0]).add(new THREE.Vector3(0, -0.58, 0));
  ct.group.position.copy(ctCenter); ct.group.rotation.x = Math.PI / 2;
  scene.updateMatrixWorld(true);

  const wires = new THREE.Group(); scene.add(wires);
  const wireMap = {};
  function addWire(id, points, color, radius = 0.035) {
    const w = cable(points, color, radius, id); wires.add(w); wireMap[id] = w; return w;
  }
  function localPoint(group, x, y, z) { return group.localToWorld(new THREE.Vector3(x, y, z)); }
  const p = {
    ssr1In: worldPos(enclosure.ssr1.input), ssr1Out: worldPos(enclosure.ssr1.output),
    ssr2In: worldPos(enclosure.ssr2.input), ssr2Out: worldPos(enclosure.ssr2.output),
    a1: worldPos(contactor.a1), a2: worldPos(contactor.a2),
    ctPort: worldPos(enclosure.currentPort), waterPort: worldPos(enclosure.waterPort),
    ctCable: worldPos(ct.cableAnchor), waterCable: worldPos(waterSensor.cableAnchor),
    power: worldPos(enclosure.power), outlet: worldPos(environment.outletAnchor),
    motor: worldPos(waterStation.motorCable),
  };
  const l1Source = new THREE.Vector3(p.ssr1In.x, 8.0, -0.6);
  const l2Source = new THREE.Vector3(p.ssr2In.x, 8.0, -0.6);
  addWire('a1Supply', [l1Source, p.ssr1In], C.brown, 0.05);
  addWire('a1Wire', [p.ssr1Out, new THREE.Vector3(p.ssr1Out.x, 6.45, 0.12), new THREE.Vector3(3.15, 6.45, 0.12), p.a1], C.brown, 0.05);
  addWire('a2Supply', [l2Source, p.ssr2In], C.dark, 0.05);
  addWire('a2Wire', [p.ssr2Out, new THREE.Vector3(-0.35, 5.95, 0.12), new THREE.Vector3(-0.35, 2.25, 0.12), new THREE.Vector3(3.15, 2.25, 0.12), p.a2], C.dark, 0.05);
  addWire('powerWire', [p.power, new THREE.Vector3(-3, 6.45, 0.05), p.outlet], C.black, 0.075);
  addWire('ctCable', [p.ctCable, new THREE.Vector3(1.2, 1.35, 0.65), new THREE.Vector3(-3.9, 1.35, 0.65), p.ctPort], C.blue, 0.056);
  addWire('waterCable', [p.waterCable, new THREE.Vector3(3.5, 0.35, 0.85), new THREE.Vector3(-2.1, 0.35, 0.85), p.waterPort], C.yellow, 0.056);
  const phaseColors = [C.brown, C.dark, 0x737b80];
  contactor.t.forEach((t, i) => {
    const start = worldPos(t); const lane = 1.15 + i * 0.23;
    addWire(`load${i}`, [start, new THREE.Vector3(start.x, lane + 0.55, start.z), new THREE.Vector3(4.75 + i * 0.18, lane, 0.4), new THREE.Vector3(5.5, 1.55 + i * 0.13, 1.0), p.motor], phaseColors[i], 0.055);
    const top = localPoint(contactor.group, -0.5 + i * 0.5, 1.52, 0.28);
    addWire(`mains${i}`, [new THREE.Vector3(top.x, 8.0, -0.6), top], phaseColors[i], 0.06);
  });
  // Internal control wiring remains concealed by the closed enclosure.
  const internal = new THREE.Group(); enclosure.group.add(internal);
  internal.add(cable([[-0.65, -0.3, 0.28], [-0.2, 0.05, 0.28], [0.8, 0.35, 0.28]], 0x2c7f83, 0.018));
  internal.add(cable([[0.8, -0.45, 0.28], [1.25, -0.05, 0.28], [1.08, 0.35, 0.28]], 0xf2c14e, 0.018));
  internal.add(cable([[-0.9, 0.45, 0.3], [-0.8, 0.05, 0.3], [-0.68, -0.15, 0.3]], 0xc94d43, 0.018));

  const annotations = new THREE.Group(); scene.add(annotations);
  function note(text, pos, w = 1.8) { const l = label(text, w, 0.34, { bg: '#ffffff', fg: '#153c43', size: 72, weight: 800, border: '#78928c' }); l.position.copy(pos); annotations.add(l); return l; }
  note('L1 → SSR1 → A1', new THREE.Vector3(0.2, 6.55, 0.1), 2.25);
  note('L2 → SSR2 → A2', new THREE.Vector3(1.15, 2.28, 0.12), 2.25);
  note('BLUE • CT • T1 ONLY', ctCenter.clone().add(new THREE.Vector3(-0.15, -0.8, 0.55)), 2.35);
  note('YELLOW • XKC-Y25 • NPN', new THREE.Vector3(3.5, 2.05, 1.7), 2.5);
  note('K1 • 380/400 V AC COIL', new THREE.Vector3(2.4, 6.55, -0.1), 2.4);

  const focusMat = new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.9, depthTest: false });
  const focusRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.025, 10, 48), focusMat);
  focusRing.renderOrder = 20; focusRing.visible = false; scene.add(focusRing);
  const focusTargets = { power: enclosure.power, box: enclosure.group, currentPort: enclosure.jack, waterPort: enclosure.water, ct: ct.group, water: waterSensor.group, pump: waterStation.group, a1Wire: contactor.a1, a2Wire: contactor.a2 };

  const ctPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 20), material(C.blue, 0.55)); scene.add(ctPlug); ctPlug.visible = false;
  const waterPlug = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.3), material(C.white, 0.55)); scene.add(waterPlug); waterPlug.visible = false;
  const waterLatch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.12), material(C.white, 0.55)); waterLatch.position.y = -0.22; waterPlug.add(waterLatch);

  function setView(id, instant = false) {
    if (!VIEWS[id]) return; state.view = id;
    const v = VIEWS[id]; const target = new THREE.Vector3(...v.target);
    const fit = camera.aspect < 1.15 ? 1.28 : camera.aspect < 1.4 ? 1.12 : 1;
    const pos = new THREE.Vector3(...v.position).sub(target).multiplyScalar(fit).add(target);
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { camera.position.copy(pos); controls.target.copy(target); cameraGoal = null; }
    else cameraGoal = { pos, target };
  }
  function setStep(i) {
    state.step = i;
    if (i >= 0 && STEPS[i]) setView(STEPS[i].view);
    updateFocus();
  }
  function updateFocus() {
    Object.values(wireMap).forEach(w => { w.material.emissive.setHex(0x000000); w.material.emissiveIntensity = 0; });
    focusRing.visible = false;
    if (state.step < 0) return;
    const id = STEPS[state.step].focus;
    if (wireMap[id]) { wireMap[id].material.emissive.setHex(C.orange); wireMap[id].material.emissiveIntensity = 1.2; }
    const obj = focusTargets[id];
    if (obj) {
      const bounds = new THREE.Box3().setFromObject(obj); const center = bounds.getCenter(new THREE.Vector3());
      if (!bounds.isEmpty()) focusRing.position.copy(center); else obj.getWorldPosition(focusRing.position);
      focusRing.visible = true;
    }
  }
  const api = {
    getState: () => ({ ...state }),
    setView, setStep,
    setPump(on) { state.pumpCommand = Boolean(on) && state.waterPresent; if (on && !state.waterPresent) ui?.toast('Cannot start: water is not detected.'); },
    setWater(on) { state.waterPresent = Boolean(on); if (!on) state.pumpCommand = false; },
    setWires(on) { state.wires = Boolean(on); wires.visible = on; },
    setLabels(on) { state.labels = Boolean(on); annotations.visible = on; },
    resetView() { setView(state.view); },
  };
  ui = createUI(api);

  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([enclosure.group, contactor.group, ct.group, waterSensor.group, waterStation.group], true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !o.userData.info) o = o.parent;
      if (o?.userData.info) { ui.showComponent(o.userData.info); break; }
    }
  });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
    // ResizeObserver can fire after the capture-mode frame; redraw immediately so
    // resizing the drawing buffer never leaves a static capture blank.
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(container); resize(); setView('overview', true);

  let simT = 0, lastUI = 0;
  function sample(t) {
    const phase = (t / DURATION) * Math.PI * 2;
    state.pumpRunning = state.pumpCommand && state.waterPresent;
    state.current = state.pumpRunning ? 8.4 + Math.sin(phase * 3) * 0.25 : 0;
    contactor.actuator.position.z = state.pumpRunning ? 0.45 : 0.53;
    contactor.coilLed.material.emissiveIntensity = state.pumpRunning ? 2.5 : 0.08;
    [enclosure.ssr1.status, enclosure.ssr2.status].forEach(s => { s.material.emissiveIntensity = state.pumpRunning ? 2.0 : 0.08; });
    waterSensor.status.material.color.setHex(state.waterPresent ? C.green : C.red);
    waterSensor.status.material.emissive.setHex(state.waterPresent ? C.green : C.red);
    waterSensor.status.material.emissiveIntensity = state.waterPresent ? 1.7 : 0.25;
    waterStation.flow.visible = state.pumpRunning && state.waterPresent;
    waterStation.water.visible = state.waterPresent;
    waterStation.water.material.emissiveIntensity = 0.12 + (1 - Math.cos(phase)) * 0.08;
    waterStation.flow.children.forEach((drop, i) => {
      const u = (i / waterStation.flow.children.length + t / DURATION) % 1;
      drop.position.set(2.18 + u * 2.72, 0.95 + Math.sin(u * Math.PI * 4) * 0.06, 1.65);
    });
    waterStation.fan.rotation.x = state.pumpRunning ? phase * 6 : 0;
    const installingCT = state.step === 5;
    ct.jawA.position.x = installingCT ? -0.19 - (1 - Math.cos(phase * 2)) * 0.09 : -0.19;
    ct.jawB.position.x = installingCT ? 0.19 + (1 - Math.cos(phase * 2)) * 0.09 : 0.19;
    ctPlug.visible = state.step === 4; waterPlug.visible = state.step === 6;
    if (ctPlug.visible) { ctPlug.position.copy(p.ctPort); ctPlug.position.y -= 0.25 + (1 - Math.cos(phase * 2)) * 0.32; }
    if (waterPlug.visible) { waterPlug.position.copy(p.waterPort); waterPlug.position.y -= 0.23 + (1 - Math.cos(phase * 2)) * 0.32; }
    if (focusRing.visible) { const s = 1 + (1 - Math.cos(phase * 2)) * 0.12; focusRing.scale.setScalar(s); focusRing.quaternion.copy(camera.quaternion); }
  }
  function draw(blend = 1) {
    if (cameraGoal) {
      camera.position.lerp(cameraGoal.pos, blend); controls.target.lerp(cameraGoal.target, blend);
      if (camera.position.distanceTo(cameraGoal.pos) < 0.015) { camera.position.copy(cameraGoal.pos); controls.target.copy(cameraGoal.target); cameraGoal = null; }
    }
    controls.update(); renderer.render(scene, camera);
    state.calls = renderer.info.render.calls; state.triangles = renderer.info.render.triangles;
    document.getElementById('hud').textContent = `t ${simT.toFixed(2)} · ${state.calls} calls · ${state.triangles} tris`;
  }
  let previous = performance.now();
  function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.08); previous = now; simT += dt;
    sample(simT); draw(1 - Math.exp(-dt * 8));
    if (now - lastUI > 100) { ui.update(state); lastUI = now; }
  }
  sample(Number(params.get('t')) || 0); updateFocus(); draw(); ui.update(state);
  await Promise.all([...document.images].map(img => img.complete ? img.decode().catch(() => {}) : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
  if (CAPTURE) poster.hidden = true;
  else poster.classList.add('ready');
  if (!CAPTURE) renderer.setAnimationLoop(frame);
  window.__seek = t => {
    renderer.setAnimationLoop(null); simT = Number.isFinite(Number(t)) ? Number(t) : 0;
    cameraGoal = null; sample(simT); controls.update(); draw(); ui.update(state);
  };
  window.__play = () => { previous = performance.now(); renderer.setAnimationLoop(frame); };
  window.__TRITONIS__ = { api, scene, camera, renderer, controls };
  window.__SCENE_READY__ = true;
}

boot().catch(error => {
  console.error(error); window.__SCENE_ERROR__ = String(error);
  poster.querySelector('p').textContent = 'The 3D environment could not start. Please reload with WebGL enabled.';
});
