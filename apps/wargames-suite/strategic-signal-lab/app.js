// app.js — Main controller for Strategic Signal Lab

(function () {
  'use strict';

  const { SCENARIOS, INTERVENTIONS } = window.ScenarioSystem;
  const { ActorSystem } = window;
  const Sim = window.SimulationEngine;
  const Topo = window.TopologyRenderer;

  let currentScenarioId = null;
  let pendingIntervention = null;
  let logEntries = [];
  const MAX_LOG = 60;

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const scenarioRow   = $('scenario-row');
  const actorPanel    = $('actor-panel');
  const ribbonEl      = $('field-ribbon');
  const ribbonText    = $('ribbon-text');
  const ribbonBadge   = $('ribbon-badge');
  const attractorBar  = $('attractor-bar');
  const roundCounter  = $('round-counter');
  const logBody       = $('log-body');
  const btnPlay       = $('btn-play');
  const btnStep       = $('btn-step');
  const btnReset      = $('btn-reset');
  const btnRandomize  = $('btn-randomize');
  const btnApply      = $('btn-apply');
  const speedSlider   = $('speed-slider');
  const intervSelect  = $('intervention-select');
  const topoTag       = $('topology-tag');
  const canvas        = $('topology-canvas');
  const topoWrap      = $('topology-wrap');

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    buildScenarioButtons();
    populateInterventionSelect();
    Topo.init(canvas);
    handleResize();
    window.addEventListener('resize', handleResize);

    btnPlay.addEventListener('click', togglePlay);
    btnStep.addEventListener('click', doStep);
    btnReset.addEventListener('click', doReset);
    btnRandomize.addEventListener('click', doRandomize);
    btnApply.addEventListener('click', applyIntervention);
    speedSlider.addEventListener('input', updateSpeed);
    $('btn-clear-log').addEventListener('click', () => { logEntries = []; renderLog([]); });

    Sim.setTickCallback((state, intervention) => {
      renderAll(state, intervention);
    });

    // Load first scenario by default
    loadScenario('fluid-multipolar');
    Topo.startLoop();
  }

  function handleResize() {
    Topo.resize();
    const state = Sim.getState();
    if (state) Topo.setActors(state.actors);
  }

  // ─── Scenario buttons ──────────────────────────────────────────────────────
  function buildScenarioButtons() {
    scenarioRow.innerHTML = '';
    SCENARIOS.forEach(scenario => {
      const btn = document.createElement('button');
      btn.className = 'scenario-btn';
      btn.dataset.id = scenario.id;
      btn.innerHTML = `<span class="badge">${scenario.badge}</span>${scenario.label}`;
      btn.addEventListener('click', () => {
        if (Sim.isRunning()) togglePlay();
        loadScenario(scenario.id);
      });
      scenarioRow.appendChild(btn);
    });
  }

  function setActiveScenarioBtn(id) {
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === id);
    });
  }

  // ─── Interventions ─────────────────────────────────────────────────────────
  function populateInterventionSelect() {
    INTERVENTIONS.forEach(iv => {
      const opt = document.createElement('option');
      opt.value = iv.id;
      opt.textContent = `${iv.icon}  ${iv.label}`;
      intervSelect.appendChild(opt);
    });
  }

  // ─── Load scenario ─────────────────────────────────────────────────────────
  function loadScenario(id) {
    const scenario = SCENARIOS.find(s => s.id === id);
    if (!scenario) return;
    currentScenarioId = id;
    setActiveScenarioBtn(id);
    pendingIntervention = null;

    const state = Sim.loadScenario(scenario);
    Topo.setActors(state.actors);
    Topo.setLinks(state.links);
    Topo.setAttractors(state.attractors);

    logEntries = [];
    addLogEntry(state.round - 1, state.lastExplanation, null, true);
    renderAll(state, null);
  }

  // ─── Playback controls ─────────────────────────────────────────────────────
  function togglePlay() {
    if (Sim.isRunning()) {
      Sim.stop();
      btnPlay.textContent = '▶ Run';
      btnPlay.classList.add('primary');
    } else {
      if (!currentScenarioId) { loadScenario('fluid-multipolar'); }
      btnPlay.textContent = '⏸ Pause';
      btnPlay.classList.remove('primary');
      Sim.start(() => {
        const iv = pendingIntervention;
        pendingIntervention = null;
        if (iv) btnApply.textContent = 'Apply';
        return iv;
      });
    }
  }

  function doStep() {
    if (Sim.isRunning()) return;
    if (!currentScenarioId) loadScenario('fluid-multipolar');
    const iv = pendingIntervention;
    pendingIntervention = null;
    if (iv) btnApply.textContent = 'Apply';
    Sim.step(iv);
  }

  function doReset() {
    Sim.stop();
    btnPlay.textContent = '▶ Run';
    btnPlay.classList.add('primary');
    pendingIntervention = null;
    btnApply.textContent = 'Apply';
    loadScenario(currentScenarioId || 'fluid-multipolar');
  }

  function doRandomize() {
    if (Sim.isRunning()) togglePlay();
    const state = Sim.getState();
    if (!state) return;

    const actors = state.actors;
    actors.forEach(a => {
      a.trust = Math.random();
      a.responsiveness = 0.2 + Math.random() * 0.8;
      a.interventionSensitivity = 0.2 + Math.random() * 0.7;
    });

    state.links.forEach(l => {
      l.strength = 0.15 + Math.random() * 0.8;
      if (l.strength > 0.65) l.type = 'strong';
      else if (l.strength > 0.4) l.type = 'provisional';
      else l.type = 'weak';
    });

    state.metrics.signalCoherence = 0.1 + Math.random() * 0.7;
    state.metrics.fragmentation   = 0.1 + Math.random() * 0.8;
    state.metrics.volatility      = 0.1 + Math.random() * 0.7;
    state.metrics.attractorConfidence = 0.05 + Math.random() * 0.6;
    state.metrics.coordinationRatio   = 0.1 + Math.random() * 0.7;
    state.metrics.interventionLoad    = 0.05 + Math.random() * 0.4;
    state.metrics.falseConvergenceRisk = 0.05 + Math.random() * 0.5;

    addLogEntry(state.round, ['Field randomized. Parameters have been re-seeded — observe emergent behavior.'], null);
    renderAll(state, null);
  }

  function applyIntervention() {
    const id = intervSelect.value;
    if (!id) return;
    const iv = INTERVENTIONS.find(x => x.id === id);
    if (!iv) return;
    pendingIntervention = iv;
    btnApply.textContent = `✓ Queued: ${iv.icon}`;
    if (!Sim.isRunning()) doStep();
  }

  function updateSpeed() {
    const val = parseInt(speedSlider.value, 10);
    Sim.setSpeed(val);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  function renderAll(state, intervention) {
    if (!state) return;
    const m = state.metrics;

    roundCounter.textContent = `Round ${state.round}`;
    updateMetrics(m);
    updateRibbon(m.fieldCondition);
    updateAttractorBar(state.attractors);
    updateActorCards(state.actors);
    updateTopology(state);
    if (state.lastExplanation && state.lastExplanation.length > 0) {
      addLogEntry(state.round, state.lastExplanation, intervention);
    }
  }

  function updateMetrics(m) {
    function setMetric(id, barId, value) {
      const pct = Math.round(value * 100);
      $(id).textContent = pct + '%';
      $(barId).style.width = pct + '%';
    }
    setMetric('m-coherence', 'mb-coherence', m.signalCoherence);
    setMetric('m-attractor', 'mb-attractor', m.attractorConfidence);
    setMetric('m-fragment',  'mb-fragment',  m.fragmentation);
    setMetric('m-volatility','mb-volatility', m.volatility);
    setMetric('m-interv',    'mb-interv',    m.interventionLoad);
    setMetric('m-coord',     'mb-coord',     m.coordinationRatio);
    setMetric('m-fcr',       'mb-fcr',       m.falseConvergenceRisk);
  }

  const RIBBON_CONFIG = {
    'OPEN STRATEGIC FIELD':          { cls: 'ribbon-open',       badge: 'OPEN',        color: '#00c8ff', sub: 'No dominant attractor detected across active signal channels' },
    'ATTRACTOR FORMING':             { cls: 'ribbon-forming',    badge: 'FORMING',     color: '#34d399', sub: 'Coalition alignment in early consolidation' },
    'STABLE ATTRACTOR':              { cls: 'ribbon-stable',     badge: 'STABLE',      color: '#34d399', sub: 'Dominant coalition holding under current signal pressure' },
    'FALSE CONVERGENCE RISK':        { cls: 'ribbon-false',      badge: 'FALSE CONV',  color: '#ffd700', sub: 'Apparent stability may not be endogenously sustainable' },
    'CONTESTED ATTRACTOR':           { cls: 'ribbon-contested',  badge: 'CONTESTED',   color: '#ff6b6b', sub: 'Multiple coalitions competing for field dominance' },
    'FRAGMENTING SYSTEM':            { cls: 'ribbon-fragment',   badge: 'FRAGMENT',    color: '#ff6b6b', sub: 'Signal channels degrading faster than trust rebuild' },
    'TEMPORARY COORDINATION WINDOW': { cls: 'ribbon-window',     badge: 'WINDOW',      color: '#ffd700', sub: 'Short-term alignment opportunity — not yet locked' },
    'HIGH INTERVENTION DEPENDENCE':  { cls: 'ribbon-high-interv',badge: 'INTERV-DEP',  color: '#a78bfa', sub: 'Field structure requires active maintenance to persist' }
  };

  const ribbonSubEl = document.getElementById('ribbon-sub');

  function updateRibbon(condition) {
    const cfg = RIBBON_CONFIG[condition] || RIBBON_CONFIG['OPEN STRATEGIC FIELD'];
    ribbonEl.className = 'field-ribbon ' + cfg.cls;
    ribbonText.textContent = 'FIELD CONDITION — ' + condition;
    ribbonBadge.textContent = cfg.badge;
    if (ribbonSubEl) ribbonSubEl.textContent = cfg.sub || '';
  }

  function updateAttractorBar(attractors) {
    attractorBar.innerHTML = '';
    if (!attractors || attractors.length === 0) {
      const p = document.createElement('span');
      p.className = 'attractor-pill att-weak';
      p.textContent = 'No Attractor Detected';
      attractorBar.appendChild(p);
      return;
    }
    attractors.forEach(att => {
      const p = document.createElement('span');
      const cls = {
        stable: 'att-stable', forming: 'att-forming',
        false: 'att-false', contested: 'att-contested', weak: 'att-weak'
      }[att.type] || 'att-weak';
      p.className = 'attractor-pill ' + cls;
      p.textContent = (att.label || att.type.toUpperCase()) + ' · ' + att.members.join('-');
      attractorBar.appendChild(p);
    });
  }

  function updateActorCards(actors) {
    actorPanel.innerHTML = '';
    actors.forEach(actor => {
      const stanceColors = {
        aligned:   { color: '#34d399', border: 'rgba(52,211,153,0.4)' },
        contested: { color: '#ff6b6b', border: 'rgba(255,107,107,0.4)' },
        isolated:  { color: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
        pivoting:  { color: '#ffd700', border: 'rgba(255,215,0,0.4)' },
        locked:    { color: '#00c8ff', border: 'rgba(0,200,255,0.4)' },
        neutral:   { color: '#475569', border: 'rgba(71,85,105,0.3)' }
      };
      const sc = stanceColors[actor.stance] || stanceColors.neutral;

      const card = document.createElement('div');
      card.className = 'actor-card' + (actor.interventionTargeted ? ' targeted' : '');

      card.innerHTML = `
        <div class="actor-card-header">
          <div class="actor-dot" style="background:${actor.color};box-shadow:0 0 5px ${actor.color}40"></div>
          <span class="actor-name">${actor.label}</span>
          <span class="actor-stance-badge" style="color:${sc.color};border-color:${sc.border}">
            ${ActorSystem.getStanceLabel(actor)}
          </span>
        </div>
        <div class="actor-bars">
          <div class="actor-bar-row">
            <span class="actor-bar-label">Trust</span>
            <div class="actor-bar-track"><div class="actor-bar-fill" style="width:${Math.round(actor.trust*100)}%;background:${actor.color}88"></div></div>
          </div>
          <div class="actor-bar-row">
            <span class="actor-bar-label">Response</span>
            <div class="actor-bar-track"><div class="actor-bar-fill" style="width:${Math.round(actor.responsiveness*100)}%;background:#00c8ff55"></div></div>
          </div>
          <div class="actor-bar-row">
            <span class="actor-bar-label">Sensitivity</span>
            <div class="actor-bar-track"><div class="actor-bar-fill" style="width:${Math.round(actor.interventionSensitivity*100)}%;background:#ffd70055"></div></div>
          </div>
          <div class="actor-bar-row">
            <span class="actor-bar-label">Stbl Bias</span>
            <div class="actor-bar-track"><div class="actor-bar-fill" style="width:${Math.round(actor.stabilityBias*100)}%;background:#34d39955"></div></div>
          </div>
        </div>
        <div class="actor-last-action">${actor.lastAction || '—'}</div>
      `;
      actorPanel.appendChild(card);
    });
  }

  function updateTopology(state) {
    Topo.setActors(state.actors);
    Topo.setLinks(state.links);
    Topo.setAttractors(state.attractors);

    const cond = state.metrics.fieldCondition;
    const tagMap = {
      'OPEN STRATEGIC FIELD': 'OPEN',
      'ATTRACTOR FORMING': 'FORMING',
      'STABLE ATTRACTOR': 'STABLE',
      'FALSE CONVERGENCE RISK': 'FALSE CONV',
      'CONTESTED ATTRACTOR': 'CONTESTED',
      'FRAGMENTING SYSTEM': 'FRAGMENT',
      'TEMPORARY COORDINATION WINDOW': 'COORD WINDOW',
      'HIGH INTERVENTION DEPENDENCE': 'INTERV-DEP'
    };
    topoTag.textContent = tagMap[cond] || cond;
  }

  // ─── Log ───────────────────────────────────────────────────────────────────
  function addLogEntry(round, lines, intervention, isSystem) {
    const entry = { round, lines: [...lines], intervention, isSystem };
    logEntries.unshift(entry);
    if (logEntries.length > MAX_LOG) logEntries = logEntries.slice(0, MAX_LOG);
    renderLog(logEntries);
  }

  function renderLog(entries) {
    logBody.innerHTML = '';
    if (entries.length === 0) {
      logBody.innerHTML = '<div class="log-entry"><div class="log-entry-line text-muted">Log cleared.</div></div>';
      return;
    }
    entries.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'log-entry';

      const roundLabel = document.createElement('div');
      roundLabel.className = 'log-entry-round';
      roundLabel.textContent = entry.isSystem ? 'SYSTEM' : `ROUND ${entry.round}`;
      div.appendChild(roundLabel);

      if (entry.intervention) {
        const iv = document.createElement('div');
        iv.className = 'log-entry-intervention';
        iv.innerHTML = `<span>${entry.intervention.icon}</span> Intervention: ${entry.intervention.label}`;
        div.appendChild(iv);
      }

      (entry.lines || []).forEach(line => {
        const p = document.createElement('div');
        p.className = 'log-entry-line';
        if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('false convergence') || line.toLowerCase().includes('fragil')) {
          p.classList.add('warn');
        } else if (line.toLowerCase().includes('fragment') || line.toLowerCase().includes('erode') || line.toLowerCase().includes('sever')) {
          p.classList.add('danger');
        } else if (line.toLowerCase().includes('stable') || line.toLowerCase().includes('genuine') || line.toLowerCase().includes('durable')) {
          p.classList.add('success');
        }
        p.textContent = line;
        div.appendChild(p);
      });

      logBody.appendChild(div);
    });
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
