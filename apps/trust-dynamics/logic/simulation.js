/**
 * simulation.js
 * Round engine: manages state, stepping, run/pause, and history.
 */

const SimulationEngine = (() => {
  let state = null;
  let runTimer = null;
  let onUpdate = null;
  let runSpeed = 1200; // ms per round

  /**
   * Initialize the simulation from a scenario and agent list.
   */
  function init(agents, trustMatrix, conditions, scenarioId, updateCallback) {
    onUpdate = updateCallback;
    state = {
      agents,
      matrix: trustMatrix,
      conditions: { ...conditions },
      round: 0,
      running: false,
      scenarioId,
      history: [],
      anchorInboundHistory: [],
      previousAnchorName: null,
      anchorTransitionCountdown: 0,
      displacementConsecutive: 0,
      displacementCountdown: 0,
    };
    _notifyUpdate();
  }

  /**
   * Step one round forward.
   */
  function step() {
    if (!state) return;

    const { newMatrix, deltas, explanationHints } = computeRound(
      state.agents,
      state.matrix,
      state.conditions
    );

    state.round += 1;
    state.matrix = newMatrix;

    const metrics = computeMetrics(state.agents, state.matrix);
    const diagnostics = computeDiagnostics(metrics, state.conditions, state.history);

    state.history.push({
      round: state.round,
      networkTrust: metrics.networkTrust,
      stability: metrics.stability,
      cascadeRisk: metrics.cascadeRisk,
      trustAsymmetry: metrics.trustAsymmetry,
    });

    // Keep history bounded
    if (state.history.length > 50) state.history.shift();

    // Track anchor inbound strength for fragility detection
    state.anchorInboundHistory.push(metrics.anchorStrength);
    if (state.anchorInboundHistory.length > 10) state.anchorInboundHistory.shift();

    // Compute fragility BEFORE transition detection so we capture the pre-transition trend
    const anchorFragility = _deriveAnchorFragility(state.anchorInboundHistory);

    // Anchor transition detection: observe identity change, no math changes
    let anchorTransition = null;
    if (
      state.previousAnchorName !== null &&
      metrics.anchorName !== state.previousAnchorName
    ) {
      anchorTransition = {
        from: state.previousAnchorName,
        to:   metrics.anchorName,
        prevFragility: anchorFragility, // fragility of the departing anchor's trend
      };
      state.anchorTransitionCountdown = 2;
      // Reset history — old values belonged to the previous anchor identity
      state.anchorInboundHistory = [];
    } else if (state.anchorTransitionCountdown > 0) {
      state.anchorTransitionCountdown--;
    }

    state.previousAnchorName = metrics.anchorName;

    const anchorTransitionActive = state.anchorTransitionCountdown > 0 || anchorTransition !== null;

    // Displacement risk: challenger within 5 points of anchor AND anchor fragility RISING
    // Must hold for 2 consecutive rounds before firing
    const displacementCondition = (
      metrics.challengerStrength !== null &&
      (metrics.anchorStrength - metrics.challengerStrength) <= 5 &&
      anchorFragility === 'RISING'
    );

    if (displacementCondition) {
      state.displacementConsecutive++;
    } else {
      state.displacementConsecutive = 0;
    }

    let displacementRisk = false;
    if (state.displacementConsecutive >= 2) {
      displacementRisk = true;
      state.displacementCountdown = 2;
      state.displacementConsecutive = 0; // reset to require 2 more rounds before re-firing
    }

    if (!displacementRisk && state.displacementCountdown > 0) {
      state.displacementCountdown--;
    }

    const displacementActive = displacementRisk || state.displacementCountdown > 0;

    // Anchor competition: top 3 inbound averages within 7 points of each other
    // Active while condition holds — no consecutive requirement, reacts immediately
    const anchorCompetition = (
      metrics.thirdStrength !== null &&
      (metrics.anchorStrength - metrics.thirdStrength) <= 7
    );

    // Anchor vacuum: no agent holds meaningful anchor strength, trust is flat and broken
    const anchorVacuum = (
      metrics.anchorStrength < 35 &&
      metrics.trustAsymmetry <= 2 &&
      metrics.stability === 0
    );

    _notifyUpdate({ metrics, diagnostics, deltas, explanationHints, anchorFragility, anchorTransition, anchorTransitionActive, displacementRisk, displacementActive, anchorCompetition, anchorVacuum });
  }

  /**
   * Start auto-running the simulation.
   */
  function run() {
    if (!state || state.running) return;
    state.running = true;
    _scheduleNext();
    _notifyUpdate();
  }

  function _scheduleNext() {
    runTimer = setTimeout(() => {
      if (state && state.running) {
        step();
        _scheduleNext();
      }
    }, runSpeed);
  }

  /**
   * Pause auto-run.
   */
  function pause() {
    if (!state) return;
    state.running = false;
    if (runTimer) {
      clearTimeout(runTimer);
      runTimer = null;
    }
    _notifyUpdate();
  }

  /**
   * Update a condition value live (0–1).
   */
  function setCondition(key, value) {
    if (!state) return;
    state.conditions[key] = value;
  }

  /**
   * Get current state snapshot.
   */
  function getState() {
    return state;
  }

  /**
   * Set run speed (ms per round).
   */
  function setSpeed(ms) {
    runSpeed = ms;
  }

  /**
   * Derive anchor fragility label from the last 3 rounds of anchor inbound trust.
   * Requires at least 4 data points (current + 3 prior) to make a judgment.
   */
  function _deriveAnchorFragility(history) {
    if (history.length < 4) return null;
    const current = history[history.length - 1];
    const past    = history[history.length - 4]; // value exactly 3 rounds ago
    const delta   = current - past;
    if (delta <= -5) return 'RISING';
    if (delta >=  5) return 'STRENGTHENING';
    return 'STABLE';
  }

  function _notifyUpdate(extra) {
    if (onUpdate && state) {
      onUpdate({ ...state, ...extra });
    }
  }

  return { init, step, run, pause, setCondition, getState, setSpeed };
})();
