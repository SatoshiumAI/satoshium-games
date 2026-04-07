// ─── SVG TOPOLOGY RENDERER ───────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Edge persistence tracker
// Records consecutive rounds each edge has held strong-alignment (mutual trust ≥ 75).
// Keys: "${actorA}-${actorB}" in ACTOR_IDS pair order. Reset to 0 when trust drops.
const edgeLifespan = {};

const TOPO_W = 480;
const TOPO_H = 420;
const CENTER_X = 240;
const CENTER_Y = 210;
const RADIUS   = 158;

// Precomputed node positions (5 actors evenly around a circle, top-anchored)
function nodePositions() {
  return ACTOR_IDS.map((id, i) => {
    const angle = (i / ACTOR_IDS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id,
      x: CENTER_X + RADIUS * Math.cos(angle),
      y: CENTER_Y + RADIUS * Math.sin(angle)
    };
  });
}

// ── Four edge states keyed by mutual trust
//
//  ≥ 75  STRONG ALIGNMENT      solid / thick / high-opacity cyan
//  55-74  CONDITIONAL ALIGNMENT  short-dash / medium-opacity gold
//  35-54  WEAK SIGNALING         thin solid / low-opacity slate
//  < 35   INACTIVE               hairline / very faint slate
//
function edgeStyle(trust1, trust2) {
  const mutual = (trust1 + trust2) / 2;

  if (mutual >= 75) return {
    stroke: '#00eaff',               // strong coalition link
    width: 2.6, opacity: 0.85,
    dasharray: 'none'
  };
  if (mutual >= 55) return {
    stroke: '#f4c36a',               // provisional cooperation
    width: 1.6, opacity: 0.62,
    dasharray: '5 4'
  };
  if (mutual >= 35) return {
    stroke: 'rgba(144,164,187,.45)', // trust signal, no alignment
    width: 1.0, opacity: 0.30,
    dasharray: 'none'
  };
  return {
    stroke: 'rgba(144,164,187,.25)', // dormant / neutral
    width: 0.7, opacity: 0.14,
    dasharray: 'none'
  };
}

// ── Identify actors that bridge two or more distinct coalitions
function findSwingNodes(actors) {
  const swing = new Set();
  ACTOR_IDS.forEach(id => {
    const externalBlocs = new Set();
    ACTOR_IDS.forEach(oid => {
      if (oid === id) return;
      const mutual = (actors[id].trust[oid] + actors[oid].trust[id]) / 2;
      if (mutual >= 55 && actors[oid].coalitionId &&
          actors[oid].coalitionId !== actors[id].coalitionId) {
        externalBlocs.add(actors[oid].coalitionId);
      }
    });
    // Swing: isolated actor bridging ≥2 blocs, OR coalitioned actor with ≥1 external connection
    if (actors[id].coalitionId && externalBlocs.size >= 1) swing.add(id);
    if (!actors[id].coalitionId && externalBlocs.size >= 2) swing.add(id);
  });
  return swing;
}

// ── Render or update the topology SVG
function renderTopology(state) {
  const svg = document.getElementById('topology-svg');
  if (!svg) return;

  const positions = nodePositions();
  const posMap = {};
  positions.forEach(p => { posMap[p.id] = p; });

  // ── SVG layer order (bottom → top): halos, overlays, lines, nodes
  // Create overlays + lines together on first render so z-order is guaranteed.
  let overlaysEl = svg.querySelector('.topo-overlays');
  let linesEl    = svg.querySelector('.topo-lines');
  if (!linesEl) {
    overlaysEl = document.createElementNS(SVG_NS, 'g');
    overlaysEl.setAttribute('class', 'topo-overlays');
    svg.appendChild(overlaysEl);

    linesEl = document.createElementNS(SVG_NS, 'g');
    linesEl.setAttribute('class', 'topo-lines');
    svg.appendChild(linesEl);
  }

  // Reset lifespan counters when a new simulation starts
  if (state.round === 0) {
    Object.keys(edgeLifespan).forEach(k => { edgeLifespan[k] = 0; });
  }

  const pairs = [];
  for (let i = 0; i < ACTOR_IDS.length; i++) {
    for (let j = i + 1; j < ACTOR_IDS.length; j++) {
      pairs.push([ACTOR_IDS[i], ACTOR_IDS[j]]);
    }
  }

  pairs.forEach(([a, b]) => {
    const edgeKey = `${a}-${b}`;
    const trust1  = state.actors[a].trust[b];
    const trust2  = state.actors[b].trust[a];
    const mutual  = (trust1 + trust2) / 2;
    const style   = edgeStyle(trust1, trust2);

    // ── Track consecutive strong-alignment rounds
    if (mutual >= 75) {
      edgeLifespan[edgeKey] = (edgeLifespan[edgeKey] || 0) + 1;
    } else {
      edgeLifespan[edgeKey] = 0;
    }
    const lifespan = edgeLifespan[edgeKey];

    const pa = posMap[a], pb = posMap[b];

    // ── Persistence overlay line (behind primary edge)
    const overlayId = `topo-overlay-${a}-${b}`;
    let overlay = svg.getElementById(overlayId);
    if (!overlay) {
      overlay = document.createElementNS(SVG_NS, 'line');
      overlay.setAttribute('id', overlayId);
      overlay.setAttribute('stroke', '#00eaff');
      overlay.setAttribute('stroke-linecap', 'round');
      overlaysEl.appendChild(overlay);
    }
    overlay.setAttribute('x1', pa.x); overlay.setAttribute('y1', pa.y);
    overlay.setAttribute('x2', pb.x); overlay.setAttribute('y2', pb.y);

    // Tier 0 — not strong alignment: hidden
    // Tier 1 (1–2 rounds): nascent — faint wider glow, signals new bond forming
    // Tier 2 (3–5 rounds): established — no overlay (normal primary line is enough)
    // Tier 3 (6+ rounds): durable — secondary outer stroke, low opacity, slightly wider
    if (lifespan === 0) {
      overlay.setAttribute('stroke-opacity', '0');
      overlay.setAttribute('stroke-width',   '0');
    } else if (lifespan <= 2) {
      animateAttr(overlay, 'stroke-opacity', 0.14);
      animateAttr(overlay, 'stroke-width',   style.width + 3.0);
    } else if (lifespan <= 5) {
      overlay.setAttribute('stroke-opacity', '0');
      overlay.setAttribute('stroke-width',   '0');
    } else {
      animateAttr(overlay, 'stroke-opacity', 0.22);
      animateAttr(overlay, 'stroke-width',   style.width + 1.5);
    }

    // ── Primary edge line
    const lineId = `topo-line-${a}-${b}`;
    let line = svg.getElementById(lineId);
    if (!line) {
      line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('id', lineId);
      line.setAttribute('class', 'topo-line');
      line.setAttribute('stroke-linecap', 'round');
      linesEl.appendChild(line);
    }
    line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y);
    line.setAttribute('x2', pb.x); line.setAttribute('y2', pb.y);

    animateAttr(line, 'stroke-opacity', style.opacity);
    animateAttr(line, 'stroke-width',   style.width);
    line.setAttribute('stroke', style.stroke);
    line.setAttribute('stroke-dasharray', style.dasharray === 'none' ? '' : style.dasharray);
  });

  // ── Coalition halo rings (behind overlays + lines)
  let halosEl = svg.querySelector('.topo-halos');
  if (!halosEl) {
    halosEl = document.createElementNS(SVG_NS, 'g');
    halosEl.setAttribute('class', 'topo-halos');
    svg.insertBefore(halosEl, overlaysEl); // halos sit below persistence overlays
  }
  halosEl.innerHTML = '';

  // Group by coalition
  const blocs = {};
  ACTOR_IDS.forEach(id => {
    const cid = state.actors[id].coalitionId;
    if (cid) { blocs[cid] = blocs[cid] || []; blocs[cid].push(id); }
  });

  Object.values(blocs).forEach(members => {
    if (members.length < 2) return;
    // Draw ellipse around centroid of coalition members
    const xs = members.map(id => posMap[id].x);
    const ys = members.map(id => posMap[id].y);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

    const maxDist = Math.max(...members.map(id =>
      Math.hypot(posMap[id].x - cx, posMap[id].y - cy)
    ));

    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('cx', cx);
    halo.setAttribute('cy', cy);
    halo.setAttribute('r',  maxDist + 36);
    halo.setAttribute('fill', 'rgba(0,234,255,.04)');
    halo.setAttribute('stroke', 'rgba(0,234,255,.14)');
    halo.setAttribute('stroke-width', '1');
    halo.setAttribute('stroke-dasharray', '4 3');
    halosEl.appendChild(halo);
  });

  // ── Nodes layer (actor circles + labels)
  let nodesEl = svg.querySelector('.topo-nodes');
  if (!nodesEl) {
    nodesEl = document.createElementNS(SVG_NS, 'g');
    nodesEl.setAttribute('class', 'topo-nodes');
    svg.appendChild(nodesEl);
  }

  const swingNodes = findSwingNodes(state.actors);

  positions.forEach(({ id, x, y }) => {
    const actor = state.actors[id];
    const nodeId = `topo-node-${id}`;

    let g = svg.getElementById(nodeId + '-g');
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('id', nodeId + '-g');
      nodesEl.appendChild(g);

      // Swing-node pulse ring (outermost — rendered first, behind glow)
      const swingRing = document.createElementNS(SVG_NS, 'circle');
      swingRing.setAttribute('id', nodeId + '-swing');
      swingRing.setAttribute('class', 'swing-ring');
      swingRing.setAttribute('r', 24);
      swingRing.setAttribute('fill', 'none');
      swingRing.setAttribute('stroke', '#f4c36a');
      swingRing.setAttribute('stroke-width', '1.5');
      swingRing.setAttribute('visibility', 'hidden');
      g.appendChild(swingRing);

      // Outer glow ring
      const glow = document.createElementNS(SVG_NS, 'circle');
      glow.setAttribute('id', nodeId + '-glow');
      glow.setAttribute('r', 18);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke-width', '6');
      glow.setAttribute('opacity', '0.18');
      g.appendChild(glow);

      // Main circle
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('id', nodeId + '-circle');
      circle.setAttribute('class', 'topo-node');
      circle.setAttribute('r', 12);
      g.appendChild(circle);

      // Label
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('id', nodeId + '-label');
      label.setAttribute('class', 'topo-label');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dy', '28');
      g.appendChild(label);
    }

    // Update positions
    g.setAttribute('transform', `translate(${x},${y})`);

    const swingRing = svg.getElementById(nodeId + '-swing');
    const glow      = svg.getElementById(nodeId + '-glow');
    const circle    = svg.getElementById(nodeId + '-circle');
    const label     = svg.getElementById(nodeId + '-label');

    const isSwing  = swingNodes.has(id);
    const isActive = ['Defect','Isolate','Rebalance'].includes(actor.lastAction);

    // Swing ring — gold breathing pulse when node bridges blocs
    if (swingRing) {
      swingRing.setAttribute('visibility', isSwing ? 'visible' : 'hidden');
    }

    glow.setAttribute('stroke', actor.color);
    // Brighten glow ring when swing or active
    glow.setAttribute('stroke-width', isSwing ? '8' : '6');
    glow.setAttribute('opacity', isActive ? '0.38' : isSwing ? '0.30' : '0.18');

    circle.setAttribute('fill', actor.color);
    circle.setAttribute('filter', `drop-shadow(0 0 ${isSwing ? 10 : 7}px ${actor.color})`);
    label.textContent = actor.name.toUpperCase();

    // Node size pulse on decisive action (unchanged)
    circle.setAttribute('r', isActive ? '14' : '12');
  });
}

// Simple attribute transition via CSS transition via requestAnimationFrame
function animateAttr(el, attr, value) {
  el.style.transition = `${attr} 0.45s ease`;
  el.setAttribute(attr, value);
}

// ── Coalition Summary Ribbon (above topology)
const RIBBON_COLORS = {
  'DOMINANT COALITION':  { accent: '#00eaff', bg: 'rgba(0,234,255,.06)'  },
  'DUAL-BLOC STRUCTURE': { accent: '#f4c36a', bg: 'rgba(244,195,106,.05)'},
  'PARTIAL ALIGNMENT':   { accent: '#a57ff4', bg: 'rgba(165,127,244,.05)'},
  'TRANSITIONAL FIELD':  { accent: '#ff7c3a', bg: 'rgba(255,124,58,.05)' },
  'FRAGMENTED SYSTEM':   { accent: '#ff4a5a', bg: 'rgba(255,74,90,.05)'  }
};

function renderCoalitionRibbon(state) {
  const ribbon      = document.getElementById('coalition-ribbon');
  const labelEl     = document.getElementById('ribbon-label');
  const detailsEl   = document.getElementById('ribbon-details');
  const sublabelEl  = document.getElementById('ribbon-sublabel');
  if (!ribbon || !labelEl || !detailsEl || !sublabelEl) return;

  const cc = state.coalitionClassification;
  if (!cc) return;

  const palette = RIBBON_COLORS[cc.baseLabel || cc.label] || RIBBON_COLORS['FRAGMENTED SYSTEM'];

  ribbon.style.borderLeftColor = palette.accent;
  ribbon.style.background      = palette.bg;

  labelEl.textContent           = cc.label;
  labelEl.style.color           = palette.accent;
  detailsEl.textContent         = cc.details;

  if (cc.sublabel) {
    sublabelEl.textContent = cc.sublabel;
    sublabelEl.style.display = '';
  } else {
    sublabelEl.style.display = 'none';
  }
}

// ── Update coalition summary badges below topology
function renderCoalitionBadges(state) {
  const el = document.getElementById('coalition-badges');
  if (!el) return;

  const blocs = {};
  ACTOR_IDS.forEach(id => {
    const cid = state.actors[id].coalitionId;
    if (cid) { blocs[cid] = blocs[cid] || []; blocs[cid].push(state.actors[id].name); }
  });

  const isolated = ACTOR_IDS
    .filter(id => !state.actors[id].coalitionId)
    .map(id => state.actors[id].name);

  let html = '';
  Object.values(blocs).forEach(names => {
    if (names.length >= 2) {
      html += `<span class="coalition-badge">${names.join(' — ')}</span>`;
    }
  });
  isolated.forEach(name => {
    html += `<span class="coalition-badge isolated">${name} (unaligned)</span>`;
  });

  el.innerHTML = html || '<span class="coalition-badge isolated">Awaiting simulation...</span>';
}
