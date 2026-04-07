// simulation.js — Core simulation engine for Strategic Signal Lab

const SimulationEngine = (() => {
  let state = null;
  let running = false;
  let intervalHandle = null;
  let speed = 1800;
  let onTick = null;

  // ─── Internal helpers ───────────────────────────────────────────────────────

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand() { return Math.random(); }
  function rn(v, d) { return Math.round(v * 10 ** d) / 10 ** d; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function classifyAttractors(state) {
    const s = state.metrics;
    const results = [];

    const blocs = detectBlocs(state.links, state.actors);
    blocs.forEach(bloc => {
      const avgTrust = bloc.members.reduce((sum, id) => {
        const a = state.actors.find(x => x.id === id);
        return sum + (a ? a.trust : 0.5);
      }, 0) / bloc.members.length;

      const size = bloc.members.length;
      const confidence = s.attractorConfidence;
      const interv = s.interventionLoad;
      let type = 'weak';
      let label = '';

      if (confidence > 0.7 && interv < 0.4) { type = 'stable'; label = 'STABLE ATTRACTOR'; }
      else if (confidence > 0.5 && interv > 0.6) { type = 'false'; label = 'FALSE ATTRACTOR'; }
      else if (confidence > 0.4) { type = 'forming'; label = 'FORMING ATTRACTOR'; }
      else if (blocs.length >= 2 && confidence > 0.25) { type = 'contested'; label = 'CONTESTED'; }

      if (size >= 2) {
        results.push({ members: bloc.members, type, label, confidence });
      }
    });

    return results;
  }

  function detectBlocs(links, actors) {
    const adj = {};
    actors.forEach(a => { adj[a.id] = []; });
    links.forEach(l => {
      if (l.strength > 0.4) {
        adj[l.a]?.push(l.b);
        adj[l.b]?.push(l.a);
      }
    });

    const visited = new Set();
    const blocs = [];
    actors.forEach(a => {
      if (visited.has(a.id)) return;
      const cluster = [];
      const queue = [a.id];
      while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        cluster.push(id);
        (adj[id] || []).forEach(nb => { if (!visited.has(nb)) queue.push(nb); });
      }
      if (cluster.length >= 2) blocs.push({ members: cluster });
    });
    return blocs;
  }

  function computeFieldCondition(metrics, attractors) {
    const { signalCoherence, attractorConfidence, fragmentation, volatility,
      interventionLoad, falseConvergenceRisk, coordinationRatio } = metrics;

    if (falseConvergenceRisk > 0.75) return 'FALSE CONVERGENCE RISK';
    if (attractors.length >= 2 && attractors.every(a => a.type === 'contested' || a.type === 'forming')) return 'CONTESTED ATTRACTOR';
    if (attractorConfidence > 0.7 && interventionLoad < 0.35) return 'STABLE ATTRACTOR';
    if (attractorConfidence > 0.5 && coordinationRatio > 0.55) return 'ATTRACTOR FORMING';
    if (fragmentation > 0.75) return 'FRAGMENTING SYSTEM';
    if (coordinationRatio > 0.6 && interventionLoad > 0.5) return 'TEMPORARY COORDINATION WINDOW';
    if (interventionLoad > 0.65) return 'HIGH INTERVENTION DEPENDENCE';
    return 'OPEN STRATEGIC FIELD';
  }

  function generateExplanation(prevMetrics, metrics, actors, links, appliedIntervention, round) {
    const lines = [];
    const fc = metrics.fieldCondition;
    const coherenceDelta = metrics.signalCoherence - prevMetrics.signalCoherence;
    const fragDelta = metrics.fragmentation - prevMetrics.fragmentation;
    const confDelta = metrics.attractorConfidence - prevMetrics.attractorConfidence;

    const swingActors = actors.filter(a => a.stance === 'pivoting' || a.stance === 'contested');
    const alignedActors = actors.filter(a => a.stance === 'aligned');
    const isolatedActors = actors.filter(a => a.stance === 'isolated');

    lines.push(`Round ${round}: Field condition — ${fc}.`);

    if (appliedIntervention) {
      const effects = explainInterventionEffect(appliedIntervention, coherenceDelta, metrics);
      lines.push(effects);
    } else {
      if (Math.abs(coherenceDelta) > 0.03) {
        lines.push(`Signal coherence ${coherenceDelta > 0 ? 'increased' : 'decreased'} by ${rn(Math.abs(coherenceDelta) * 100, 1)} points — ${coherenceDelta > 0 ? 'actors are reading signals more consistently' : 'signal noise is rising'}.`);
      }
    }

    if (alignedActors.length > 2) {
      const names = alignedActors.map(a => a.label).join(', ');
      lines.push(`${names} are maintaining aligned postures.`);
    }
    if (swingActors.length > 0) {
      const names = swingActors.map(a => a.label).join(' and ');
      lines.push(`${names} ${swingActors.length > 1 ? 'are' : 'is'} pivoting — holding leverage as swing actor${swingActors.length > 1 ? 's' : ''}.`);
    }
    if (isolatedActors.length > 0) {
      lines.push(`${isolatedActors.map(a => a.label).join(', ')} ha${isolatedActors.length > 1 ? 've' : 's'} limited signal reach — operating in isolation.`);
    }

    if (fc === 'FALSE CONVERGENCE RISK') {
      lines.push('Warning: apparent coordination is intervention-dependent. Endogenous trust remains insufficient to sustain the current field state.');
    } else if (fc === 'CONTESTED ATTRACTOR') {
      const blocs = detectBlocs(links, actors);
      if (blocs.length >= 2) {
        lines.push(`Two competing attractors are visible: one centered on ${blocs[0].members.join('-')}, another on ${blocs[1].members.join('-')}.`);
      }
    } else if (fc === 'STABLE ATTRACTOR') {
      lines.push('Attractor confidence is high and intervention load is low — current coordination appears endogenous and durable.');
    } else if (fc === 'FRAGMENTING SYSTEM') {
      lines.push('Signal channels are degrading faster than trust can be rebuilt. Coordination cost is increasing each round.');
    } else if (fc === 'TEMPORARY COORDINATION WINDOW') {
      lines.push('The coordination window is open — but high intervention load suggests this order is externally maintained, not self-sustaining.');
    }

    if (confDelta < -0.04) lines.push('Attractor confidence has declined — the forming pattern may be dissolving.');
    if (metrics.volatility > 0.75) lines.push('Field volatility is high — unpredictable realignments are possible next round.');

    return lines;
  }

  function explainInterventionEffect(intervention, coherenceDelta, metrics) {
    const id = intervention.id;
    const map = {
      'amplify-signal': `Signal amplification raised coherence by ${rn(Math.abs(coherenceDelta) * 100, 1)} points — but attractor confidence requires endogenous trust, not amplification alone.`,
      'dampen-signal': `Signal dampening reduced volatility but slowed convergence. The field is quieter but more ambiguous.`,
      'introduce-ambiguity': `Ambiguity injection prevented fragmentation in the short term. Long-term signal credibility has decreased — actors will discount future signals.`,
      'reinforce-trust': `Trust reinforcement strengthened link integrity. Attractor confidence increased, but only for actors in the target cluster.`,
      'destabilize-trust': `Trust destabilization fractured a provisional link. The affected actors are now pivoting — their next alignment is uncertain.`,
      'open-coordination': `A coordination window has been opened artificially. Intervention load increased — stability is now externally dependent.`,
      'isolate-actor': `Isolation severed the targeted actor from its primary channels. It must seek new alignments or remain isolated.`,
      'increase-pressure': `Systemic pressure increased. Actors are being forced to commit or defect — the field is entering a decision phase.`,
      'reduce-volatility': `Volatility reduced. The field has stabilized temporarily, but underlying structural tensions remain.`,
      'split-attention': `Attention split across signals. Bloc cohesion has weakened — previously aligned actors are less coordinated.`,
      'test-attractor': `Attractor resilience tested. ${metrics.falseConvergenceRisk > 0.6 ? 'The probe revealed fragility — this attractor is likely false.' : 'The attractor showed moderate resilience — confidence is genuine, though not guaranteed.'}`
    };
    return map[id] || `Intervention ${intervention.label} applied. Field state has updated.`;
  }

  // ─── Tick logic ──────────────────────────────────────────────────────────────

  function tick(appliedIntervention) {
    if (!state) return;

    const prev = JSON.parse(JSON.stringify(state.metrics));
    const scenario = state.scenario;
    const vm = scenario.volatilityMod || 1.0;
    const cm = scenario.coherenceMod || 1.0;

    const m = state.metrics;
    const noise = () => (rand() - 0.5) * 0.08;

    // Simulate field dynamics
    let coherenceTarget = m.signalCoherence;
    let attractorTarget = m.attractorConfidence;
    let fragTarget = m.fragmentation;
    let volTarget = m.volatility;
    let intervLoad = m.interventionLoad;
    let coordRatio = m.coordinationRatio;
    let fcRisk = m.falseConvergenceRisk;

    // Natural decay and drift
    coherenceTarget = clamp(coherenceTarget + noise() * cm, 0, 1);
    fragTarget = clamp(fragTarget + noise() * vm * 0.5, 0, 1);
    volTarget = clamp(volTarget + noise() * 0.3, 0, 1);
    intervLoad = clamp(intervLoad * 0.92 + noise() * 0.05, 0, 1);
    coordRatio = clamp(lerp(coordRatio, coherenceTarget, 0.12) + noise() * 0.06, 0, 1);
    attractorTarget = clamp(coherenceTarget * coordRatio * 0.9 + noise() * 0.06, 0, 1);
    fcRisk = clamp(intervLoad * 0.6 + (1 - attractorTarget) * intervLoad * 0.5 + noise() * 0.04, 0, 1);

    // Apply intervention effects
    if (appliedIntervention) {
      const effects = applyInterventionToMetrics(appliedIntervention, {
        coherenceTarget, attractorTarget, fragTarget, volTarget,
        intervLoad, coordRatio, fcRisk
      }, scenario);
      coherenceTarget = effects.coherenceTarget;
      attractorTarget = effects.attractorTarget;
      fragTarget = effects.fragTarget;
      volTarget = effects.volTarget;
      intervLoad = effects.intervLoad;
      coordRatio = effects.coordRatio;
      fcRisk = effects.fcRisk;
    }

    // Smooth updates
    m.signalCoherence = clamp(lerp(m.signalCoherence, coherenceTarget, 0.35), 0, 1);
    m.attractorConfidence = clamp(lerp(m.attractorConfidence, attractorTarget, 0.25), 0, 1);
    m.fragmentation = clamp(lerp(m.fragmentation, fragTarget, 0.25), 0, 1);
    m.volatility = clamp(lerp(m.volatility, volTarget, 0.2), 0, 1);
    m.interventionLoad = clamp(intervLoad, 0, 1);
    m.coordinationRatio = clamp(lerp(m.coordinationRatio, coordRatio, 0.3), 0, 1);
    m.falseConvergenceRisk = clamp(lerp(m.falseConvergenceRisk, fcRisk, 0.3), 0, 1);

    // Update links
    updateLinks(appliedIntervention);

    // Update actor stances
    updateActorStances(appliedIntervention);

    // Classify attractors
    state.attractors = classifyAttractors(state);

    // Update field condition
    m.fieldCondition = computeFieldCondition(m, state.attractors);

    // Generate explanation
    const explanation = generateExplanation(prev, m, state.actors, state.links, appliedIntervention, state.round);

    state.round++;
    state.lastExplanation = explanation;
    state.lastIntervention = appliedIntervention;

    return { ...state };
  }

  function applyInterventionToMetrics(intervention, m, scenario) {
    const r = () => (rand() - 0.5) * 0.04;
    switch (intervention.id) {
      case 'amplify-signal':
        m.coherenceTarget = clamp(m.coherenceTarget + 0.12 + r(), 0, 1);
        m.coordRatio = clamp(m.coordRatio + 0.08 + r(), 0, 1);
        m.intervLoad = clamp(m.intervLoad + 0.15, 0, 1);
        m.fcRisk = clamp(m.fcRisk + 0.1 + r(), 0, 1);
        break;
      case 'dampen-signal':
        m.coherenceTarget = clamp(m.coherenceTarget - 0.08 + r(), 0, 1);
        m.volTarget = clamp(m.volTarget - 0.12 + r(), 0, 1);
        m.fragTarget = clamp(m.fragTarget + 0.06 + r(), 0, 1);
        break;
      case 'introduce-ambiguity':
        m.coherenceTarget = clamp(m.coherenceTarget - 0.06 + r(), 0, 1);
        m.fragTarget = clamp(m.fragTarget - 0.04 + r(), 0, 1);
        m.volTarget = clamp(m.volTarget + 0.04 + r(), 0, 1);
        m.fcRisk = clamp(m.fcRisk + 0.06 + r(), 0, 1);
        break;
      case 'reinforce-trust':
        m.attractorTarget = clamp(m.attractorTarget + 0.15 + r(), 0, 1);
        m.coordRatio = clamp(m.coordRatio + 0.1 + r(), 0, 1);
        m.intervLoad = clamp(m.intervLoad + 0.1, 0, 1);
        m.fcRisk = clamp(m.fcRisk + 0.08, 0, 1);
        break;
      case 'destabilize-trust':
        m.attractorTarget = clamp(m.attractorTarget - 0.15 + r(), 0, 1);
        m.volTarget = clamp(m.volTarget + 0.14 + r(), 0, 1);
        m.fragTarget = clamp(m.fragTarget + 0.1 + r(), 0, 1);
        m.coordRatio = clamp(m.coordRatio - 0.08 + r(), 0, 1);
        break;
      case 'open-coordination':
        m.coordRatio = clamp(m.coordRatio + 0.18 + r(), 0, 1);
        m.coherenceTarget = clamp(m.coherenceTarget + 0.08 + r(), 0, 1);
        m.intervLoad = clamp(m.intervLoad + 0.25, 0, 1);
        m.fcRisk = clamp(m.fcRisk + 0.2 + r(), 0, 1);
        break;
      case 'isolate-actor':
        m.fragTarget = clamp(m.fragTarget + 0.12 + r(), 0, 1);
        m.volTarget = clamp(m.volTarget + 0.1 + r(), 0, 1);
        m.coordRatio = clamp(m.coordRatio - 0.06 + r(), 0, 1);
        break;
      case 'increase-pressure':
        m.volTarget = clamp(m.volTarget + 0.18 + r(), 0, 1);
        m.fragTarget = clamp(m.fragTarget + 0.08 + r(), 0, 1);
        m.attractorTarget = clamp(m.attractorTarget + (rand() > 0.5 ? 0.08 : -0.06), 0, 1);
        break;
      case 'reduce-volatility':
        m.volTarget = clamp(m.volTarget - 0.18 + r(), 0, 1);
        m.coherenceTarget = clamp(m.coherenceTarget + 0.04 + r(), 0, 1);
        break;
      case 'split-attention':
        m.coherenceTarget = clamp(m.coherenceTarget - 0.1 + r(), 0, 1);
        m.coordRatio = clamp(m.coordRatio - 0.12 + r(), 0, 1);
        m.volTarget = clamp(m.volTarget + 0.08 + r(), 0, 1);
        break;
      case 'test-attractor':
        const genuine = m.fcRisk < 0.5;
        m.attractorTarget = clamp(m.attractorTarget + (genuine ? 0.05 : -0.08) + r(), 0, 1);
        m.intervLoad = clamp(m.intervLoad + 0.05, 0, 1);
        break;
    }
    return m;
  }

  function updateLinks(appliedIntervention) {
    if (!state) return;
    const noise = () => (rand() - 0.5) * 0.06;

    state.links.forEach(link => {
      link.strength = clamp(link.strength + noise(), 0.05, 1);
      if (link.strength < 0.15 && link.type !== 'strong') link.type = 'weak';
      else if (link.strength > 0.55 && link.type === 'weak') link.type = 'provisional';
      else if (link.strength > 0.72) link.type = 'strong';
    });

    state.links = state.links.filter(l => l.strength > 0.08);

    if (appliedIntervention) {
      if (appliedIntervention.id === 'destabilize-trust' || appliedIntervention.id === 'isolate-actor') {
        if (state.links.length > 1) {
          const idx = Math.floor(rand() * state.links.length);
          state.links[idx].strength = clamp(state.links[idx].strength - 0.2, 0.05, 1);
        }
      }
      if (appliedIntervention.id === 'reinforce-trust' && rand() > 0.4) {
        const actors = state.actors;
        const a = actors[Math.floor(rand() * actors.length)];
        const b = actors[Math.floor(rand() * actors.length)];
        if (a.id !== b.id && !state.links.find(l => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))) {
          state.links.push({ a: a.id, b: b.id, strength: 0.35, type: 'provisional' });
        }
      }
    }

    if (rand() > 0.65 && state.actors.length > 3) {
      const actors = state.actors;
      const a = actors[Math.floor(rand() * actors.length)];
      const b = actors[Math.floor(rand() * actors.length)];
      if (a.id !== b.id && !state.links.find(l => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))) {
        state.links.push({ a: a.id, b: b.id, strength: 0.18, type: 'weak' });
      }
    }
  }

  function updateActorStances(appliedIntervention) {
    if (!state) return;
    const m = state.metrics;

    state.actors.forEach(a => {
      a.interventionTargeted = false;

      const connected = state.links.filter(l => l.a === a.id || l.b === a.id);
      const avgStrength = connected.length > 0
        ? connected.reduce((s, l) => s + l.strength, 0) / connected.length : 0;

      if (connected.length === 0) {
        a.stance = 'isolated';
        a.lastAction = 'isolated — no active signal channels';
      } else if (avgStrength > 0.65 && a.trust > 0.5) {
        a.stance = 'aligned';
        a.trust = clamp(a.trust + (Math.random() - 0.45) * 0.04, 0, 1);
        a.lastAction = 'sustaining alignment signals';
      } else if (m.volatility > 0.65 && Math.random() > 0.5) {
        a.stance = 'pivoting';
        a.lastAction = 'repositioning — field volatility high';
      } else if (avgStrength > 0.4 && avgStrength < 0.65) {
        a.stance = 'contested';
        a.lastAction = 'receiving contradictory signals';
      } else {
        a.stance = 'neutral';
        a.trust = clamp(a.trust + (Math.random() - 0.5) * 0.03, 0.05, 1);
        a.lastAction = 'monitoring field conditions';
      }

      if (appliedIntervention && appliedIntervention.id === 'isolate-actor') {
        const targetIdx = Math.floor(Math.random() * state.actors.length);
        if (state.actors[targetIdx].id === a.id) {
          a.stance = 'isolated';
          a.interventionTargeted = true;
          a.lastAction = 'severed — isolation intervention applied';
        }
      }
      if (appliedIntervention && appliedIntervention.id === 'reinforce-trust') {
        if (Math.random() > 0.5) {
          a.interventionTargeted = true;
          a.trust = clamp(a.trust + 0.08, 0, 1);
          a.lastAction = 'trust reinforcement received';
        }
      }
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  function loadScenario(scenario) {
    const actors = scenario.actors.map(id => {
      const overrides = scenario.actorOverrides ? (scenario.actorOverrides[id] || {}) : {};
      return window.ActorSystem.createActor(id, overrides);
    });

    const links = scenario.initialLinks.map(l => ({ ...l }));

    const metrics = { ...scenario.initialMetrics, fieldCondition: scenario.fieldCondition };

    state = {
      scenario,
      actors,
      links,
      metrics,
      attractors: [],
      round: 1,
      lastExplanation: [`Scenario loaded: ${scenario.label}. ${scenario.description}`],
      lastIntervention: null,
      interventionHistory: [],
      history: []
    };

    state.attractors = classifyAttractors(state);
    state.metrics.fieldCondition = computeFieldCondition(state.metrics, state.attractors);
    return state;
  }

  function getState() { return state; }

  function setTickCallback(fn) { onTick = fn; }

  function setSpeed(ms) {
    speed = ms;
    if (running) { stop(); start(null); }
  }

  function start(interventionFn) {
    if (running) return;
    running = true;
    intervalHandle = setInterval(() => {
      const intervention = interventionFn ? interventionFn() : null;
      const newState = tick(intervention);
      if (onTick) onTick(newState, intervention);
    }, speed);
  }

  function stop() {
    running = false;
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  function step(appliedIntervention) {
    const newState = tick(appliedIntervention);
    if (onTick) onTick(newState, appliedIntervention);
    return newState;
  }

  function isRunning() { return running; }

  return {
    loadScenario, getState, setTickCallback, setSpeed,
    start, stop, step, isRunning, tick
  };
})();

window.SimulationEngine = SimulationEngine;
