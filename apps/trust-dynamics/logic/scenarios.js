/**
 * scenarios.js
 * Preset scenario definitions for the Trust Dynamics simulation.
 *
 * Each scenario defines:
 *   id, name, description — identification
 *   agentCount           — number of agents (3–5)
 *   conditions           — initial global condition slider values (0–1)
 *   trustOverrides       — optional per-pair trust overrides { 'alpha:beta': 30 }
 *   agentTraitOverrides  — optional per-agent trait overrides
 *   intro                — narrative intro shown in explanation console on load
 */

const SCENARIOS = [
  {
    id: 'cooperative_recovery',
    name: 'Cooperative Recovery',
    tagline: 'Trust repairs under favorable conditions',
    agentCount: 4,
    conditions: {
      pressure: 0.35,
      scarcity: 0.30,
      transparency: 0.75,
      cooperationIncentive: 0.70,
      inconsistency: 0.20,
      conflictIntensity: 0.25,
      recoveryOpportunity: 0.72,
    },
    trustOverrides: {
      'alpha:beta': 38,
      'beta:alpha': 42,
      'sigma:delta': 30,
      'delta:sigma': 35,
      'alpha:sigma': 55,
      'sigma:alpha': 48,
      'beta:delta': 50,
      'delta:beta': 52,
      'alpha:delta': 60,
      'delta:alpha': 58,
      'beta:sigma': 40,
      'sigma:beta': 38,
    },
    intro: [
      'The environment is open and conditions are favorable.',
      'Transparency is high and agents have genuine opportunity to rebuild damaged links.',
      'Watch to see whether trust repairs uniformly or whether some relationships resist recovery.',
      'Low inconsistency means behavior is predictable — a foundation for regaining confidence.',
    ],
  },
  {
    id: 'stress_fracture',
    name: 'Stress Fracture',
    tagline: 'Trust collapses under sustained strain',
    agentCount: 5,
    conditions: {
      pressure: 0.85,
      scarcity: 0.65,
      transparency: 0.25,
      cooperationIncentive: 0.30,
      inconsistency: 0.78,
      conflictIntensity: 0.72,
      recoveryOpportunity: 0.18,
    },
    trustOverrides: {
      'alpha:beta': 62,
      'beta:alpha': 58,
      'sigma:delta': 55,
      'delta:sigma': 60,
      'omega:alpha': 70,
      'alpha:omega': 65,
      'sigma:omega': 50,
      'omega:sigma': 45,
      'beta:sigma': 48,
      'sigma:beta': 42,
      'beta:delta': 55,
      'delta:beta': 52,
      'omega:beta': 60,
      'beta:omega': 58,
      'delta:omega': 55,
      'omega:delta': 50,
      'alpha:delta': 60,
      'delta:alpha': 58,
      'alpha:sigma': 52,
      'sigma:alpha': 48,
    },
    intro: [
      'Conditions are hostile: pressure is extreme and inconsistency is rampant.',
      'Even currently healthy trust links may fracture as the environment degrades.',
      'Watch for cascade risk — when one relationship collapses, nearby links often follow.',
      'Recovery opportunity is minimal. Once trust falls, it may not return.',
    ],
  },
  {
    id: 'hidden_instability',
    name: 'Hidden Instability',
    tagline: 'Fragile trust beneath an apparently calm surface',
    agentCount: 4,
    conditions: {
      pressure: 0.30,
      scarcity: 0.50,
      transparency: 0.22,
      cooperationIncentive: 0.40,
      inconsistency: 0.55,
      conflictIntensity: 0.28,
      recoveryOpportunity: 0.38,
    },
    trustOverrides: {
      'alpha:beta': 62,
      'beta:alpha': 58,
      'sigma:delta': 60,
      'delta:sigma': 55,
      'alpha:sigma': 65,
      'sigma:alpha': 62,
      'beta:delta': 60,
      'delta:beta': 58,
      'alpha:delta': 70,
      'delta:alpha': 68,
      'beta:sigma': 63,
      'sigma:beta': 60,
    },
    intro: [
      'On the surface, trust levels appear moderate to healthy.',
      'But transparency is low — agents cannot fully read each other\'s intentions.',
      'Medium inconsistency creates quiet friction that slowly erodes confidence.',
      'Watch the system carefully. What looks stable may already be quietly fracturing.',
    ],
  },
  {
    id: 'anchor_dependency',
    name: 'Anchor Dependency',
    tagline: 'One agent holds the network together — and its collapse risk is high',
    agentCount: 5,
    conditions: {
      pressure: 0.50,
      scarcity: 0.40,
      transparency: 0.45,
      cooperationIncentive: 0.55,
      inconsistency: 0.38,
      conflictIntensity: 0.40,
      recoveryOpportunity: 0.42,
    },
    agentTraitOverrides: {
      omega: {
        reliability: 0.95,
        influenceWeight: 0.97,
        repairWillingness: 0.90,
        baselineTrust: 0.88,
      },
    },
    trustOverrides: {
      'alpha:omega': 85,
      'omega:alpha': 80,
      'beta:omega': 82,
      'omega:beta': 78,
      'sigma:omega': 75,
      'omega:sigma': 72,
      'delta:omega': 80,
      'omega:delta': 76,
      'alpha:beta': 38,
      'beta:alpha': 35,
      'alpha:sigma': 32,
      'sigma:alpha': 30,
      'alpha:delta': 42,
      'delta:alpha': 40,
      'beta:sigma': 35,
      'sigma:beta': 32,
      'beta:delta': 40,
      'delta:beta': 38,
      'sigma:delta': 30,
      'delta:sigma': 28,
    },
    intro: [
      'Omega has emerged as a powerful trust anchor — nearly all agents rely on this relationship.',
      'Direct trust between other agents is weak. The network depends on Omega to function.',
      'This creates a fragile hub structure: if Omega\'s reliability declines, the system may splinter.',
      'Watch whether trust begins flowing peer-to-peer, or whether dependency on the anchor deepens.',
    ],
  },
];

/**
 * Returns a scenario by id, or the first scenario if not found.
 */
function getScenario(id) {
  return SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
}

/**
 * Build a trust matrix seeded from scenario overrides.
 * Falls back to standard agent-trait seeding for unspecified pairs.
 */
function buildScenarioTrustMatrix(agents, scenario) {
  const matrix = buildTrustMatrix(agents);
  if (!scenario.trustOverrides) return matrix;

  for (const [key, value] of Object.entries(scenario.trustOverrides)) {
    const [fromId, toId] = key.split(':');
    if (matrix[fromId] && matrix[fromId][toId] !== undefined) {
      matrix[fromId][toId] = value;
    }
  }
  return matrix;
}
