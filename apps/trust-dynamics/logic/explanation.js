/**
 * explanation.js
 * Narrative explanation engine for the Trust Dynamics simulation.
 *
 * Generates readable, causal, non-technical narrative from simulation state.
 * All output is plain English — no formulas, no jargon.
 */

const CAUSE_PHRASES = {
  high_inconsistency: [
    'repeated inconsistency in behavior',
    'erratic signaling from counterparts',
    'unpredictable patterns in the environment',
  ],
  high_pressure: [
    'sustained environmental pressure',
    'mounting pressure exposing weak links',
    'stress conditions testing the relationship',
  ],
  conflict: [
    'rising conflict intensity across the system',
    'active conflict straining the connection',
    'conflict signals spreading through the network',
  ],
  scarcity: [
    'resource scarcity creating competitive tension',
    'scarcity conditions reducing cooperative incentive',
  ],
  betrayal_sensitive: [
    'a high sensitivity to perceived betrayal',
    'a low tolerance for inconsistency',
  ],
  low_reliability: [
    'continued unreliable behavior from the counterpart',
    'a track record of unreliability',
  ],
  memory_drag: [
    'lingering memory of past damage',
    'the weight of previous breakdowns holding back repair',
  ],
  transparency: [
    'improved visibility into intentions and behavior',
    'greater transparency allowing for reassessment',
  ],
  recovery_opportunity: [
    'a genuine opportunity to rebuild',
    'conditions allowing for measured reconciliation',
  ],
  cooperation_incentive: [
    'shared incentives for cooperation',
    'aligned interests reducing competitive friction',
  ],
  mutual_repair: [
    'willingness on both sides to repair the relationship',
    'active effort from both parties to rebuild trust',
  ],
  strong_reliability: [
    'consistently reliable behavior over time',
    'a track record of dependability',
  ],
  gradual_erosion: [
    'slow, cumulative erosion under background conditions',
    'gradual drift driven by environmental friction',
  ],
  gradual_recovery: [
    'a quiet, steady improvement in conditions',
    'slow but consistent repair signals',
  ],
};

function getCausePhrase(cause) {
  const phrases = CAUSE_PHRASES[cause];
  if (!phrases) return cause;
  return phrases[Math.floor(pseudoRandom(cause + 'phrase') * phrases.length)];
}

/**
 * Generate a narrative for a single round.
 * Returns an array of narrative line strings.
 */
function generateRoundNarrative(agents, metrics, deltas, explanationHints, conditions, round) {
  const lines = [];
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  lines.push(`— Round ${round} —`);

  // Opening system-level summary
  lines.push(generateSystemSummary(metrics, conditions));

  // Notable relationship changes
  const significant = explanationHints
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  for (const hint of significant) {
    const src = agentMap[hint.from];
    const tgt = agentMap[hint.to];
    if (!src || !tgt) continue;
    const cause = hint.causes[0];
    const phrase = getCausePhrase(cause);
    if (hint.delta < -6) {
      lines.push(`Trust weakened between ${src.name} and ${tgt.name} — driven by ${phrase}.`);
    } else if (hint.delta < -2) {
      lines.push(`${src.name}'s confidence in ${tgt.name} slipped slightly, influenced by ${phrase}.`);
    } else if (hint.delta > 6) {
      lines.push(`Trust strengthened between ${src.name} and ${tgt.name}, supported by ${phrase}.`);
    } else if (hint.delta > 2) {
      lines.push(`${src.name} is gradually extending more trust toward ${tgt.name}, aided by ${phrase}.`);
    }
  }

  // Anchor commentary
  const anchors = identifyAnchors(agents, Object.fromEntries(
    agents.map(a => [a.id, Object.fromEntries(
      agents.filter(b => b.id !== a.id).map(b => [b.id, 0])
    )])
  ));

  // This is just a structure placeholder — real anchor data comes from main.js
  // We use the hints to detect if an anchor is under stress
  const highInfluence = agents.filter(a => a.traits.influenceWeight > 0.75);
  for (const anchor of highInfluence) {
    const incomingDeltas = explanationHints.filter(h => h.to === anchor.id && h.delta < -4);
    if (incomingDeltas.length >= 2) {
      lines.push(`${anchor.name} — acting as a network anchor — is facing declining trust from multiple agents. If this continues, dependent links may fracture.`);
    }
  }

  // Anchor dependency commentary
  if (metrics.anchorShare > 0.35 && metrics.anchorName) {
    lines.push(`The network currently depends heavily on ${metrics.anchorName} as a trust anchor. If this node weakens, cascade risk may increase rapidly.`);
  }

  // Anchor vacuum commentary — no agent holding meaningful anchor position
  if (metrics.anchorVacuum) {
    lines.push(`No agent is currently acting as a stable trust anchor. The network may drift toward fragmentation or opportunistic clustering.`);
  }

  // Anchor competition commentary — fires when top 3 are within 7 points
  if (metrics.anchorCompetition) {
    lines.push(`Multiple agents are competing for anchor status. The network may reorganize into a multi-centered trust structure.`);
  }

  // Displacement risk commentary — fires on the round the condition is confirmed
  if (metrics.displacementRisk) {
    lines.push(`Another agent is approaching anchor status while the current anchor weakens. A leadership transition may occur soon.`);
  }

  // Anchor transition commentary
  if (metrics.anchorTransition) {
    const { from, to, prevFragility } = metrics.anchorTransition;
    lines.push(`The network anchor has shifted from ${from} to ${to}. Structural leadership within the trust network is reconfiguring.`);
    if (prevFragility === 'RISING') {
      lines.push(`The previous anchor weakened before the transition. The network may be reorganizing around a new center of trust.`);
    }
  }

  // Anchor fragility commentary
  if (metrics.anchorFragility === 'RISING' && metrics.anchorName) {
    lines.push(`The network anchor ${metrics.anchorName} is weakening. Collapse risk may accelerate if erosion continues.`);
  }

  // Cascade risk commentary
  if (metrics.cascadeRisk > 65) {
    lines.push(`Cascade risk is elevated. Several damaged relationships may pull nearby links into decline.`);
  } else if (metrics.cascadeRisk < 20 && metrics.networkTrust > 60) {
    lines.push(`The network shows no immediate cascade risk. Trust is distributed and stable.`);
  }

  // Asymmetry commentary
  if (metrics.trustAsymmetry > 25) {
    lines.push(`Trust asymmetry remains high — some relationships are deeply unequal. Coordination may remain fragile without alignment.`);
  } else if (metrics.trustAsymmetry < 10) {
    lines.push(`Trust flows are becoming more balanced across pairs. Mutual confidence is growing.`);
  }

  // Repair commentary
  if (metrics.repairingLinks > 0 && conditions.recoveryOpportunity > 0.4) {
    lines.push(`${metrics.repairingLinks} relationship${metrics.repairingLinks > 1 ? 's are' : ' is'} in early repair — fragile, but showing movement in the right direction.`);
  }

  if (metrics.brokenLinks > 0) {
    lines.push(`${metrics.brokenLinks} relationship${metrics.brokenLinks > 1 ? 's have' : ' has'} fallen to critical levels. These links may be approaching irreversible collapse.`);
  }

  if (explanationHints.length === 0) {
    lines.push('No significant trust changes occurred this round. The system is holding steady.');
  }

  return lines;
}

/**
 * Generate a high-level system summary sentence.
 */
function generateSystemSummary(metrics, conditions) {
  const { networkTrust, stability, cascadeRisk } = metrics;
  const { pressure, transparency, inconsistency } = conditions;

  if (networkTrust > 70 && stability > 70) {
    return 'The trust network is healthy and broadly stable. Agents are maintaining strong cooperative links.';
  }
  if (networkTrust > 50 && stability > 50 && cascadeRisk < 30) {
    return 'Trust levels are moderate. The network is functional, though some relationships remain fragile.';
  }
  if (networkTrust < 35 && cascadeRisk > 55) {
    return 'Trust across the system is severely degraded. Cascade risk is high — the network may be approaching structural collapse.';
  }
  if (inconsistency > 0.65 && pressure > 0.6) {
    return 'High pressure and persistent inconsistency are actively eroding trust throughout the network.';
  }
  if (transparency > 0.65 && networkTrust < 55) {
    return 'Transparency is creating space for repair, but trust has not yet recovered to stable levels.';
  }
  if (stability < 40 && cascadeRisk > 40) {
    return 'A significant portion of trust links are below the stability threshold. The network is at risk.';
  }
  return 'The trust network is in transition. Key relationships are shifting — watch for emerging patterns.';
}

/**
 * Generate intro narrative for a scenario load.
 */
function generateScenarioIntro(scenario) {
  return scenario.intro || ['Simulation ready. Step forward to observe trust dynamics.'];
}

/**
 * Generate a static summary for the current state (used on pause/reset).
 */
function generateStateSummary(agents, metrics, conditions) {
  const lines = [];
  lines.push('— Current State —');
  lines.push(generateSystemSummary(metrics, conditions));

  const dominantCondition = getDominantCondition(conditions);
  if (dominantCondition) {
    lines.push(`The dominant environmental force is ${dominantCondition.label}. This is shaping most trust dynamics in the system.`);
  }

  const anchors = agents
    .filter(a => a.traits.influenceWeight > 0.75)
    .map(a => a.name);
  if (anchors.length > 0) {
    lines.push(`${anchors.join(' and ')} ${anchors.length > 1 ? 'carry' : 'carries'} significant influence in the network. Their trust relationships affect the whole system.`);
  }

  return lines;
}

function getDominantCondition(conditions) {
  const entries = [
    { key: 'pressure', label: 'environmental pressure', value: conditions.pressure },
    { key: 'transparency', label: 'transparency', value: conditions.transparency },
    { key: 'inconsistency', label: 'inconsistency', value: conditions.inconsistency },
    { key: 'conflictIntensity', label: 'conflict intensity', value: conditions.conflictIntensity },
    { key: 'recoveryOpportunity', label: 'recovery opportunity', value: conditions.recoveryOpportunity },
    { key: 'cooperationIncentive', label: 'cooperation incentive', value: conditions.cooperationIncentive },
    { key: 'scarcity', label: 'scarcity', value: conditions.scarcity },
  ];
  const dominant = entries.sort((a, b) => b.value - a.value)[0];
  return dominant.value > 0.55 ? dominant : null;
}

function pseudoRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}
