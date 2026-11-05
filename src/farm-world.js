import * as THREE from 'three';
import {
  box, cyl, cable, material, label, textTexture, worldPos,
  createEnclosure, createContactor, createCurrentSensor, createWaterSensor, C, M
} from './models.js';

const UP = new THREE.Vector3(0, 1, 0);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

function seeded(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function billboard(text, width = 4.2, accent = '#0d6670') {
  const texture = textTexture(text, {
    bg: '#f8faf6', fg: accent, size: 64, weight: 800,
    border: '#9fb4aa', aspect: width / 0.55
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: false
  }));
  sprite.scale.set(width, 0.55, 1);
  sprite.renderOrder = 12;
  return sprite;
}

function pipeBetween(a, b, radius, outerMaterial, innerMaterial, collection) {
  const direction = b.clone().sub(a);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 24), outerMaterial);
  outer.position.copy(a).add(b).multiplyScalar(0.5);
  outer.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
  outer.castShadow = true;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, direction.length() * 0.985, 18), innerMaterial);
  inner.position.copy(outer.position);
  inner.quaternion.copy(outer.quaternion);
  collection.push(outer);
  return { outer, inner };
}

function createRouter() {
  const group = new THREE.Group();
  group.add(box(1.05, 0.22, 0.72, M.white, 0, 0, 0, 0.06));
  group.add(box(0.8, 0.035, 0.48, material(0xd9e1dc, 0.6), 0, 0.125, 0, 0.02));
  [-0.35, 0.35].forEach(x => {
    const antenna = cyl(0.035, 0.95, M.dark, x, 0.48, -0.25, 16);
    antenna.rotation.z = x < 0 ? -0.16 : 0.16;
    group.add(antenna);
  });
  const status = cyl(0.045, 0.025, new THREE.MeshStandardMaterial({
    color: C.green, emissive: C.green, emissiveIntensity: 1.5, roughness: 0.35
  }), 0.3, 0.15, 0.22, 16);
  group.add(status);
  const name = label('WI-FI ROUTER\nINTERNET + MQTT', 0.9, 0.3, { fg: '#153c43', size: 54, weight: 800 });
  name.position.set(0, -0.25, 0.37);
  group.add(name);
  return { group, status };
}

function createFarmer() {
  const group = new THREE.Group();
  const skin = material(0xa86f4f, 0.82);
  const shirt = material(0x2c7180, 0.85);
  const trousers = material(0x273b46, 0.9);
  const hatMat = material(0xd4b681, 0.9);
  group.add(cyl(0.28, 0.85, shirt, 0, 1.25, 0, 20));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 14), skin);
  head.position.y = 1.9; head.castShadow = true; group.add(head);
  group.add(cyl(0.34, 0.07, hatMat, 0, 2.1, 0, 24));
  group.add(cyl(0.23, 0.2, hatMat, 0, 2.19, 0, 24));
  const leftLeg = cyl(0.095, 0.8, trousers, -0.13, 0.45, 0, 14);
  const rightLeg = cyl(0.095, 0.8, trousers, 0.13, 0.45, 0, 14);
  group.add(leftLeg, rightLeg);
  const leftArm = cyl(0.07, 0.72, shirt, -0.36, 1.28, 0, 14);
  const rightArm = cyl(0.07, 0.72, shirt, 0.36, 1.28, 0, 14);
  leftArm.rotation.z = -0.14; rightArm.rotation.z = 0.14;
  group.add(leftArm, rightArm);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group, leftLeg, rightLeg, leftArm, rightArm };
}

export function createFarmWorld(logoTexture) {
  const group = new THREE.Group();
  const random = seeded(41023);
  const canopies = [];
  const colliders = [];
  const outerPipes = [];
  const wellWaterMeshes = [];
  const mainWaterMeshes = [];
  const lateralWaterMeshes = [];
  const flowMarkers = [];
  const dripMarkers = [];

  const grass = material(0x70865c, 0.98);
  const soil = material(0x8a6848, 1);
  const gravel = material(0xb4aa91, 1);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(76, 62), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const servicePath = box(58, 0.035, 2.4, gravel, 0, 0.025, 16.2, 0.02);
  servicePath.receiveShadow = true; group.add(servicePath);
  const wellPath = box(2.4, 0.035, 34, gravel, -23, 0.025, -1, 0.02);
  wellPath.receiveShadow = true; group.add(wellPath);
  const powerPath = box(53, 0.025, 1.1, material(0x91866f, 1), 0.5, 0.02, -20.2, 0.01);
  group.add(powerPath);

  // Five irrigated olive rows; each drip line is offset from every trunk.
  const columns = [-12, -6, 0, 6, 12];
  const rows = [-10, -5, 0, 5, 10];
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.31, 1.75, 12);
  const trunkMaterial = material(0x66513c, 1);
  const leafGeometry = new THREE.IcosahedronGeometry(1.2, 2);
  const leafMaterials = [material(0x526f51, 0.95), material(0x698264, 0.95), material(0x78906e, 0.95)];
  columns.forEach((x, columnIndex) => {
    const strip = box(2.25, 0.045, 26, soil, x, 0.035, 0, 0.03);
    strip.receiveShadow = true; group.add(strip);
    rows.forEach((z, rowIndex) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 0.88; trunk.castShadow = true; tree.add(trunk);
      const canopy = new THREE.Group();
      canopy.position.y = 2.15;
      for (let i = 0; i < 4; i++) {
        const leaves = new THREE.Mesh(leafGeometry, leafMaterials[(columnIndex + rowIndex + i) % leafMaterials.length]);
        leaves.scale.set(1.0 + random() * 0.28, 0.72 + random() * 0.18, 0.9 + random() * 0.28);
        leaves.position.set((i % 2 ? 0.65 : -0.65) * (i < 2 ? 1 : 0.45), (i > 1 ? 0.58 : 0), (i < 2 ? 0.2 : -0.45));
        leaves.castShadow = true; canopy.add(leaves);
      }
      tree.add(canopy); canopies.push({ group: canopy, phase: random() * Math.PI * 2 });
      group.add(tree);
      colliders.push({ x, z, radius: 0.58 });
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0x65d5e8 }));
      drip.position.set(x + 0.45, 0.24, z);
      drip.visible = false; group.add(drip); dripMarkers.push(drip);
    });
  });

  // Distant well and its local pump.
  const well = new THREE.Group(); well.position.set(-20, 0, -12); group.add(well);
  well.add(cyl(2.05, 0.58, material(0x9b9688, 0.95), 0, 0.29, 0, 40));
  well.add(cyl(1.55, 0.06, material(0x245c6c, 0.3), 0, 0.61, 0, 40));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.25, 12, 40), material(0xb7b0a0, 0.95));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.65; rim.castShadow = true; well.add(rim);
  [-1.55, 1.55].forEach(x => well.add(box(0.18, 2.7, 0.18, M.dark, x, 1.85, 0, 0.025)));
  const wellRoof = box(4.1, 0.18, 3.1, material(0x57686a, 0.75), 0, 3.25, 0, 0.035);
  wellRoof.rotation.z = -0.08; well.add(wellRoof);
  colliders.push({ x: -20, z: -12, radius: 2.3 });

  const pump = new THREE.Group(); pump.position.set(-16.7, 0.82, -9.6); group.add(pump);
  const pumpBody = cyl(0.62, 1.3, M.teal, 0, 0, 0, 36); pumpBody.rotation.z = Math.PI / 2; pump.add(pumpBody);
  pump.add(box(1.55, 0.16, 1.05, M.dark, 0, -0.68, 0, 0.035));
  const pumpFan = new THREE.Group(); pumpFan.position.x = 0.7; pump.add(pumpFan);
  const fanRim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 10, 30), M.dark);
  fanRim.rotation.y = Math.PI / 2; pumpFan.add(fanRim);
  for (let i = 0; i < 6; i++) {
    const blade = box(0.05, 0.34, 0.11, M.steel, 0, 0.22, 0, 0.02);
    blade.rotation.x = i * Math.PI / 3; pumpFan.add(blade);
  }
  const pumpLed = cyl(0.07, 0.04, new THREE.MeshStandardMaterial({ color: C.dark, emissive: C.dark, emissiveIntensity: 0.2 }), 0, 0.66, 0, 16);
  pump.add(pumpLed);

  const wellSign = billboard('WELL + DISTANT PUMP', 4.5); wellSign.position.set(-19, 4.35, -11); group.add(wellSign);

  // Open-front control shelter keeps all electronics visibly together.
  const wallMat = material(0xb9b6a6, 0.95);
  group.add(box(7.2, 3.9, 0.25, wallMat, 18, 1.95, 10.25, 0.04));
  group.add(box(7.7, 0.18, 4.7, material(0x596b6c, 0.75), 18, 4.12, 12.25, 0.035));
  [14.55, 21.45].forEach(x => group.add(box(0.18, 4.1, 0.18, M.dark, x, 2.05, 13.9, 0.025)));
  const enclosure = createEnclosure(logoTexture);
  enclosure.group.scale.setScalar(0.45); enclosure.group.position.set(15.9, 2.2, 10.62); group.add(enclosure.group);
  const contactor = createContactor();
  contactor.group.scale.setScalar(0.65); contactor.group.position.set(18.15, 2.02, 10.68); group.add(contactor.group);
  const router = createRouter(); router.group.position.set(20.25, 2.45, 10.78); group.add(router.group);
  const routerPosition = v(20.25, 2.45, 10.78);
  const controlSign = billboard('CONTROL ROOM • CONTROLLER + K1 + WI-FI', 6.5);
  controlSign.position.set(18, 5.0, 11.3); group.add(controlSign);

  // Transparent water network: separated from the electrical perimeter route.
  const pipeOuter = new THREE.MeshPhysicalMaterial({
    color: 0xd9ebe5, transparent: true, opacity: 0.34, roughness: 0.18,
    metalness: 0, depthWrite: false, side: THREE.DoubleSide
  });
  const waterInner = new THREE.MeshStandardMaterial({
    color: 0x2b9fc2, emissive: 0x0b5b72, emissiveIntensity: 0.22,
    transparent: true, opacity: 0.82, roughness: 0.2
  });
  const mainSegments = [
    [v(-16.7, 0.67, -8.95), v(-18, 0.67, -8.95)],
    [v(-18, 0.67, -8.95), v(-18, 0.67, 14)],
    [v(-18, 0.67, 14), v(16, 0.67, 14)]
  ];
  mainSegments.forEach(([a, b], index) => {
    const { outer, inner } = pipeBetween(a, b, 0.2, pipeOuter, waterInner, outerPipes);
    group.add(outer, inner);
    (index === 2 ? mainWaterMeshes : wellWaterMeshes).push(inner);
  });
  columns.forEach(x => {
    const a = v(x + 0.45, 0.54, 14), b = v(x + 0.45, 0.54, -13.2);
    const { outer, inner } = pipeBetween(a, b, 0.085, pipeOuter, waterInner, outerPipes);
    group.add(outer, inner); lateralWaterMeshes.push(inner);
    const tee = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), pipeOuter);
    tee.position.copy(a); group.add(tee);
  });

  const waterSensor = createWaterSensor();
  waterSensor.group.scale.setScalar(0.72); waterSensor.group.position.set(15.4, 0.92, 14); group.add(waterSensor.group);
  const sensorSign = billboard('WATER SENSOR • MAIN LINE', 3.5);
  sensorSign.position.set(14.6, 1.8, 14.2); group.add(sensorSign);
  const pipeSign = billboard('TRANSPARENT IRRIGATION MAIN', 4.6);
  pipeSign.position.set(-1, 1.45, 14); group.add(pipeSign);

  // Short, separated sensor leads remain inside the control area.
  group.updateMatrixWorld(true);
  const ct = createCurrentSensor();
  ct.group.scale.setScalar(0.38); ct.group.rotation.x = Math.PI / 2;
  ct.group.position.copy(worldPos(contactor.t[0])).add(v(0, -0.38, 0)); group.add(ct.group);
  group.updateMatrixWorld(true);
  const ctPort = worldPos(enclosure.currentPort), waterPort = worldPos(enclosure.waterPort);
  const ctStart = worldPos(ct.cableAnchor), waterStart = worldPos(waterSensor.cableAnchor);
  group.add(cable([
    ctStart, v(17.1, 0.85, 11.35), v(16.25, 1.05, 11.35), ctPort
  ], C.blue, 0.026, 'farmCTLead'));
  group.add(cable([
    waterStart, v(15.4, 0.45, 13.2), v(16.35, 0.45, 12.0), waterPort
  ], C.yellow, 0.028, 'farmWaterLead'));

  // One three-phase pump-power cable; no other electrical run crosses the farm.
  const powerStart = worldPos(contactor.t[2]);
  const powerPoints = [
    powerStart,
    v(21.85, 0.95, powerStart.z),
    v(22.35, 4.5, 10.6),
    v(22.35, 4.5, -18),
    v(-18, 4.5, -18),
    v(-16.7, 1.45, -9.6)
  ];
  group.add(cable(powerPoints, C.black, 0.075, 'pumpPowerRoute'));
  const poleMat = material(0x5d5548, 0.95);
  const polePositions = [
    ...[8, 0, -8, -16].map(z => [22.35, z]),
    ...[14, 4, -6, -16].map(x => [x, -18])
  ];
  polePositions.forEach(([x, z]) => {
    group.add(cyl(0.11, 4.55, poleMat, x, 2.27, z, 14));
    group.add(box(0.8, 0.1, 0.12, M.dark, x, 4.48, z, 0.02));
  });
  const powerSign = billboard('PUMP POWER ONLY • SEPARATE ROUTE', 5.3, '#79513a');
  powerSign.position.set(4, 5.25, -18); group.add(powerSign);

  // Flow particles follow the main line; row drips confirm water at the trees.
  const flowMat = new THREE.MeshBasicMaterial({ color: 0xb5f1ef });
  for (let i = 0; i < 18; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), flowMat);
    group.add(drop); flowMarkers.push({ mesh: drop, offset: i / 18 });
  }

  const farmer = createFarmer(); farmer.group.position.set(17, 0, 15); group.add(farmer.group);

  // Low-contrast distant terrain closes the horizon without obscuring the farm.
  for (let i = 0; i < 10; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(8 + (i % 3) * 2, 20, 10), material(0x809074, 1));
    hill.scale.y = 0.22; hill.position.set(-45 + i * 10, -0.7, -48 - (i % 2) * 8); group.add(hill);
  }

  return {
    group, enclosure, contactor, router, routerPosition, waterSensor, pumpFan, pumpLed,
    wellWaterMeshes, mainWaterMeshes, lateralWaterMeshes, flowMarkers, dripMarkers,
    farmer, canopies, colliders,
    signs: [wellSign, controlSign, sensorSign, pipeSign, powerSign]
  };
}
