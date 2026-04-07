// scenarios.js — Scenario presets for Strategic Signal Lab

const SCENARIOS = [
  {
    id: 'fluid-multipolar',
    label: 'Fluid Multipolar Field',
    badge: 'MULTIPOLAR',
    description: 'No dominant attractor. Multiple actors maintain provisional alignments. The field resists consolidation.',
    fieldCondition: 'OPEN STRATEGIC FIELD',
    actors: ['sentinel', 'arbiter', 'vanguard', 'cipher', 'nexus', 'phalanx'],
    initialLinks: [
      { a: 'sentinel', b: 'arbiter', strength: 0.5, type: 'provisional' },
      { a: 'vanguard', b: 'cipher', strength: 0.4, type: 'provisional' },
      { a: 'nexus', b: 'phalanx', strength: 0.45, type: 'provisional' },
      { a: 'arbiter', b: 'nexus', strength: 0.35, type: 'weak' }
    ],
    initialMetrics: {
      signalCoherence: 0.38,
      attractorConfidence: 0.2,
      fragmentation: 0.65,
      volatility: 0.55,
      interventionLoad: 0.1,
      coordinationRatio: 0.3,
      falseConvergenceRisk: 0.25
    },
    attractorHints: [],
    volatilityMod: 1.0,
    coherenceMod: 0.8
  },
  {
    id: 'signaling-breakdown',
    label: 'Signaling Breakdown',
    badge: 'BREAKDOWN',
    description: 'Trust has eroded. Signals are misread or ignored. Coordination becomes increasingly costly.',
    fieldCondition: 'FRAGMENTING SYSTEM',
    actors: ['sentinel', 'arbiter', 'vanguard', 'cipher', 'nexus', 'phalanx'],
    initialLinks: [
      { a: 'sentinel', b: 'nexus', strength: 0.25, type: 'weak' },
      { a: 'vanguard', b: 'phalanx', strength: 0.2, type: 'weak' }
    ],
    initialMetrics: {
      signalCoherence: 0.15,
      attractorConfidence: 0.08,
      fragmentation: 0.88,
      volatility: 0.78,
      interventionLoad: 0.05,
      coordinationRatio: 0.12,
      falseConvergenceRisk: 0.15
    },
    attractorHints: [],
    volatilityMod: 1.4,
    coherenceMod: 0.4,
    actorOverrides: {
      arbiter: { trust: 0.25, responsiveness: 0.35 },
      cipher: { trust: 0.1, signalWeight: 0.4 },
      sentinel: { trust: 0.35 }
    }
  },
  {
    id: 'coordination-window',
    label: 'Coordination Window',
    badge: 'WINDOW',
    description: 'A narrow window of coordination has opened. Actors sense opportunity but structural trust remains fragile.',
    fieldCondition: 'TEMPORARY COORDINATION WINDOW',
    actors: ['sentinel', 'arbiter', 'vanguard', 'cipher', 'nexus', 'phalanx'],
    initialLinks: [
      { a: 'sentinel', b: 'arbiter', strength: 0.72, type: 'strong' },
      { a: 'arbiter', b: 'nexus', strength: 0.65, type: 'strong' },
      { a: 'nexus', b: 'phalanx', strength: 0.6, type: 'provisional' },
      { a: 'vanguard', b: 'cipher', strength: 0.35, type: 'provisional' }
    ],
    initialMetrics: {
      signalCoherence: 0.68,
      attractorConfidence: 0.55,
      fragmentation: 0.3,
      volatility: 0.4,
      interventionLoad: 0.25,
      coordinationRatio: 0.62,
      falseConvergenceRisk: 0.45
    },
    attractorHints: ['sentinel-arbiter-nexus'],
    volatilityMod: 0.7,
    coherenceMod: 1.2
  },
  {
    id: 'false-convergence',
    label: 'False Convergence',
    badge: 'FALSE',
    description: 'The field appears coordinated, but underlying instability is masked by recent interventions. Genuine attractor is absent.',
    fieldCondition: 'FALSE CONVERGENCE RISK',
    actors: ['sentinel', 'arbiter', 'vanguard', 'cipher', 'nexus', 'phalanx'],
    initialLinks: [
      { a: 'sentinel', b: 'arbiter', strength: 0.75, type: 'strong' },
      { a: 'sentinel', b: 'nexus', strength: 0.7, type: 'strong' },
      { a: 'arbiter', b: 'phalanx', strength: 0.65, type: 'provisional' },
      { a: 'vanguard', b: 'nexus', strength: 0.55, type: 'provisional' },
      { a: 'cipher', b: 'phalanx', strength: 0.5, type: 'provisional' }
    ],
    initialMetrics: {
      signalCoherence: 0.72,
      attractorConfidence: 0.35,
      fragmentation: 0.2,
      volatility: 0.35,
      interventionLoad: 0.75,
      coordinationRatio: 0.7,
      falseConvergenceRisk: 0.82
    },
    attractorHints: ['global'],
    volatilityMod: 0.6,
    coherenceMod: 1.1,
    falseConvergenceSeeded: true
  },
  {
    id: 'adversarial-drift',
    label: 'Adversarial Drift',
    badge: 'ADVERSARIAL',
    description: 'Actors drift into opposed camps. Signal channels degrade. Intervention windows narrow with each round.',
    fieldCondition: 'CONTESTED ATTRACTOR',
    actors: ['sentinel', 'arbiter', 'vanguard', 'cipher', 'nexus', 'phalanx'],
    initialLinks: [
      { a: 'sentinel', b: 'arbiter', strength: 0.6, type: 'strong' },
      { a: 'sentinel', b: 'nexus', strength: 0.55, type: 'provisional' },
      { a: 'vanguard', b: 'cipher', strength: 0.65, type: 'strong' },
      { a: 'vanguard', b: 'phalanx', strength: 0.5, type: 'provisional' },
      { a: 'arbiter', b: 'cipher', strength: 0.2, type: 'weak' }
    ],
    initialMetrics: {
      signalCoherence: 0.42,
      attractorConfidence: 0.38,
      fragmentation: 0.55,
      volatility: 0.65,
      interventionLoad: 0.2,
      coordinationRatio: 0.35,
      falseConvergenceRisk: 0.3
    },
    attractorHints: ['sentinel-arbiter-nexus', 'vanguard-cipher-phalanx'],
    volatilityMod: 1.2,
    coherenceMod: 0.7
  },
  {
    id: 'attractor-contest',
    label: 'Attractor Contest',
    badge: 'CONTEST',
    description: 'Two competing attractors vie for dominance. Swing actors hold decisive leverage. Outcome depends on signal credibility.',
    fieldCondition: 'ATTRACTOR FORMING',
    actors: ['sentinel', 'arbiter', 'vanguard', 'cipher', 'nexus', 'phalanx'],
    initialLinks: [
      { a: 'sentinel', b: 'arbiter', strength: 0.78, type: 'strong' },
      { a: 'vanguard', b: 'cipher', strength: 0.74, type: 'strong' },
      { a: 'nexus', b: 'sentinel', strength: 0.45, type: 'provisional' },
      { a: 'nexus', b: 'vanguard', strength: 0.42, type: 'provisional' },
      { a: 'phalanx', b: 'arbiter', strength: 0.4, type: 'provisional' },
      { a: 'phalanx', b: 'cipher', strength: 0.38, type: 'provisional' }
    ],
    initialMetrics: {
      signalCoherence: 0.5,
      attractorConfidence: 0.48,
      fragmentation: 0.45,
      volatility: 0.6,
      interventionLoad: 0.15,
      coordinationRatio: 0.5,
      falseConvergenceRisk: 0.35
    },
    attractorHints: ['sentinel-arbiter', 'vanguard-cipher'],
    volatilityMod: 1.1,
    coherenceMod: 0.95
  }
];

const INTERVENTIONS = [
  { id: 'amplify-signal', label: 'Amplify Signal', icon: '↑', description: 'Boost signal coherence in a target cluster. Raises local trust but may trigger counter-moves.', effect: 'coherence+' },
  { id: 'dampen-signal', label: 'Dampen Signal', icon: '↓', description: 'Reduce signal strength across the field. Lowers volatility but delays convergence.', effect: 'coherence-' },
  { id: 'introduce-ambiguity', label: 'Introduce Ambiguity', icon: '?', description: 'Inject ambiguous signals. Prevents immediate fragmentation but reduces long-term credibility.', effect: 'ambiguity+' },
  { id: 'reinforce-trust', label: 'Reinforce Trust', icon: '⊕', description: 'Strengthen trust between selected actors. Advances attractor formation.', effect: 'trust+' },
  { id: 'destabilize-trust', label: 'Destabilize Trust', icon: '⊗', description: 'Erode trust in a specific link. May fracture forming blocs.', effect: 'trust-' },
  { id: 'open-coordination', label: 'Open Coordination Window', icon: '◎', description: 'Create a temporary opening for alignment. High risk of false convergence.', effect: 'window+' },
  { id: 'isolate-actor', label: 'Isolate Actor', icon: '⊘', description: 'Sever an actor from its primary connections. Forces realignment or collapse.', effect: 'isolate' },
  { id: 'increase-pressure', label: 'Increase Systemic Pressure', icon: '▲', description: 'Raise field volatility. May force actors to commit or defect.', effect: 'pressure+' },
  { id: 'reduce-volatility', label: 'Reduce Volatility', icon: '▽', description: 'Dampen systemic pressure. Stabilizes the field temporarily.', effect: 'volatility-' },
  { id: 'split-attention', label: 'Split Attention', icon: '⋈', description: 'Divide a bloc\'s focus across multiple signals. Weakens cohesion.', effect: 'split' },
  { id: 'test-attractor', label: 'Test Attractor Resilience', icon: '◈', description: 'Probe whether a forming attractor is genuine or false.', effect: 'test' }
];

window.ScenarioSystem = { SCENARIOS, INTERVENTIONS };
