// actors.js — Actor definitions for Strategic Signal Lab

const ACTOR_TEMPLATES = {
  sentinel: {
    id: 'sentinel',
    label: 'Sentinel',
    color: '#00c8ff',
    posture: 'defensive',
    trust: 0.6,
    responsiveness: 0.7,
    interventionSensitivity: 0.5,
    stabilityBias: 0.8,
    signalWeight: 1.0,
    description: 'Defensive anchor, prefers stable coalitions.'
  },
  arbiter: {
    id: 'arbiter',
    label: 'Arbiter',
    color: '#ffd700',
    posture: 'mediating',
    trust: 0.7,
    responsiveness: 0.8,
    interventionSensitivity: 0.4,
    stabilityBias: 0.6,
    signalWeight: 0.9,
    description: 'Mediates between blocs, high responsiveness.'
  },
  vanguard: {
    id: 'vanguard',
    label: 'Vanguard',
    color: '#ff6b6b',
    posture: 'assertive',
    trust: 0.4,
    responsiveness: 0.9,
    interventionSensitivity: 0.7,
    stabilityBias: 0.3,
    signalWeight: 1.1,
    description: 'Assertive, volatile, disrupts equilibria.'
  },
  cipher: {
    id: 'cipher',
    label: 'Cipher',
    color: '#a78bfa',
    posture: 'opaque',
    trust: 0.3,
    responsiveness: 0.4,
    interventionSensitivity: 0.9,
    stabilityBias: 0.5,
    signalWeight: 0.8,
    description: 'Opaque signaling, high ambiguity output.'
  },
  nexus: {
    id: 'nexus',
    label: 'Nexus',
    color: '#34d399',
    posture: 'bridging',
    trust: 0.65,
    responsiveness: 0.6,
    interventionSensitivity: 0.6,
    stabilityBias: 0.55,
    signalWeight: 1.0,
    description: 'Bridging actor, connects disparate clusters.'
  },
  phalanx: {
    id: 'phalanx',
    label: 'Phalanx',
    color: '#fb923c',
    posture: 'bloc-loyal',
    trust: 0.55,
    responsiveness: 0.5,
    interventionSensitivity: 0.3,
    stabilityBias: 0.75,
    signalWeight: 0.85,
    description: 'Follows dominant bloc, low independent agency.'
  }
};

function createActor(templateId, overrides = {}) {
  const template = ACTOR_TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown actor template: ${templateId}`);
  return Object.assign({}, template, overrides, {
    id: template.id,
    stance: 'neutral',
    lastAction: 'observing',
    alignedWith: [],
    attractorAffinity: null,
    interventionTargeted: false
  });
}

function getPostureLabel(actor) {
  const labels = {
    defensive: 'Defensive',
    mediating: 'Mediating',
    assertive: 'Assertive',
    opaque: 'Opaque',
    bridging: 'Bridging',
    'bloc-loyal': 'Bloc-Loyal'
  };
  return labels[actor.posture] || actor.posture;
}

function getStanceLabel(actor) {
  const labels = {
    neutral: 'Neutral',
    aligned: 'Aligned',
    contested: 'Contested',
    isolated: 'Isolated',
    pivoting: 'Pivoting',
    locked: 'Locked'
  };
  return labels[actor.stance] || actor.stance;
}

window.ActorSystem = {
  TEMPLATES: ACTOR_TEMPLATES,
  createActor,
  getPostureLabel,
  getStanceLabel
};
