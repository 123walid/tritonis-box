import { VIEWS, STEPS, COMPONENT_NOTES } from './data.js';

const $ = id => document.getElementById(id);

export function createUI(api) {
  let toastTimer;
  let demoToken = 0;
  let demoActive = false;
  let currentStep = -1;
  const nav = $('view-nav');
  Object.entries(VIEWS).forEach(([id, view], i) => {
    const b = document.createElement('button');
    b.className = 'view-button'; b.dataset.view = id;
    b.innerHTML = `<span class="view-number">0${i + 1}</span><span class="view-label">${view.short}</span>`;
    b.setAttribute('aria-label', view.label);
    b.addEventListener('click', () => { cancelDemo(); currentStep = -1; api.setStep(-1); api.setView(id); updateGuide(); });
    nav.appendChild(b);
  });

  const dots = $('step-dots');
  STEPS.forEach((step, i) => {
    const b = document.createElement('button'); b.className = 'step-dot';
    b.setAttribute('aria-label', `Step ${i + 1}: ${step.title}`); b.title = `${i + 1}. ${step.title}`;
    b.addEventListener('click', () => { cancelDemo(); currentStep = i; api.setStep(i); updateGuide(); });
    dots.appendChild(b);
  });

  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
  }
  function cancelDemo() { demoToken++; demoActive = false; $('demo-button').innerHTML = '<span class="mini-dot demo"></span>Auto demo'; }
  function startGuide() { cancelDemo(); currentStep = 0; api.setStep(0); updateGuide(); }
  function exitGuide() { currentStep = -1; api.setStep(-1); api.setView('overview'); updateGuide(); }

  $('guide-start').addEventListener('click', startGuide);
  $('step-exit').addEventListener('click', exitGuide);
  $('step-prev').addEventListener('click', () => { if (currentStep > 0) { currentStep--; api.setStep(currentStep); updateGuide(); } });
  $('step-next').addEventListener('click', () => {
    if (currentStep < STEPS.length - 1) { currentStep++; api.setStep(currentStep); updateGuide(); }
    else { api.setWater(true); api.setPump(true); toast('Commissioning sequence complete — pump running with feedback.'); exitGuide(); }
  });

  $('pump-toggle').addEventListener('click', () => { cancelDemo(); api.setPump(!api.getState().pumpCommand); });
  $('water-toggle').addEventListener('click', () => {
    cancelDemo(); const next = !api.getState().waterPresent; api.setWater(next);
    toast(next ? 'Water detected. The pump can be restarted.' : 'No water detected — dry-run stop latched.');
  });
  $('demo-button').addEventListener('click', () => {
    if (demoActive) { cancelDemo(); api.setPump(false); toast('Auto demo stopped.'); return; }
    demoActive = true; const token = ++demoToken;
    $('demo-button').textContent = 'Stop demo';
    currentStep = -1; api.setStep(-1); api.setView('overview'); updateGuide();
    api.setWater(true); api.setPump(false); toast('Demo: water available, system ready.');
    const later = (ms, fn) => setTimeout(() => { if (token === demoToken) fn(); }, ms);
    later(700, () => { api.setPump(true); toast('Both SSR channels ON — K1 closes.'); });
    later(3000, () => { api.setWater(false); toast('Flow lost — dry-run protection stops the pump.'); });
    later(5100, () => { api.setWater(true); toast('Water restored. Restart remains under operator control.'); });
    later(6500, () => { api.setPump(true); cancelDemo(); });
  });

  $('wires-toggle').addEventListener('click', () => { const on = !api.getState().wires; api.setWires(on); });
  $('labels-toggle').addEventListener('click', () => { const on = !api.getState().labels; api.setLabels(on); });
  $('reset-view').addEventListener('click', () => { api.resetView(); $('scene-caption').hidden = false; toast('Camera reset.'); });
  $('caption-close').addEventListener('click', () => { $('scene-caption').hidden = true; });
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); exitGuide(); });

  const dialog = $('notes-dialog');
  $('engineering-notes').innerHTML = COMPONENT_NOTES.map(n => `<div class="note-item"><h3>${n.title}</h3><p>${n.text}</p></div>`).join('');
  $('help-button').addEventListener('click', () => dialog.showModal());
  ['notes-close', 'notes-done'].forEach(id => $(id).addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  addEventListener('keydown', e => {
    if (dialog.open || /INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) return;
    if (e.code === 'Space') { e.preventDefault(); cancelDemo(); api.setPump(!api.getState().pumpCommand); }
    if (e.key.toLowerCase() === 'w') api.setWires(!api.getState().wires);
    if (e.key.toLowerCase() === 'r') api.resetView();
    if (e.key === 'Escape' && currentStep >= 0) exitGuide();
  });

  function updateGuide() {
    const active = currentStep >= 0;
    $('guide-start').hidden = active; $('step-prev').hidden = !active;
    $('step-next').hidden = !active; $('step-exit').hidden = !active;
    $('step-prev').disabled = currentStep <= 0;
    $('step-next').textContent = currentStep === STEPS.length - 1 ? 'Finish & run' : 'Next step';
    [...dots.children].forEach((d, i) => { d.classList.toggle('active', i === currentStep); d.classList.toggle('done', currentStep >= 0 && i < currentStep); });
    if (!active) {
      $('step-count').textContent = 'Overview'; $('step-kicker').textContent = 'Explore the system';
      $('step-title').textContent = 'From controller to field feedback';
      $('step-body').textContent = 'Start the guided sequence for a terminal-by-terminal installation, or orbit the complete system freely.';
      $('step-checks').innerHTML = '';
    } else {
      const s = STEPS[currentStep]; $('step-count').textContent = `Step ${currentStep + 1} of ${STEPS.length}`;
      $('step-kicker').textContent = s.kicker; $('step-title').textContent = s.title; $('step-body').textContent = s.body;
      $('step-checks').innerHTML = s.checks.map(c => `<li>${c}</li>`).join('');
    }
  }

  function showComponent(data) {
    if (!data) return;
    $('component-title').textContent = data.title; $('component-body').textContent = data.body;
    $('component-specs').innerHTML = (data.specs || []).map(s => `<li>${s}</li>`).join('');
    if (matchMedia('(max-width: 520px)').matches) toast(data.title);
  }

  let lastView = '';
  function update(state) {
    const running = state.pumpRunning;
    $('run-badge').textContent = running ? 'RUNNING' : (!state.waterPresent ? 'DRY-RUN STOP' : 'STANDBY');
    $('run-badge').className = `run-badge${running ? ' running' : (!state.waterPresent ? ' fault' : '')}`;
    $('coil-value').textContent = running ? 'CLOSED • 380/400 V AC' : 'OPEN';
    $('current-value').textContent = `${state.current.toFixed(1)} A`;
    $('water-value').textContent = state.waterPresent ? 'PRESENT' : 'NOT DETECTED';
    $('ssr-value').textContent = running ? 'ON / ON' : 'OFF / OFF';
    $('pump-toggle').classList.toggle('stop', state.pumpCommand);
    $('pump-toggle').innerHTML = `<span class="button-icon">${state.pumpCommand ? '■' : '▶'}</span><span>${state.pumpCommand ? 'Stop irrigation' : 'Run irrigation'}</span>`;
    $('water-toggle').setAttribute('aria-pressed', String(state.waterPresent));
    $('water-toggle').innerHTML = `<span class="mini-dot water"></span>${state.waterPresent ? 'Water present' : 'Water absent'}`;
    $('interlock-note').textContent = !state.waterPresent ? 'Dry-run stop is latched. Restore water, then restart deliberately.' : 'Dry-run protection is armed. Both SSR channels operate together.';
    $('wires-toggle').classList.toggle('active', state.wires); $('wires-toggle').setAttribute('aria-pressed', String(state.wires));
    $('labels-toggle').classList.toggle('active', state.labels); $('labels-toggle').setAttribute('aria-pressed', String(state.labels));
    $('perf').textContent = `${state.calls} calls · ${Math.round(state.triangles / 1000)}k tris`;
    if (state.view !== lastView) {
      lastView = state.view; const v = VIEWS[state.view];
      $('view-name').textContent = v.label; $('view-note').textContent = v.note;
      $('scene-caption').hidden = false;
      $('caption-close').setAttribute('aria-label', `Close ${v.label.toLowerCase()}`);
      document.querySelectorAll('.view-button').forEach(b => { const on = b.dataset.view === state.view; b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    }
  }

  updateGuide();
  return { update, showComponent, toast };
}
