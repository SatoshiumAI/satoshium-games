/**
 * trust.js
 * Trust matrix management and per-round update logic.
 *
 * Trust is directional: trustMatrix[fromId][toId] = 0–100
 * A trusts B at 80 means A is willing to rely on / cooperate with B.
 *
 * Round delta formula (fully transparent):
 *
 *   base = (target.reliability * 30) + (source.baselineTrust * 20)
 *   conditionEffect = transparency*10 - inconsistency*12 - pressure*8
 *                     + recoveryOpportunity*6 - conflictIntensity*8
 *                     - scarcity*5 + cooperationIncentive*7
 *   repairPull = repairWillingness * recoveryOpportunity * 10
 *   betrayalDrag = source.betrayalSensitivity * inconsistency * 15
 *   memoryDrag = source.memoryWeight * (currentTrust < 40 ? -4 : 0)
 *
 *   rawDelta = base + conditionEffect + repairPull - betrayalDrag + memoryDrag
 *   scaledDelta = (rawDelta - 35) * source.responsiveness * 0.3
 *
 * Clamped to [0, 100]. Each round is a weighted blend toward the target.
 */

/**
 * Build an initial trust matrix from agents.
 * Seeds trust values with a semi-deterministic function of agent traits.
 */
function buildTrustMatrix(agents) {
  const matrix = {};
  for (const source of agents) {
    matrix[source.id] = {};
    for (const target of agents) {
      if (source.id === target.id) {
        matrix[source.id][target.id] = null; // self-trust not tracked
        continue;
      }
      const base = (source.baselineTrust + target.traits.reliability) / 2;
      // Deterministic jitter using string hash
      const jitter = pseudoRandom(source.id + target.id) * 20 - 10;
      matrix[source.id][target.id] = clamp(Math.round(base * 100 + jitter), 10, 90);
    }
  }
  return matrix;
}

/**
 * Compute one round of trust updates.
 * Returns { newMatrix, deltas, explanationHints }
 */
function computeRound(agents, matrix, conditions) {
  const {
    pressure,
    scarcity,
    transparency,
    cooperationIncentive,
    inconsistency,
    conflictIntensity,
    recoveryOpportunity,
  } = conditions;

  const newMatrix = {};
  const deltas = {};
  const explanationHints = [];

  for (const source of agents) {
    newMatrix[source.id] = {};
    deltas[source.id] = {};
    for (const target of agents) {
      if (source.id === target.id) {
        newMatrix[source.id][target.id] = null;
        continue;
      }

      const current = matrix[source.id][target.id];
      const st = source.traits;
      const tt = target.traits;

      // Base pull toward reliability-adjusted trust level
      const base = tt.reliability * 30 + st.baselineTrust * 20;

      // Condition effects
      const conditionEffect =
        transparency * 10
        - inconsistency * 12
        - pressure * 8
        + recoveryOpportunity * 6
        - conflictIntensity * 8
        - scarcity * 5
        + cooperationIncentive * 7;

      // Repair dynamics
      const repairPull = st.repairWillingness * tt.repairWillingness * recoveryOpportunity * 10;

      // Betrayal drag (amplified when trust is already low and inconsistency is high)
      const betrayalDrag = st.betrayalSensitivity * inconsistency * 15
        + (current < 35 ? st.memoryWeight * inconsistency * 8 : 0);

      // Memory effect: low trust sticks when memory is high
      const memoryDrag = st.memoryWeight * (current < 40 ? -4 : 0);

      // Raw target trust level
      const rawTarget = base + conditionEffect + repairPull - betrayalDrag + memoryDrag;

      // Scale delta: blended move toward rawTarget, modulated by responsiveness
      const diff = rawTarget - current;
      const scaledDelta = diff * st.responsiveness * 0.28;

      const newValue = clamp(Math.round(current + scaledDelta), 0, 100);
      const delta = newValue - current;

      newMatrix[source.id][target.id] = newValue;
      deltas[source.id][target.id] = delta;

      // Capture notable changes for explanation engine
      if (Math.abs(delta) >= 4) {
        explanationHints.push({
          from: source.id,
          to: target.id,
          delta,
          causes: identifyCauses(delta, st, tt, conditions, current),
        });
      }
    }
  }

  return { newMatrix, deltas, explanationHints };
}

/**
 * Identify the dominant causes of a trust change for the explanation engine.
 */
function identifyCauses(delta, st, tt, conditions, current) {
  const { pressure, transparency, inconsistency, conflictIntensity, recoveryOpportunity, cooperationIncentive, scarcity } = conditions;
  const causes = [];

  if (delta < 0) {
    if (inconsistency > 0.6) causes.push('high_inconsistency');
    if (pressure > 0.6) causes.push('high_pressure');
    if (conflictIntensity > 0.6) causes.push('conflict');
    if (scarcity > 0.5) causes.push('scarcity');
    if (st.betrayalSensitivity > 0.65 && inconsistency > 0.4) causes.push('betrayal_sensitive');
    if (tt.reliability < 0.45) causes.push('low_reliability');
    if (current < 35 && st.memoryWeight > 0.6) causes.push('memory_drag');
  } else {
    if (transparency > 0.6) causes.push('transparency');
    if (recoveryOpportunity > 0.5) causes.push('recovery_opportunity');
    if (cooperationIncentive > 0.5) causes.push('cooperation_incentive');
    if (st.repairWillingness > 0.6 && tt.repairWillingness > 0.5) causes.push('mutual_repair');
    if (tt.reliability > 0.7) causes.push('strong_reliability');
  }

  if (causes.length === 0) causes.push(delta < 0 ? 'gradual_erosion' : 'gradual_recovery');
  return causes;
}

/**
 * Compute network-level trust metrics.
 */
function computeMetrics(agents, matrix) {
  const values = [];
  const pairs = [];

  for (const source of agents) {
    for (const target of agents) {
      if (source.id === target.id) continue;
      const v = matrix[source.id][target.id];
      values.push(v);
      pairs.push({ from: source.id, to: target.id, value: v });
    }
  }

  const networkTrust = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  // Asymmetry: average absolute difference between A→B and B→A
  let asymSum = 0;
  let asymCount = 0;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i].id;
      const b = agents[j].id;
      asymSum += Math.abs(matrix[a][b] - matrix[b][a]);
      asymCount++;
    }
  }
  const trustAsymmetry = Math.round(asymSum / asymCount);

  // Stability: fraction of links above 50 (stable zone)
  const stableLinks = values.filter(v => v >= 50).length;
  const stability = Math.round((stableLinks / values.length) * 100);

  // Cascade risk: fraction of links below 30 (danger zone) × avg betrayal sensitivity
  const dangerLinks = values.filter(v => v < 30).length;
  const avgBetrayal = agents.reduce((s, a) => s + a.traits.betrayalSensitivity, 0) / agents.length;
  const cascadeRisk = Math.round(((dangerLinks / values.length) * 0.7 + avgBetrayal * 0.3) * 100);

  // Trust density: fraction of links above 60
  const denseLinks = values.filter(v => v >= 60).length;
  const density = Math.round((denseLinks / values.length) * 100);

  // Min/max/broken links for diagnostics
  const minTrust = Math.min(...values);
  const maxTrust = Math.max(...values);
  const brokenLinks = values.filter(v => v < 20).length;
  const repairingLinks = pairs.filter(p => p.value >= 20 && p.value < 45).length;

  // Anchor Strength: agent with the highest average inbound trust
  const totalInboundSum = values.reduce((s, v) => s + v, 0);
  const agentInbound = agents.map(agent => {
    const inb = agents
      .filter(a => a.id !== agent.id)
      .map(a => matrix[a.id][agent.id]);
    const sum = inb.reduce((s, v) => s + v, 0);
    const avgIn = Math.round(sum / inb.length);
    return { id: agent.id, name: agent.name, avgIn, inboundSum: sum };
  }).sort((a, b) => b.avgIn - a.avgIn);

  const topAnchor = agentInbound[0];
  const anchorStrength = topAnchor.avgIn;
  const anchorName = topAnchor.name;
  const anchorShare = totalInboundSum > 0 ? topAnchor.inboundSum / totalInboundSum : 0;

  // Challenger: second-highest average inbound (the agent closest to anchor status)
  const challengerStrength = agentInbound.length > 1 ? agentInbound[1].avgIn : null;

  // Third contender: for anchor competition detection
  const thirdStrength = agentInbound.length > 2 ? agentInbound[2].avgIn : null;

  return {
    networkTrust,
    trustAsymmetry,
    stability,
    cascadeRisk,
    density,
    minTrust,
    maxTrust,
    brokenLinks,
    repairingLinks,
    totalLinks: values.length,
    anchorStrength,
    anchorName,
    anchorShare,
    challengerStrength,
    thirdStrength,
  };
}

/**
 * Identify agents acting as trust anchors (high outgoing + incoming average).
 */
function identifyAnchors(agents, matrix) {
  return agents.map(agent => {
    const outgoing = agents
      .filter(a => a.id !== agent.id)
      .map(a => matrix[agent.id][a.id]);
    const incoming = agents
      .filter(a => a.id !== agent.id)
      .map(a => matrix[a.id][agent.id]);
    const avgOut = outgoing.reduce((s, v) => s + v, 0) / outgoing.length;
    const avgIn = incoming.reduce((s, v) => s + v, 0) / incoming.length;
    const score = (avgOut + avgIn) / 2;
    return { id: agent.id, name: agent.name, score: Math.round(score), avgOut: Math.round(avgOut), avgIn: Math.round(avgIn) };
  }).sort((a, b) => b.score - a.score);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Deterministic pseudo-random from a string seed (0–1).
 */
function pseudoRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}
