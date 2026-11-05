import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFarmWorld } from './farm-world.js';
import { C } from './models.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('t');
const DURATION = 12;
const container = $('farm-container');
const poster = $('farm-poster');
const v = (x, y, z) => new THREE.Vector3(x, y, z);

const sim = {
  pumpCommand: false,
  sourceAvailable: true,
  flowAtSensor: false,
  current: 0,
  elapsed: 0,
  noFlowElapsed: 0,
  sourceChangedAt: -100,
  fault: null,
  lastTripCurrent: null
};
const viewState = { cameraMode: 'overview', connection: 'Wi-Fi', calls: 0, triangles: 0 };
let simTime = 0;
let toastTimer;
const events = [];

function toast(message) {
  clearTimeout(toastTimer); $('farm-toast').textContent = message; $('farm-toast').classList.add('show');
  toastTimer = setTimeout(() => $('farm-toast').classList.remove('show'), 2800);
}
function addEvent(message) {
  events.unshift({ time: simTime, message });
  if (events.length > 5) events.length = 5;
  $('event-log').innerHTML = events.map(event => `<li><time>${event.time.toFixed(1)}s</time><span>${event.message}</span></li>`).join('');
}

async function boot() {
  const logoTexture = await new THREE.TextureLoader().loadAsync('/tritonis-logo.png');
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional farm. Use the travel and phone controls as keyboard and touch alternatives.');

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc9d9ce);
  scene.fog = new THREE.Fog(0xc9d9ce, 48, 115);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 5; controls.maxDistance = 85;
  controls.maxPolarAngle = Math.PI * 0.48; controls.minPolarAngle = 0.18;
  let cameraGoal = null;
  controls.addEventListener('start', () => { cameraGoal = null; });

  scene.add(new THREE.HemisphereLight(0xeaf4e5, 0x4f5541, 2.1));
  const sun = new THREE.DirectionalLight(0xffedca, 3.0); sun.position.set(-22, 34, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -30; sun.shadow.camera.near = 1; sun.shadow.camera.far = 95;
  sun.shadow.bias = -0.00035; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa9d3d5, 0.75); fill.position.set(22, 12, -18); scene.add(fill);

  const world = createFarmWorld(logoTexture); scene.add(world.group);
  world.farmer.group.position.set(17, 0, 15);
  scene.updateMatrixWorld(true);

  const flowPath = [v(-16.7, 0.72, -8.95), v(-18, 0.72, -8.95), v(-18, 0.72, 14), v(16, 0.72, 14)];
  const flowLengths = [];
  let flowTotal = 0;
  for (let i = 0; i < flowPath.length - 1; i++) {
    const length = flowPath[i].distanceTo(flowPath[i + 1]); flowLengths.push(length); flowTotal += length;
  }
  function pointOnFlow(u) {
    let distance = ((u % 1) + 1) % 1 * flowTotal;
    for (let i = 0; i < flowLengths.length; i++) {
      if (distance <= flowLengths[i]) return flowPath[i].clone().lerp(flowPath[i + 1], distance / flowLengths[i]);
      distance -= flowLengths[i];
    }
    return flowPath[flowPath.length - 1].clone();
  }

  let yaw = Math.PI;
  let lookPitch = 0.28;
  const movementKeys = new Set();
  let dragLook = null;

  function farmerLocation() {
    const p = world.farmer.group.position;
    const routerDistance = Math.hypot(p.x - world.routerPosition.x, p.z - world.routerPosition.z);
    const wellDistance = Math.hypot(p.x + 20, p.z + 12);
    if (routerDistance < 9.5) return 'Control room';
    if (wellDistance < 8) return 'Well area';
    return 'In the field';
  }
  function updateConnection() {
    const p = world.farmer.group.position;
    const nearRouter = Math.hypot(p.x - world.routerPosition.x, p.z - world.routerPosition.z) < 9.5;
    viewState.connection = nearRouter ? 'Wi-Fi' : '5G';
  }
  function setCamera(mode, instant = false) {
    viewState.cameraMode = mode;
    controls.enabled = mode !== 'walk';
    cameraGoal = null;
    if (mode === 'well') {
      world.farmer.group.position.set(-14.5, 0, -7);
      yaw = 0;
    } else if (mode === 'command') {
      world.farmer.group.position.set(17, 0, 15);
      yaw = Math.PI;
    }
    const presets = {
      overview: { position: v(36, 29, 38), target: v(0, 0.8, 0) },
      well: { position: v(-29, 7, -1), target: v(-18, 1.2, -10.5) },
      command: { position: v(26, 7, 23), target: v(18, 1.8, 11.5) }
    };
    if (presets[mode]) {
      const preset = presets[mode];
      if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        camera.position.copy(preset.position); controls.target.copy(preset.target);
      } else cameraGoal = preset;
    }
    document.querySelectorAll('.location-button').forEach(button => button.classList.toggle('active', button.dataset.camera === mode));
    $('walk-pad').hidden = mode !== 'walk';
    $('walk-hint').textContent = mode === 'walk' ? 'Walk: WASD / arrows · Drag to look' : 'Overview: drag to orbit · Scroll to zoom';
    world.signs.forEach(sign => { sign.visible = mode !== 'walk'; });
    updateConnection(); updateUI();
    if (CAPTURE) draw(0);
  }

  function canStandAt(x, z) {
    if (x < -29 || x > 28 || z < -23 || z > 21) return false;
    return !world.colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.radius + 0.3);
  }
  function updateWalking(dt) {
    if (viewState.cameraMode !== 'walk') return;
    const forwardAmount = Number(movementKeys.has('KeyW') || movementKeys.has('ArrowUp')) - Number(movementKeys.has('KeyS') || movementKeys.has('ArrowDown'));
    const rightAmount = Number(movementKeys.has('KeyD') || movementKeys.has('ArrowRight')) - Number(movementKeys.has('KeyA') || movementKeys.has('ArrowLeft'));
    const forward = v(Math.sin(yaw), 0, Math.cos(yaw));
    const right = v(forward.z, 0, -forward.x);
    const direction = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount));
    const moving = direction.lengthSq() > 0;
    if (moving) {
      direction.normalize();
      const speed = 4.4;
      const p = world.farmer.group.position;
      const nx = p.x + direction.x * speed * dt, nz = p.z + direction.z * speed * dt;
      if (canStandAt(nx, p.z)) p.x = nx;
      if (canStandAt(p.x, nz)) p.z = nz;
      world.farmer.group.rotation.y = Math.atan2(direction.x, direction.z);
    }
    const stride = moving ? Math.sin(simTime * 9) * 0.42 : 0;
    world.farmer.leftLeg.rotation.x = stride; world.farmer.rightLeg.rotation.x = -stride;
    world.farmer.leftArm.rotation.x = -stride * 0.65; world.farmer.rightArm.rotation.x = stride * 0.65;
    const p = world.farmer.group.position;
    const behind = v(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-6.2);
    camera.position.set(p.x + behind.x, 2.6 + lookPitch * 4, p.z + behind.z);
    controls.target.set(p.x, 1.25, p.z);
    updateConnection();
  }

  function trip(fault, peak = null) {
    sim.fault = fault; sim.lastTripCurrent = peak;
    sim.pumpCommand = false; sim.current = 0; sim.flowAtSensor = false; sim.noFlowElapsed = 0;
    if (fault === 'DRY_RUN') addEvent('DRY-RUN STOP — no water detected for 10 seconds.');
    if (fault === 'HIGH_LOAD') addEvent(`HIGH-LOAD STOP — ${peak.toFixed(1)} A detected; immediate trip.`);
    updateUI();
  }
  function startPump() {
    if (sim.fault) { toast('Reset the protection fault before restarting.'); return; }
    if (sim.pumpCommand) return;
    sim.pumpCommand = true; sim.elapsed = 0; sim.noFlowElapsed = 0; sim.current = 0; sim.flowAtSensor = false;
    addEvent(`Start command sent over ${viewState.connection} — K1 and both SSR channels ON.`);
    updateUI();
  }
  function stopPump() {
    if (!sim.pumpCommand) return;
    sim.pumpCommand = false; sim.current = 0; sim.flowAtSensor = false; sim.noFlowElapsed = 0;
    addEvent('Stop command received — K1 open, 0 A, no flow.'); updateUI();
  }
  function resetFault() {
    if (!sim.fault) return;
    const previous = sim.fault; sim.fault = null; sim.lastTripCurrent = null; sim.noFlowElapsed = 0;
    addEvent(`${previous === 'DRY_RUN' ? 'Dry-run' : 'High-load'} fault reset — restart remains deliberate.`);
    updateUI();
  }
  function updateSim(dt) {
    if (!sim.pumpCommand) {
      sim.current = 0; sim.flowAtSensor = false; sim.noFlowElapsed = 0;
      return;
    }
    sim.elapsed += dt;
    const transportComplete = sim.elapsed >= 3 && simTime - sim.sourceChangedAt >= 1.5;
    sim.flowAtSensor = sim.sourceAvailable && transportComplete;
    if (sim.flowAtSensor) sim.noFlowElapsed = 0;
    else sim.noFlowElapsed += dt;
    if (sim.elapsed < 0.75) sim.current = 22 - sim.elapsed * 7;
    else if (!sim.sourceAvailable) sim.current = 6.2 + Math.sin(simTime * 2) * 0.1;
    else sim.current = (sim.flowAtSensor ? 8.6 : 9.1) + Math.sin(simTime * 2.4) * 0.16;
    if (sim.noFlowElapsed >= 10) trip('DRY_RUN');
  }

  function updateVisuals() {
    const running = sim.pumpCommand;
    world.contactor.actuator.position.z = running ? 0.45 : 0.53;
    world.contactor.coilLed.material.emissiveIntensity = running ? 2.5 : 0.08;
    [world.enclosure.ssr1.status, world.enclosure.ssr2.status].forEach(status => { status.material.emissiveIntensity = running ? 2 : 0.08; });
    world.pumpFan.rotation.x = running ? simTime * 8 : 0;
    world.pumpLed.material.color.setHex(sim.fault ? C.red : running ? C.green : C.dark);
    world.pumpLed.material.emissive.setHex(sim.fault ? C.red : running ? C.green : C.dark);
    world.pumpLed.material.emissiveIntensity = sim.fault || running ? 1.8 : 0.2;
    const waterColor = sim.flowAtSensor ? C.green : C.red;
    world.waterSensor.status.material.color.setHex(waterColor);
    world.waterSensor.status.material.emissive.setHex(waterColor);
    world.waterSensor.status.material.emissiveIntensity = sim.flowAtSensor ? 1.8 : 0.25;
    world.wellWaterMeshes.forEach(mesh => { mesh.visible = running && sim.sourceAvailable; });
    world.mainWaterMeshes.forEach(mesh => { mesh.visible = sim.flowAtSensor; });
    world.lateralWaterMeshes.forEach(mesh => { mesh.visible = sim.flowAtSensor; });
    world.dripMarkers.forEach(marker => { marker.visible = sim.flowAtSensor; });
    world.flowMarkers.forEach(({ mesh, offset }) => {
      mesh.visible = sim.flowAtSensor;
      if (mesh.visible) mesh.position.copy(pointOnFlow(offset + simTime / DURATION));
    });
    world.canopies.forEach(({ group, phase }) => { group.rotation.z = Math.sin(simTime / DURATION * Math.PI * 2 + phase) * 0.018; });
    world.router.status.material.emissiveIntensity = 1.2 + (1 + Math.sin(simTime / DURATION * Math.PI * 4)) * 0.5;
  }

  function updateUI() {
    updateConnection();
    const running = sim.pumpCommand;
    const flow = sim.flowAtSensor;
    const fault = sim.fault;
    $('phone-location').textContent = farmerLocation();
    $('connection-pill').textContent = viewState.connection;
    $('connection-pill').classList.toggle('cellular', viewState.connection === '5G');
    $('event-connection').textContent = viewState.connection;
    $('phone-connection-note').textContent = viewState.connection === 'Wi-Fi'
      ? 'Near the control-room router: local Wi-Fi control.'
      : 'Away from the router: remote 5G control through the internet.';
    $('phone-pump-state').textContent = fault === 'DRY_RUN' ? 'DRY-RUN STOP' : fault === 'HIGH_LOAD' ? 'HIGH-LOAD STOP' : running ? (flow ? 'RUNNING • FLOW OK' : 'RUNNING • NO FLOW') : 'OFF • NO FLOW';
    $('phone-pump-dot').className = `phone-pump-dot${fault ? ' fault' : running ? ' running' : ''}`;
    $('phone-water').textContent = flow ? 'FLOW DETECTED' : 'NO FLOW';
    $('phone-water-detail').textContent = flow ? 'Confirmed at the control-room main line' : running ? 'Waiting for water at the sensor' : 'Pump is stopped';
    $('phone-current').textContent = `${sim.current.toFixed(1)} A`;
    $('no-flow-panel').hidden = !running || flow;
    $('no-flow-time').textContent = `${sim.noFlowElapsed.toFixed(1)} / 10 s`;
    $('no-flow-progress').style.width = `${Math.min(100, sim.noFlowElapsed * 10)}%`;
    $('fault-banner').hidden = !fault;
    if (fault) {
      $('fault-title').textContent = fault === 'DRY_RUN' ? 'DRY-RUN PROTECTION TRIP' : 'HIGH-LOAD PROTECTION TRIP';
      $('fault-detail').textContent = fault === 'DRY_RUN'
        ? 'No water was detected for 10 seconds. K1 is open and the pump cannot restart until reset.'
        : `Current reached ${sim.lastTripCurrent?.toFixed(1) || '32.0'} A. K1 opened immediately; the fault is latched.`;
    }
    $('phone-start').disabled = running || Boolean(fault);
    $('phone-stop').disabled = !running;
    $('phone-reset').disabled = !fault;
    $('high-load').disabled = !running;
    $('source-toggle').setAttribute('aria-pressed', String(sim.sourceAvailable));
    $('source-label').textContent = sim.sourceAvailable ? 'Water available' : 'Well empty • no water';
    $('farm-perf').textContent = `${viewState.calls} calls · ${Math.round(viewState.triangles / 1000)}k tris`;
  }

  $('phone-start').addEventListener('click', startPump);
  $('phone-stop').addEventListener('click', stopPump);
  $('phone-reset').addEventListener('click', resetFault);
  $('source-toggle').addEventListener('click', () => {
    sim.sourceAvailable = !sim.sourceAvailable; sim.sourceChangedAt = simTime; sim.noFlowElapsed = 0;
    addEvent(sim.sourceAvailable ? 'Well source restored — flow must be proven again.' : 'Well source emptied — no-flow timer is active while running.');
    updateUI();
  });
  $('high-load').addEventListener('click', () => { if (sim.pumpCommand) trip('HIGH_LOAD', 32); });
  $('reset-simulation').addEventListener('click', () => {
    Object.assign(sim, { pumpCommand: false, sourceAvailable: true, flowAtSensor: false, current: 0, elapsed: 0, noFlowElapsed: 0, sourceChangedAt: simTime, fault: null, lastTripCurrent: null });
    addEvent('Complete simulation reset — pump off, well available, no flow.'); updateUI();
  });
  document.querySelectorAll('.location-button').forEach(button => button.addEventListener('click', () => setCamera(button.dataset.camera)));

  const dialog = $('farm-dialog');
  $('farm-help').addEventListener('click', () => dialog.showModal());
  ['farm-dialog-close', 'farm-dialog-done'].forEach(id => $(id).addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  addEventListener('keydown', event => {
    if (dialog.open || /INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) return;
    if (movementCodes.has(event.code)) {
      event.preventDefault(); movementKeys.add(event.code);
      if (viewState.cameraMode !== 'walk') setCamera('walk');
    }
    if (event.code === 'Space') { event.preventDefault(); sim.pumpCommand ? stopPump() : startPump(); }
  });
  addEventListener('keyup', event => { movementKeys.delete(event.code); });
  document.querySelectorAll('[data-move]').forEach(button => {
    button.addEventListener('pointerdown', event => { event.preventDefault(); movementKeys.add(button.dataset.move); button.setPointerCapture(event.pointerId); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, () => movementKeys.delete(button.dataset.move)));
  });
  renderer.domElement.addEventListener('pointerdown', event => { if (viewState.cameraMode === 'walk') dragLook = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointermove', event => {
    if (!dragLook || viewState.cameraMode !== 'walk') return;
    yaw -= (event.clientX - dragLook.x) * 0.005;
    lookPitch = THREE.MathUtils.clamp(lookPitch + (event.clientY - dragLook.y) * 0.002, 0.05, 0.7);
    dragLook = { x: event.clientX, y: event.clientY };
  });
  addEventListener('pointerup', () => { dragLook = null; });

  function draw(dt = 0) {
    if (viewState.cameraMode === 'walk') updateWalking(dt);
    else if (cameraGoal) {
      const blend = dt ? 1 - Math.exp(-dt * 6) : 1;
      camera.position.lerp(cameraGoal.position, blend); controls.target.lerp(cameraGoal.target, blend);
      if (camera.position.distanceTo(cameraGoal.position) < 0.02) { camera.position.copy(cameraGoal.position); controls.target.copy(cameraGoal.target); cameraGoal = null; }
    }
    controls.update(); renderer.render(scene, camera);
    viewState.calls = renderer.info.render.calls; viewState.triangles = renderer.info.render.triangles;
    $('farm-hud').textContent = `t ${simTime.toFixed(2)} · ${viewState.calls} calls · ${viewState.triangles} tris`;
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(container); resize(); setCamera('overview', true);

  let previous = performance.now(), lastUI = 0;
  function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.06); previous = now; simTime += dt;
    updateSim(dt); updateVisuals(); draw(dt);
    if (now - lastUI > 100) { updateUI(); lastUI = now; }
  }
  function advance(seconds) {
    const steps = Math.max(1, Math.ceil(seconds / 0.05));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) { simTime += dt; updateSim(dt); }
    updateVisuals(); draw(0); updateUI();
  }
  updateSim(0); updateVisuals(); draw(0); updateUI();
  addEvent('System ready — pump off, 0 A, no flow detected.');
  await Promise.all([...document.images].map(img => img.complete ? img.decode().catch(() => {}) : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
  if (CAPTURE) poster.hidden = true; else poster.classList.add('ready');
  if (!CAPTURE) renderer.setAnimationLoop(frame);
  window.__seek = time => {
    renderer.setAnimationLoop(null); simTime = Number.isFinite(Number(time)) ? Number(time) : 0;
    cameraGoal = null; updateSim(0); updateVisuals(); draw(0); updateUI();
  };
  window.__play = () => { previous = performance.now(); renderer.setAnimationLoop(frame); };
  if (CAPTURE) window.__seek(Number(params.get('t')) || 0);
  window.__TRITONIS_FARM__ = {
    api: {
      startPump, stopPump, resetFault, setCamera, advance,
      getState: () => ({ ...sim, ...viewState, farmer: world.farmer.group.position.toArray(), location: farmerLocation() })
    },
    scene, camera, renderer, controls, world
  };
  window.__SCENE_READY__ = true;
}

boot().catch(error => {
  console.error(error); window.__SCENE_ERROR__ = String(error);
  poster.querySelector('p').textContent = 'The farm could not start. Please reload with WebGL enabled.';
});
