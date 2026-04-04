/**
 * main.js
 * Application entry point — wires UI events to simulation engine.
 * Owns all DOM interaction; all logic lives in the other modules.
 */

// ─── State ────────────────────────────────────────────────────────────────────

let currentScenario = SCENARIOS[0];
let explanationLog = [];
const MAX_LOG_LINES = 120;

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  populateScenarioSelector();
  populateAgentCountSelector();
  initSliders();
  loadScenario(currentScenario.id);
  bindControls();
});

// ─── Scenario Loading ─────────────────────────────────────────────────────────

function loadScenario(scenarioId) {
  SimulationEngine.pause();

  currentScenario = getScenario(scenarioId);
  explanationLog = [];

  let agents = buildAgents(currentScenario.agentCount);
  agents = applyAgentOverrides(agents, currentScenario.agentTraitOverrides);

  const matrix = buildScenarioTrustMatrix(agents, currentScenario);
  const conditions = { ...currentScenario.conditions };

  // Sync sliders to scenario conditions
  syncSlidersToConditions(conditions);

  SimulationEngine.init(agents, matrix, conditions, scenarioId, onSimulationUpdate);

  // Show scenario intro
  const introLines = generateScenarioIntro(currentScenario);
  appendExplanation([`Scenario loaded: ${currentScenario.name}`, ...introLines], true);

  updateRunButton(false);
}

// ─── Simulation Update Handler ────────────────────────────────────────────────

function onSimulationUpdate(state) {
  const { agents, matrix, conditions, round, running, history } = state;
  const metrics = state.metrics || computeMetrics(agents, matrix);
  const diagnostics = state.diagnostics || computeDiagnostics(metrics, conditions, history || []);

  // Merge anchor fragility and transition data (computed by simulation engine) into metrics object
  if (state.anchorFragility !== undefined) {
    metrics.anchorFragility = state.anchorFragility;
  }
  if (state.anchorTransition !== undefined) {
    metrics.anchorTransition = state.anchorTransition;
  }
  if (state.displacementRisk !== undefined) {
    metrics.displacementRisk = state.displacementRisk;
  }
  if (state.anchorCompetition !== undefined) {
    metrics.anchorCompetition = state.anchorCompetition;
  }
  if (state.anchorVacuum !== undefined) {
    metrics.anchorVacuum = state.anchorVacuum;
  }

  // Override the Pattern diagnostic label — priority order:
  // vacuum (collapse-adjacent) > displacement (predictive) > competition (structural) > transition > normal
  if (state.anchorVacuum) {
    diagnostics.temporal = 'ANCHOR VACUUM';
  } else if (state.displacementActive) {
    diagnostics.temporal = 'DISPLACEMENT RISK';
  } else if (state.anchorCompetition) {
    diagnostics.temporal = 'ANCHOR COMPETITION';
  } else if (state.anchorTransitionActive) {
    diagnostics.temporal = 'ANCHOR TRANSITION';
  }

  renderMetricsRow(metrics);
  renderDiagnosticsBar(diagnostics);
  renderTrustMatrix(agents, matrix, state.deltas);
  renderAgentSummary(agents, matrix);

  if (state.explanationHints && round > 0) {
    const narrative = generateRoundNarrative(
      agents, metrics, state.deltas, state.explanationHints, conditions, round
    );
    appendExplanation(narrative);
  } else if (round === 0) {
    const summary = generateStateSummary(agents, metrics, conditions);
    appendExplanation(summary);
  }

  updateRunButton(running);
  updateRoundCounter(round);
}

// ─── Trust Matrix Renderer ────────────────────────────────────────────────────

function renderTrustMatrix(agents, matrix, deltas) {
  const container = document.getElementById('trust-matrix');
  if (!container) return;

  const n = agents.length;
  const size = 100 / (n + 1);

  let html = `<div class="matrix-grid" style="--cols:${n + 1}">`;

  // Header row
  html += `<div class="matrix-cell matrix-header-corner"></div>`;
  for (const agent of agents) {
    html += `<div class="matrix-cell matrix-header" style="color:${agent.color}">${agent.name}</div>`;
  }

  // Data rows
  for (const source of agents) {
    html += `<div class="matrix-cell matrix-row-label" style="color:${source.color}">${source.name}</div>`;
    for (const target of agents) {
      if (source.id === target.id) {
        html += `<div class="matrix-cell matrix-self">—</div>`;
        continue;
      }
      const value = matrix[source.id][target.id];
      const delta = deltas ? (deltas[source.id]?.[target.id] || 0) : 0;
      const cls = getTrustClass(value);
      const deltaHtml = delta !== 0
        ? `<span class="trust-delta ${delta > 0 ? 'delta-up' : 'delta-down'}">${delta > 0 ? '+' : ''}${delta}</span>`
        : '';
      html += `<div class="matrix-cell trust-cell ${cls}" title="${source.name} → ${target.name}: ${value}">
        <span class="trust-value">${value}</span>${deltaHtml}
      </div>`;
    }
  }

  html += '</div>';

  // Legend
  html += `<div class="matrix-legend">
    <span class="legend-item"><span class="legend-dot trust-strong"></span>Strong (70+)</span>
    <span class="legend-item"><span class="legend-dot trust-moderate"></span>Moderate (50–69)</span>
    <span class="legend-item"><span class="legend-dot trust-fragile"></span>Fragile (30–49)</span>
    <span class="legend-item"><span class="legend-dot trust-damaged"></span>Damaged (10–29)</span>
    <span class="legend-item"><span class="legend-dot trust-broken"></span>Broken (&lt;10)</span>
  </div>`;

  container.innerHTML = html;
}

function getTrustClass(value) {
  if (value >= 70) return 'trust-strong';
  if (value >= 50) return 'trust-moderate';
  if (value >= 30) return 'trust-fragile';
  if (value >= 10) return 'trust-damaged';
  return 'trust-broken';
}

// ─── Agent Summary Renderer ───────────────────────────────────────────────────

function renderAgentSummary(agents, matrix) {
  const container = document.getElementById('agent-summary');
  if (!container) return;

  const anchors = identifyAnchors(agents, matrix);

  let html = '';
  for (const anchor of anchors) {
    const agent = agents.find(a => a.id === anchor.id);
    if (!agent) continue;

    const outgoing = agents
      .filter(a => a.id !== agent.id)
      .map(a => matrix[agent.id][a.id]);
    const incoming = agents
      .filter(a => a.id !== agent.id)
      .map(a => matrix[a.id][agent.id]);
    const avgOut = Math.round(outgoing.reduce((s, v) => s + v, 0) / outgoing.length);
    const avgIn = Math.round(incoming.reduce((s, v) => s + v, 0) / incoming.length);

    const role = deriveAgentRole(agent, matrix, agents);
    const barOut = Math.round((avgOut / 100) * 100);
    const barIn = Math.round((avgIn / 100) * 100);

    html += `<div class="agent-card">
      <div class="agent-card-header">
        <span class="agent-dot" style="background:${agent.color}"></span>
        <span class="agent-card-name" style="color:${agent.color}">${agent.name}</span>
        <span class="agent-role-badge">${role}</span>
      </div>
      <div class="agent-trust-bars">
        <div class="trust-bar-row">
          <span class="bar-label">Extends</span>
          <div class="bar-track"><div class="bar-fill bar-out" style="width:${barOut}%"></div></div>
          <span class="bar-value">${avgOut}</span>
        </div>
        <div class="trust-bar-row">
          <span class="bar-label">Receives</span>
          <div class="bar-track"><div class="bar-fill bar-in" style="width:${barIn}%"></div></div>
          <span class="bar-value">${avgIn}</span>
        </div>
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

function deriveAgentRole(agent, matrix, agents) {
  const { influenceWeight, reliability, repairWillingness, betrayalSensitivity } = agent.traits;
  const incoming = agents
    .filter(a => a.id !== agent.id)
    .map(a => matrix[a.id][agent.id]);
  const avgIn = incoming.reduce((s, v) => s + v, 0) / incoming.length;

  if (influenceWeight > 0.80 && avgIn > 65) return 'ANCHOR';
  if (reliability > 0.78) return 'RELIABLE';
  if (repairWillingness > 0.70) return 'BRIDGE';
  if (betrayalSensitivity > 0.72) return 'GUARDED';
  if (avgIn < 35) return 'ISOLATED';
  return 'NEUTRAL';
}

// ─── Metrics Row Renderer ─────────────────────────────────────────────────────

function renderMetricsRow(metrics) {
  setMetric('metric-network-trust', metrics.networkTrust, '%');
  setMetric('metric-asymmetry', metrics.trustAsymmetry, '');
  setMetric('metric-stability', metrics.stability, '%');
  setMetric('metric-cascade', metrics.cascadeRisk, '%');

  // Anchor Strength card
  const anchorEl = document.getElementById('metric-anchor');
  const anchorNameEl = document.getElementById('metric-anchor-name');
  const anchorFragEl = document.getElementById('metric-anchor-fragility');
  if (anchorEl && metrics.anchorStrength !== undefined) {
    anchorEl.textContent = metrics.anchorStrength;
  }
  if (anchorNameEl && metrics.anchorName) {
    anchorNameEl.textContent = metrics.anchorName;
  }
  if (anchorFragEl) {
    if (metrics.anchorFragility) {
      anchorFragEl.textContent = `Fragility: ${metrics.anchorFragility}`;
      anchorFragEl.className = 'metric-anchor-fragility ' + (
        metrics.anchorFragility === 'RISING'         ? 'frag-rising' :
        metrics.anchorFragility === 'STRENGTHENING'  ? 'frag-strengthening' :
                                                       'frag-stable'
      );
    } else {
      anchorFragEl.textContent = '';
      anchorFragEl.className = 'metric-anchor-fragility';
    }
  }

  // Color the cascade risk indicator
  const cascadeEl = document.getElementById('metric-cascade');
  if (cascadeEl) {
    cascadeEl.className = 'metric-value ' + (
      metrics.cascadeRisk >= 60 ? 'metric-danger' :
      metrics.cascadeRisk >= 35 ? 'metric-warning' : 'metric-safe'
    );
  }
  const trustEl = document.getElementById('metric-network-trust');
  if (trustEl) {
    trustEl.className = 'metric-value ' + (
      metrics.networkTrust >= 65 ? 'metric-safe' :
      metrics.networkTrust >= 40 ? 'metric-warning' : 'metric-danger'
    );
  }
}

function setMetric(id, value, suffix) {
  const el = document.getElementById(id);
  if (el) el.textContent = value + suffix;
}

// ─── Diagnostics Bar Renderer ─────────────────────────────────────────────────

function renderDiagnosticsBar(diagnostics) {
  renderDiagLabel('diag-regime', diagnostics.regime);
  renderDiagLabel('diag-form', diagnostics.form);
  renderDiagLabel('diag-driver', diagnostics.driver);
  renderDiagLabel('diag-health', diagnostics.health);
  renderDiagLabel('diag-temporal', diagnostics.temporal);
}

function renderDiagLabel(id, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = label;
  el.className = 'diag-label ' + getDiagnosticColor(label);
}

// ─── Explanation Console ──────────────────────────────────────────────────────

function appendExplanation(lines, clear = false) {
  const console = document.getElementById('explanation-console');
  if (!console) return;

  if (clear) {
    explanationLog = [];
  }

  const timestamp = SimulationEngine.getState()?.round || 0;

  for (const line of lines) {
    if (line.trim()) {
      explanationLog.push({ text: line, round: timestamp });
    }
  }

  // Trim to max
  if (explanationLog.length > MAX_LOG_LINES) {
    explanationLog = explanationLog.slice(-MAX_LOG_LINES);
  }

  renderExplanationLog();
}

function renderExplanationLog() {
  const container = document.getElementById('explanation-console');
  if (!container) return;

  let html = '';
  for (let i = explanationLog.length - 1; i >= 0; i--) {
    const entry = explanationLog[i];
    const isHeader = entry.text.startsWith('—');
    html += `<div class="log-line ${isHeader ? 'log-header' : ''}">${escapeHtml(entry.text)}</div>`;
  }

  container.innerHTML = html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function bindControls() {
  document.getElementById('btn-step')?.addEventListener('click', () => {
    SimulationEngine.step();
  });

  document.getElementById('btn-run-pause')?.addEventListener('click', () => {
    const s = SimulationEngine.getState();
    if (!s) return;
    if (s.running) {
      SimulationEngine.pause();
    } else {
      SimulationEngine.run();
    }
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    const s = SimulationEngine.getState();
    const scenarioId = s?.scenarioId || currentScenario.id;
    loadScenario(scenarioId);
  });

  document.getElementById('scenario-select')?.addEventListener('change', (e) => {
    loadScenario(e.target.value);
  });

  document.getElementById('agent-count-select')?.addEventListener('change', (e) => {
    currentScenario = { ...currentScenario, agentCount: parseInt(e.target.value) };
    loadScenario(currentScenario.id);
  });
}

function updateRunButton(running) {
  const btn = document.getElementById('btn-run-pause');
  if (btn) {
    btn.textContent = running ? 'Pause' : 'Run';
    btn.classList.toggle('btn-active', running);
  }
}

function updateRoundCounter(round) {
  const el = document.getElementById('round-counter');
  if (el) el.textContent = `Round ${round}`;
}

// ─── Sliders ──────────────────────────────────────────────────────────────────

const SLIDER_KEYS = [
  { key: 'pressure', label: 'Pressure' },
  { key: 'scarcity', label: 'Scarcity' },
  { key: 'transparency', label: 'Transparency' },
  { key: 'cooperationIncentive', label: 'Cooperation Incentive' },
  { key: 'inconsistency', label: 'Inconsistency' },
  { key: 'conflictIntensity', label: 'Conflict Intensity' },
  { key: 'recoveryOpportunity', label: 'Recovery Opportunity' },
];

function initSliders() {
  const container = document.getElementById('conditions-sliders');
  if (!container) return;

  let html = '';
  for (const { key, label } of SLIDER_KEYS) {
    html += `<div class="slider-row">
      <label class="slider-label">${label}</label>
      <div class="slider-track-row">
        <input type="range" min="0" max="100" value="50" class="slider" id="slider-${key}" data-key="${key}">
        <span class="slider-value" id="sliderval-${key}">50</span>
      </div>
    </div>`;
  }
  container.innerHTML = html;

  // Bind events
  for (const { key } of SLIDER_KEYS) {
    const slider = document.getElementById(`slider-${key}`);
    const valDisplay = document.getElementById(`sliderval-${key}`);
    if (!slider) continue;
    slider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value) / 100;
      valDisplay.textContent = e.target.value;
      SimulationEngine.setCondition(key, v);
    });
  }
}

function syncSlidersToConditions(conditions) {
  for (const { key } of SLIDER_KEYS) {
    const slider = document.getElementById(`slider-${key}`);
    const valDisplay = document.getElementById(`sliderval-${key}`);
    const val = Math.round((conditions[key] || 0) * 100);
    if (slider) slider.value = val;
    if (valDisplay) valDisplay.textContent = val;
  }
}

// ─── Selectors ────────────────────────────────────────────────────────────────

function populateScenarioSelector() {
  const select = document.getElementById('scenario-select');
  if (!select) return;
  select.innerHTML = SCENARIOS.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');
}

function populateAgentCountSelector() {
  const select = document.getElementById('agent-count-select');
  if (!select) return;
  select.innerHTML = [3, 4, 5].map(n =>
    `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n} Agents</option>`
  ).join('');
}
