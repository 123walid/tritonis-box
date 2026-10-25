# Tritonis Installation Lab

Investor-facing Three.js visualization of the revised Tritonis smart irrigation pump controller.

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Included

- Closed branded enclosure with a pure white logo panel
- Two internal SSR-40DA-H-class bodies with only covered upper AC terminal rows accessible
- Two-phase coil circuit: L1 → SSR1 → A1 and L2 → SSR2 → A2
- Three-pole contactor with a 380/400 V AC line-to-line coil and motor overload
- Bottom-facing current-transformer jack with a blue external cable
- Bottom-facing flat white four-pin water connector with a yellow external cable
- SCT-013-030 clamp on one T1 load conductor
- XKC-Y25-NPN sensor on a non-metallic PVC pipe section
- Nine-step guided installation, selectable components, camera presets and wiring/label toggles
- Pump, current, water-flow and dry-run-stop simulation
- Desktop and mobile layouts; no enclosure cutaway

## Controls

Drag to orbit, scroll/pinch to zoom, and select a component for details. Keyboard: **Space** run/stop, **W** wiring, **R** reset camera, **Esc** exit guide.

## Design basis and limits

The demonstrated configuration uses a **380/400 V AC coil fed line-to-line**, with **one SSR in each phase**, and an **NPN XKC-Y25**. The SSR concept uses the high-voltage **SSR-40DA-H class (90–480 V AC output)** rather than the photographed standard 24–380 V AC version. FOTEK's SSR-DA series listing documents this high-voltage variant. Final purchased components, coil burden, leakage behavior and supply tolerance still require verification.

The SCT-013-030 is the 30 A : 1 V variant with an internal burden. The concept includes a biased/protected ADC front end and does not connect its AC output directly to an ESP32 pin. The NPN water input uses a common ground and 3.3 V pull-up.

This is an engineering visualization, not a certified wiring diagram or safety-rated controller. A qualified electrical review must validate coil suppression, SSR leakage and minimum load, two-phase isolation behavior, mains protection, earthing, thermal performance, creepage/clearance, EMC, connector ingress and local regulations before fabrication or installation.

## Source layout

- `src/models.js` — procedural enclosure, SSR, contactor, sensor and environment geometry
- `src/scene.js` — wiring, camera, picking, animation and simulation state
- `src/data.js` — view presets and installation content
- `src/ui.js` — controls and accessible DOM interface
- `src/styles.css` — responsive presentation
- `public/tritonis-logo.png` — user-supplied Tritonis brand asset

All hardware models and wires are generated procedurally with Three.js. No third-party model assets are used.
