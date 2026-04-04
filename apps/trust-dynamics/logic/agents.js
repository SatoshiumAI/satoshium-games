/**
 * agents.js
 * Agent definitions, trait system, and agent factory.
 *
 * Traits (all 0–1 normalized):
 *   baselineTrust      — natural tendency to extend trust
 *   reliability        — consistency of own behavior (affects others' trust in this agent)
 *   responsiveness     — speed of trust repair / openness to new signals
 *   memoryWeight       — how much past events linger (high = slow to forget)
 *   repairWillingness  — initiative in repairing broken trust
 *   betrayalSensitivity — magnitude of trust drop when let down
 *   influenceWeight    — how much this agent's trust shifts affect the wider network
 */

const AGENT_TEMPLATES = [
  {
    id: 'alpha',
    name: 'Alpha',
    color: '#4ade80',
    traits: {
      baselineTrust: 0.65,
      reliability: 0.80,
      responsiveness: 0.55,
      memoryWeight: 0.45,
      repairWillingness: 0.70,
      betrayalSensitivity: 0.40,
      influenceWeight: 0.75,
    },
  },
  {
    id: 'beta',
    name: 'Beta',
    color: '#60a5fa',
    traits: {
      baselineTrust: 0.50,
      reliability: 0.60,
      responsiveness: 0.70,
      memoryWeight: 0.55,
      repairWillingness: 0.50,
      betrayalSensitivity: 0.60,
      influenceWeight: 0.55,
    },
  },
  {
    id: 'sigma',
    name: 'Sigma',
    color: '#f59e0b',
    traits: {
      baselineTrust: 0.40,
      reliability: 0.45,
      responsiveness: 0.40,
      memoryWeight: 0.75,
      repairWillingness: 0.30,
      betrayalSensitivity: 0.80,
      influenceWeight: 0.60,
    },
  },
  {
    id: 'delta',
    name: 'Delta',
    color: '#a78bfa',
    traits: {
      baselineTrust: 0.55,
      reliability: 0.70,
      responsiveness: 0.60,
      memoryWeight: 0.50,
      repairWillingness: 0.65,
      betrayalSensitivity: 0.50,
      influenceWeight: 0.50,
    },
  },
  {
    id: 'omega',
    name: 'Omega',
    color: '#f87171',
    traits: {
      baselineTrust: 0.70,
      reliability: 0.85,
      responsiveness: 0.50,
      memoryWeight: 0.40,
      repairWillingness: 0.80,
      betrayalSensitivity: 0.30,
      influenceWeight: 0.90,
    },
  },
];

/**
 * Returns agent list sliced to agentCount (min 3, max 5).
 */
function buildAgents(agentCount) {
  const count = Math.max(3, Math.min(5, agentCount));
  return AGENT_TEMPLATES.slice(0, count).map(a => ({ ...a, traits: { ...a.traits } }));
}

/**
 * Apply per-agent trait overrides from a scenario preset.
 * overrides is an object keyed by agent id, e.g. { omega: { influenceWeight: 0.95 } }
 */
function applyAgentOverrides(agents, overrides) {
  if (!overrides) return agents;
  return agents.map(a => {
    if (overrides[a.id]) {
      return { ...a, traits: { ...a.traits, ...overrides[a.id] } };
    }
    return a;
  });
}
