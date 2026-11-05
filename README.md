# Tritonis Installation Lab and Real Farm

Investor-facing Three.js visualization of the Tritonis smart irrigation pump controller, with two separately selectable experiences on the same website.

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

The multi-page build emits both `dist/index.html` and `dist/farm.html`.

## Experiences

### Installation — `index.html`

- Closed branded enclosure with a pure white logo panel
- Two internal SSR-40DA-H-class bodies with only covered upper AC terminal rows accessible
- Two-phase coil circuit: L1 → SSR1 → A1 and L2 → SSR2 → A2
- Separated coil, mains and sensor routes, with three individual motor terminals
- Three-pole contactor with a 380/400 V AC line-to-line coil and motor overload
- Bottom-facing current-transformer jack with a blue external cable
- Bottom-facing flat white four-pin water connector with a yellow external cable
- SCT-013-030 clamp on one T1 load conductor
- XKC-Y25-NPN sensor on a non-metallic PVC pipe section
- Nine-step guided installation, selectable components, camera presets, dismissible view captions and wiring/label toggles
- Pump, current and water-flow simulation; stopped means 0 A and no active flow
- Desktop and mobile layouts; no enclosure cutaway

### Real farm — `farm.html`

- Procedural olive farm with 25 trees, a distant well and a local pump
- Open-front control shelter containing the controller, contactor and Wi-Fi router together
- Transparent water main and irrigation laterals, with visible moving water and tree drip indicators
- Separate elevated pump-power route; sensor feedback leads remain inside the control area
- Third-person farmer travel with keyboard, touch direction pad, collision checks and camera look controls
- Overview, well teleport and control-room teleport camera presets
- Phone interface with Wi-Fi near the router and 5G in the field or at the well
- Remote pump start/stop, water-flow feedback and SCT-013-030 current readings
- Water transport delay, inrush current, 10-second dry-run trip and immediate 32 A high-load trip
- Latched faults with deliberate reset; reset never restarts the pump automatically
- Event log and controls for empty-well and high-load scenarios

## Controls

**Installation:** drag to orbit, scroll/pinch to zoom, and select a component for details. Keyboard: **Space** run/stop, **W** wiring, **R** reset camera, **Esc** exit guide.

**Farm:** use the camera buttons to orbit or teleport. Choose **Walk farm**, then use **WASD** or the arrow keys; drag the scene to look around. On touch devices, hold the on-screen direction buttons. The phone remains usable in either connection state.

## Design basis and limits

The demonstrated configuration uses a **380/400 V AC coil fed line-to-line**, with **one SSR in each phase**, and an **NPN XKC-Y25**. The SSR concept uses the high-voltage **SSR-40DA-H class (90–480 V AC output)** rather than the photographed standard 24–380 V AC version. Final purchased components, coil burden, leakage behavior and supply tolerance still require verification.

The SCT-013-030 is the 30 A : 1 V variant with an internal burden. The concept includes a biased/protected ADC front end and does not connect its AC output directly to an ESP32 pin. The NPN water input uses a common ground and 3.3 V pull-up.

Both experiences are frontend-only simulations. No measurements, commands or settings are sent to a real pump or stored on a server. This is an engineering visualization, not a certified wiring diagram or safety-rated controller. A qualified electrical review must validate coil suppression, SSR leakage and minimum load, two-phase isolation behavior, mains protection, earthing, thermal performance, creepage/clearance, EMC, connector ingress and local regulations before fabrication or installation.

## Source layout

- `index.html`, `src/scene.js`, `src/ui.js`, `src/styles.css` — installation experience
- `farm.html`, `src/farm.js`, `src/farm-world.js`, `src/farm.css` — real-farm experience
- `src/models.js` — shared procedural enclosure, contactor, sensors and geometry helpers
- `src/data.js` — installation view presets and guided content
- `vite.config.js` — multi-page production build
- `public/tritonis-logo.png` — user-supplied Tritonis brand asset

All hardware, farm assets and wires are generated procedurally with Three.js. No third-party model assets are used.
