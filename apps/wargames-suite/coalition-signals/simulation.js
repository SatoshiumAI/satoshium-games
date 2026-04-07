// ─── SIGNALS & ACTIONS ──────────────────────────────────────

const SIGNALS   = ['Reassurance','Deterrence','Ambiguity','Invitation','Warning','Restraint','Opportunistic Alignment'];
const ACTIONS   = ['Cooperate','Conditionally Cooperate','Hedge','Support','Defect','Isolate','Rebalance'];

const CONDITIONS = [
  { name: 'Status Quo Maintained',        threat: 0,   opp: 0   },
  { name: 'External Pressure Increased',  threat: +18, opp: -5  },
  { name: 'Diplomatic Window Opens',      threat: -10, opp: +20 },
  { name: 'Information Leak Detected',    threat: +12, opp: 0   },
  { name: 'Resource Scarcity Signals',    threat: +8,  opp: -8  },
  { name: 'New Opportunity Emerged',      threat: -8,  opp: +18 },
  { name: 'Alliance Structure Questioned',threat: +6,  opp: +6  },
  { name: 'Credibility Crisis',           threat: +15, opp: -10 }
];

// ─── STATE ──────────────────────────────────────────────────

let simState = null;

function createInitialState(scenarioId) {
  const actors = createActors();

  if (SCENARIOS[scenarioId]) {
    SCENARIOS[scenarioId].setup(actors);
  }

  updateCoalitions(actors);
  const metrics = calcMetrics(actors, 0);

  return {
    round:                  0,
    scenarioId,
    actors,
    condition:              { name: 'Initial State', threat: 15, opp: 15 },
    log:                    [],
    metrics,
    coalitionClassification: calcCoalitionClassification(actors, metrics),
    totalPivots:            0,
    isFinished:             false,
    prevMaturityTier:       null,
    decayTimer:             0,
    decayFromTier:          null,
    prevCoalitionMembers:      null,
    fractureTimer:             0,
    expansionTimer:            0,
    coalitionVolatilityWindow: []
  };
}

// ─── ROUND ENGINE ───────────────────────────────────────────

function runRound(state) {
  if (state.round >= 50) return { ...state, isFinished: true };

  const round    = state.round + 1;
  const actors   = deepClone(state.actors);
  const events   = [];
  let   pivots   = state.totalPivots;

  // ── Global condition shift
  const condRoll = Math.random();
  let cond;
  if (condRoll > 0.75) {
    cond = CONDITIONS[Math.floor(Math.random() * (CONDITIONS.length - 1)) + 1];
  } else {
    cond = CONDITIONS[0];
  }

  const newCond = {
    name:   cond.name,
    threat: clamp(state.condition.threat + cond.threat + randDelta(4), 0, 100),
    opp:    clamp(state.condition.opp    + cond.opp    + randDelta(4), 0, 100)
  };

  // ── Per-actor signal + action resolution
  ACTOR_IDS.forEach(id => {
    const actor = actors[id];
    const trustAvg = avgTrust(actor);

    // Pick signal based on attributes
    const signal = chooseSignal(actor, newCond);
    actor.stance = signal;

    // Pick targets for action
    ACTOR_IDS.forEach(oid => {
      if (oid === id) return;
      const target  = actors[oid];
      const myTrust = actor.trust[oid];
      const action  = chooseAction(actor, target, myTrust, newCond);

      // Trust effects
      let trustDelta = 0;
      switch (action) {
        case 'Cooperate':
        case 'Support':
          trustDelta = 4 + randDelta(3);
          events.push(reasonCoop(actor, target, signal, myTrust));
          break;
        case 'Conditionally Cooperate':
          trustDelta = 2 + randDelta(2);
          events.push(reasonConditional(actor, target, myTrust));
          break;
        case 'Hedge':
          trustDelta = randDelta(2);
          events.push(reasonHedge(actor, target));
          break;
        case 'Rebalance':
          trustDelta = -2 + randDelta(2);
          events.push(reasonRebalance(actor, target, trustAvg));
          break;
        case 'Defect':
        case 'Isolate':
          trustDelta = -(6 + randDelta(4));
          pivots++;
          events.push(reasonDefect(actor, target, newCond));
          break;
      }

      actor.lastAction = action;
      // Bidirectional trust update (response is proportional)
      const responseFactor = 0.5 + (target.attrs.sensitivityToThreat / 200);
      actor.trust[oid]    = clamp(myTrust           + trustDelta, 0, 100);
      target.trust[id]    = clamp(target.trust[id]  + trustDelta * responseFactor, 0, 100);
    });
  });

  // ── Coalition assignment
  updateCoalitions(actors);

  // ── Log coalition shifts
  const coalitionSummary = describeCoalitions(actors);
  if (coalitionSummary) events.push(coalitionSummary);

  const newMetrics        = calcMetrics(actors, pivots);
  const newClassification = calcCoalitionClassification(actors, newMetrics);

  // ── Coalition decay tracking ──────────────────────────────────
  // If the dominant coalition maturity tier drops between rounds, activate a
  // 2-round "DECAYING <prev-tier> COALITION" display window.
  const currTier  = newClassification.maturityTier || null;
  const prevTier  = state.prevMaturityTier          || null;

  let decayTimer    = state.decayTimer    || 0;
  let decayFromTier = state.decayFromTier || null;

  if (!currTier) {
    decayTimer    = 0;
    decayFromTier = null;
  } else if (prevTier && TIER_RANK[currTier] < TIER_RANK[prevTier]) {
    decayTimer    = 2;
    decayFromTier = prevTier;
  } else if (decayTimer > 0) {
    decayTimer--;
    if (decayTimer === 0) decayFromTier = null;
  }

  // ── Fracture detection ────────────────────────────────────────
  // If the dominant coalition loses members between rounds, activate a
  // 2-round "FRACTURED DOMINANT COALITION" window (takes label priority over decay).
  const currMembers = newClassification.members     || null;
  const prevMembers = state.prevCoalitionMembers    || null;

  let fractureTimer  = state.fractureTimer  || 0;
  let expansionTimer = state.expansionTimer || 0;

  if (!currMembers) {
    fractureTimer  = 0;
    expansionTimer = 0;
  } else if (prevMembers && currMembers.length < prevMembers.length) {
    fractureTimer = 2;
  } else if (fractureTimer > 0) {
    fractureTimer--;
  }

  // ── Expansion detection ───────────────────────────────────────
  // If the dominant coalition gained at least one member, activate a
  // 2-round "EXPANDING DOMINANT COALITION" window.
  if (currMembers && prevMembers && currMembers.length > prevMembers.length) {
    expansionTimer = 2;
  } else if (expansionTimer > 0) {
    expansionTimer--;
  }

  // ── Volatility window update ──────────────────────────────────
  // Append a snapshot for this round, keep the last 5, compute the tag.
  const windowEntry = {
    hadDominantCoalition: !!currMembers,
    memberCount:          currMembers ? currMembers.length : null,
    maturityTier:         currTier,
    fractureTriggered:    !!(currMembers && prevMembers && currMembers.length < prevMembers.length),
    expansionTriggered:   !!(currMembers && prevMembers && currMembers.length > prevMembers.length),
    pivotsDelta:          pivots - state.totalPivots
  };
  const nextWindow    = [...(state.coalitionVolatilityWindow || []), windowEntry].slice(-5);
  const volatilityTag = calcVolatilityTag(nextWindow, currTier);

  // ── Build displayed classification ────────────────────────────
  // Priority: fracture > expanding > decaying > volatility-tagged tier label.
  const displayClassification =
    (fractureTimer > 0 && currMembers)
      ? { ...newClassification,
          label:    'FRACTURED DOMINANT COALITION',
          baseLabel: 'DOMINANT COALITION' }
    : (expansionTimer > 0 && currMembers)
      ? { ...newClassification,
          label:    'EXPANDING DOMINANT COALITION',
          baseLabel: 'DOMINANT COALITION' }
    : (decayTimer > 0 && decayFromTier && currTier)
      ? { ...newClassification,
          label:    `DECAYING ${decayFromTier} COALITION`,
          baseLabel: 'DOMINANT COALITION' }
    : (volatilityTag && currTier)
      ? { ...newClassification,
          label:    `${volatilityTag} DOMINANT COALITION \u2014 ${currTier}`,
          baseLabel: 'DOMINANT COALITION' }
    : newClassification;

  // ── Emit interpretive log when classification meaningfully changes
  const prevLabel = state.coalitionClassification ? state.coalitionClassification.label : null;
  if (displayClassification.label !== prevLabel && prevLabel !== null) {
    events.push(`<strong>Coalition field reclassified:</strong> <em>${prevLabel}</em> \u2192 <em>${displayClassification.label}</em>.`);
  }

  return {
    round,
    scenarioId:              state.scenarioId,
    actors,
    condition:               newCond,
    log:                     [{ round, condition: newCond.name, events }, ...state.log].slice(0, 20),
    metrics:                 newMetrics,
    coalitionClassification: displayClassification,
    totalPivots:             pivots,
    isFinished:              false,
    prevMaturityTier:        currTier,
    decayTimer,
    decayFromTier,
    prevCoalitionMembers:      currMembers,
    fractureTimer,
    expansionTimer,
    coalitionVolatilityWindow: nextWindow
  };
}

// ─── SIGNAL + ACTION SELECTION ───────────────────────────────

function chooseSignal(actor, cond) {
  const { cooperationTendency: ct, sensitivityToThreat: st,
          riskTolerance: rt, preferenceForStability: ps } = actor.attrs;

  if (cond.threat > 65 && st > 60) return 'Warning';
  if (ct > 65 && avgTrust(actor) > 60) return 'Reassurance';
  if (rt > 70 && ps < 35) return 'Opportunistic Alignment';
  if (cond.opp > 60 && ct > 50) return 'Invitation';
  if (ps > 70) return 'Restraint';
  if (st > 65 && cond.threat > 50) return 'Deterrence';
  return 'Ambiguity';
}

function chooseAction(actor, target, myTrust, cond) {
  const { cooperationTendency: ct, sensitivityToThreat: st,
          riskTolerance: rt, preferenceForStability: ps,
          strategicPatience: sp } = actor.attrs;

  if (myTrust > 75 && ct > 55) return 'Cooperate';
  if (myTrust > 75 && ct > 40) return 'Support';
  if (myTrust > 55 && ct > 45 && sp > 50) return 'Conditionally Cooperate';
  if (myTrust < 25 && st > 65) return 'Defect';
  if (myTrust < 20 && rt < 40) return 'Isolate';
  if (cond.opp > 60 && rt > 65 && ps < 35) return 'Rebalance';
  return 'Hedge';
}

// ─── COALITION MATURITY TIER ──────────────────────────────────
//
// Reads the module-scope `edgeLifespan` object from topology.js (loaded after
// simulation.js, but always available at call-time). Computes average consecutive
// strong-alignment rounds across all internal pairs of the dominant coalition.
//
//  avg < 2   → FRAGILE       (just formed, untested)
//  avg 2–5   → STABILIZING   (holding, but not yet entrenched)
//  avg ≥ 6   → ENTRENCHED    (durable, high internal persistence)
//
function coalitionMaturityTier(memberIds) {
  if (typeof edgeLifespan === 'undefined' || memberIds.length < 2) return null;

  let total = 0, pairs = 0;
  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      // Canonical key order matches topology.js pair construction (ACTOR_IDS index order)
      const iRank = ACTOR_IDS.indexOf(memberIds[i]);
      const jRank = ACTOR_IDS.indexOf(memberIds[j]);
      const key   = iRank < jRank
        ? `${memberIds[i]}-${memberIds[j]}`
        : `${memberIds[j]}-${memberIds[i]}`;
      total += (edgeLifespan[key] || 0);
      pairs++;
    }
  }

  const avg = pairs > 0 ? total / pairs : 0;
  if (avg < 2) return 'FRAGILE';
  if (avg < 6) return 'STABILIZING';
  return 'ENTRENCHED';
}

// Tier ranking for decay comparison (higher number = stronger tier)
const TIER_RANK = { FRAGILE: 0, STABILIZING: 1, ENTRENCHED: 2 };

// ─── COALITION VOLATILITY TAG ─────────────────────────────────
//
// Inspects a rolling window of up to 5 round-level coalition snapshots to
// classify the coalition's current disposition prefix on the ribbon:
//
//  LOCKED   — fully entrenched, zero disturbances for ≥5 consecutive rounds
//  STABLE   — persisting coalition with low recent activity
//  VOLATILE — recent fractures, expansions, membership or tier changes
//
// Returns null when no dominant coalition exists or the window is empty.
//
function calcVolatilityTag(window, currTier) {
  if (!currTier || window.length === 0) return null;

  let score = 0;
  for (let i = 0; i < window.length; i++) {
    const e = window[i];
    if (!e.hadDominantCoalition) score += 3; // coalition broke in this window
    if (e.fractureTriggered)     score += 4; // explicit member-loss event
    if (e.expansionTriggered)    score += 3; // explicit member-gain event
    if (e.pivotsDelta > 1)       score += 1; // elevated defect/isolate activity
    if (i > 0) {
      if (window[i].memberCount  !== window[i - 1].memberCount)  score += 2; // membership shifted
      if (window[i].maturityTier !== window[i - 1].maturityTier) score += 2; // tier shifted
    }
  }

  // LOCKED: five full rounds of zero disturbance at ENTRENCHED level
  if (score === 0 &&
      currTier === 'ENTRENCHED' &&
      window.length >= 5 &&
      window.every(e => e.hadDominantCoalition)) {
    return 'LOCKED';
  }
  if (score >= 4) return 'VOLATILE';
  return 'STABLE';
}

// ─── COALITION CLASSIFICATION ────────────────────────────────

function calcCoalitionClassification(actors, metrics) {
  const blocs = {};
  ACTOR_IDS.forEach(id => {
    const cid = actors[id].coalitionId;
    if (cid) { blocs[cid] = blocs[cid] || []; blocs[cid].push(id); }
  });

  const blocList = Object.values(blocs).sort((a, b) => b.length - a.length);
  const isolated = ACTOR_IDS.filter(id => !actors[id].coalitionId).map(id => actors[id].name);

  if (blocList.length === 0) {
    if (metrics.systemVolatility > 65) {
      return { label: 'TRANSITIONAL FIELD', details: 'Coalition structure is actively shifting', sublabel: null };
    }
    return { label: 'FRAGMENTED SYSTEM', details: 'No stable coalition detected', sublabel: null };
  }

  const largest = blocList[0];
  const second  = blocList[1];

  if (largest.length >= 4) {
    const names = largest.map(id => actors[id].name).join(' \u2013 ');
    const tier  = coalitionMaturityTier(largest);
    return {
      label:        tier ? `DOMINANT COALITION \u2014 ${tier}` : 'DOMINANT COALITION',
      baseLabel:    'DOMINANT COALITION',
      maturityTier: tier || null,
      members:      largest,
      details:      names,
      sublabel:     isolated.length ? `${isolated.join(', ')} ${isolated.length === 1 ? 'remains' : 'remain'} isolated` : null
    };
  }

  if (second && second.length >= 2) {
    const a = largest.map(id => actors[id].name).join(' \u2013 ');
    const b = second.map(id => actors[id].name).join(' \u2013 ');
    return {
      label:    'DUAL-BLOC STRUCTURE',
      details:  a,
      sublabel: `vs \u2003 ${b}${isolated.length ? `\u2002\u00b7\u2002${isolated.join(', ')} uncommitted` : ''}`
    };
  }

  if (largest.length >= 2 && isolated.length >= 1) {
    const names = largest.map(id => actors[id].name).join(' \u2013 ');
    const floaters = isolated.join(' and ');
    return {
      label:    'PARTIAL ALIGNMENT',
      details:  names,
      sublabel: `${floaters} ${isolated.length === 1 ? 'remains' : 'remain'} uncommitted`
    };
  }

  if (metrics.systemVolatility > 65) {
    return { label: 'TRANSITIONAL FIELD', details: 'Coalition structure is actively shifting', sublabel: null };
  }

  return { label: 'FRAGMENTED SYSTEM', details: 'No stable coalition detected', sublabel: null };
}

// ─── COALITION STABILITY SCORE ────────────────────────────────

function calcCoalitionStability(actors, partialMetrics) {
  const blocs = {};
  ACTOR_IDS.forEach(id => {
    const cid = actors[id].coalitionId;
    if (cid) { blocs[cid] = blocs[cid] || []; blocs[cid].push(id); }
  });

  const blocList = Object.values(blocs).sort((a, b) => b.length - a.length);
  if (blocList.length === 0 || blocList[0].length < 2) return 0;

  const coalition = blocList[0];
  const outsiders = ACTOR_IDS.filter(id => !coalition.includes(id));

  // Average pairwise internal trust within the dominant coalition
  let internalSum = 0, internalCount = 0;
  for (let i = 0; i < coalition.length; i++) {
    for (let j = 0; j < coalition.length; j++) {
      if (i !== j) { internalSum += actors[coalition[i]].trust[coalition[j]]; internalCount++; }
    }
  }
  const internalTrust = internalCount > 0 ? internalSum / internalCount : 0;

  // Average trust from coalition members toward outsiders
  let externalSum = 0, externalCount = 0;
  coalition.forEach(id => {
    outsiders.forEach(oid => { externalSum += actors[id].trust[oid]; externalCount++; });
  });
  const externalTrust = externalCount > 0 ? externalSum / externalCount : 50;

  // Higher internal-vs-external gap → more stable
  const gap              = internalTrust - externalTrust;
  const volatilityPenalty = partialMetrics.systemVolatility * 0.35;
  const pivotPenalty      = Math.min(25, partialMetrics.totalPivots * 2);

  return Math.round(clamp(gap + 50 - volatilityPenalty - pivotPenalty, 0, 100) * 10) / 10;
}

// ─── COALITIONS ──────────────────────────────────────────────

function updateCoalitions(actors) {
  // Reset
  ACTOR_IDS.forEach(id => { actors[id].coalitionId = null; });

  let nextId = 0;

  ACTOR_IDS.forEach(id => {
    if (actors[id].coalitionId) return;
    const allies = ACTOR_IDS.filter(oid =>
      oid !== id &&
      actors[id].trust[oid] > 70 &&
      actors[oid].trust[id] > 70
    );

    if (allies.length > 0) {
      const existingCoalition = allies.map(a => actors[a].coalitionId).find(c => c);
      const cId = existingCoalition || `bloc_${nextId++}`;
      actors[id].coalitionId = cId;
      allies.forEach(oid => {
        if (!actors[oid].coalitionId || actors[oid].coalitionId !== cId) {
          actors[oid].coalitionId = cId;
        }
      });
    }
  });
}

function describeCoalitions(actors) {
  const blocs = {};
  ACTOR_IDS.forEach(id => {
    const cid = actors[id].coalitionId;
    if (cid) { blocs[cid] = blocs[cid] || []; blocs[cid].push(actors[id].name); }
  });

  const bNames = Object.values(blocs);
  const isolated = ACTOR_IDS.filter(id => !actors[id].coalitionId).map(id => actors[id].name);

  const parts = [];
  bNames.forEach(names => {
    if (names.length >= 2) parts.push(`<strong>${names.join('–')}</strong> bloc active`);
  });
  if (isolated.length) parts.push(`${isolated.join(', ')} ${isolated.length === 1 ? 'is' : 'are'} unaligned`);

  return parts.length ? 'Coalition map: ' + parts.join('. ') + '.' : null;
}

// ─── EXPLAINABILITY TEXT ─────────────────────────────────────

function reasonCoop(actor, target, signal, trust) {
  const { strategicPatience: sp, cooperationTendency: ct } = actor.attrs;
  const trustWord = trust > 80 ? 'strong' : 'moderate';
  const patWord   = sp > 65 ? 'high strategic patience' : 'alignment incentive';
  return `<em>${actor.name}</em> emitted <em>${signal}</em> toward <strong>${target.name}</strong>. (${trustWord} trust + ${patWord} — reinforcing existing alignment.)`;
}

function reasonConditional(actor, target, trust) {
  return `<em>${actor.name}</em> offered <em>conditional cooperation</em> to <strong>${target.name}</strong>. (Trust at ${trust.toFixed(0)} — cautious alignment without full commitment.)`;
}

function reasonHedge(actor, target) {
  const { preferenceForStability: ps } = actor.attrs;
  const reason = ps > 60 ? 'preserving optionality' : 'reading signals before committing';
  return `<em>${actor.name}</em> <em>hedged</em> toward <strong>${target.name}</strong>, ${reason}.`;
}

function reasonRebalance(actor, target, avgTrustVal) {
  return `<em>${actor.name}</em> is <em>rebalancing</em> away from <strong>${target.name}</strong>. (Low preference for stability + new opportunity signal — pivoting toward stronger bloc.)`;
}

function reasonDefect(actor, target, cond) {
  const { sensitivityToThreat: st, cooperationTendency: ct } = actor.attrs;
  const why = st > 70 ? 'high threat sensitivity' : ct < 30 ? 'low cooperation tendency' : 'strategic pressure';
  return `<em>${actor.name}</em> <strong>DEFECTED</strong> from alignment with <strong>${target.name}</strong>. (${why} triggered opportunistic rebalancing — trust declining.)`;
}

// ─── METRICS ─────────────────────────────────────────────────

function calcMetrics(actors, pivots) {
  const list = ACTOR_IDS.map(id => actors[id]);
  let totalTrust = 0, pairCount = 0;

  list.forEach(a => {
    ACTOR_IDS.forEach(oid => {
      if (oid !== a.id) { totalTrust += a.trust[oid]; pairCount++; }
    });
  });

  const trustDensity = pairCount > 0 ? totalTrust / pairCount : 0;

  const blocs = {};
  list.forEach(a => {
    if (a.coalitionId) blocs[a.coalitionId] = (blocs[a.coalitionId] || 0) + 1;
  });

  const blocSizes   = Object.values(blocs);
  const dominantBloc = blocSizes.length > 0 ? Math.max(...blocSizes) / list.length * 100 : 0;
  const fragmentation = blocSizes.length / list.length * 100;

  const coopCount = list.filter(a => ['Cooperate','Support','Conditionally Cooperate'].includes(a.lastAction)).length;
  const cooperationRatio = list.length > 0 ? (coopCount / list.length) * 100 : 50;

  const systemVolatility = Math.round((100 - trustDensity) * 10) / 10;
  const partialMetrics   = { systemVolatility, totalPivots: pivots };

  return {
    trustDensity:         Math.round(trustDensity * 10) / 10,
    fragmentationIndex:   Math.round(fragmentation * 10) / 10,
    dominantBlocStrength: Math.round(dominantBloc * 10) / 10,
    cooperationRatio:     Math.round(cooperationRatio * 10) / 10,
    systemVolatility,
    totalPivots:          pivots,
    coalitionStability:   calcCoalitionStability(actors, partialMetrics)
  };
}

// ─── HELPERS ─────────────────────────────────────────────────

function avgTrust(actor) {
  const others = ACTOR_IDS.filter(oid => oid !== actor.id);
  if (!others.length) return 0;
  return others.reduce((sum, oid) => sum + actor.trust[oid], 0) / others.length;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randDelta(n)      { return Math.round((Math.random() - 0.5) * 2 * n); }
function deepClone(o)      { return JSON.parse(JSON.stringify(o)); }
