// topology.js — Canvas-based field topology visualization

const TopologyRenderer = (() => {
  let canvas, ctx;
  let actors = [];
  let links = [];
  let attractors = [];
  let positions = {};
  let animFrame = null;
  let pulsePhase = 0;
  let highlightedActor = null;

  const NODE_RADIUS = 22;
  const ATTRACTOR_OPACITY_BASE = 0.08;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 700;
    canvas.height = rect.height || 420;
    if (actors.length > 0) assignPositions();
  }

  function assignPositions() {
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const count = actors.length;
    const r = Math.min(W, H) * 0.32;

    actors.forEach((actor, i) => {
      const angle = (2 * Math.PI * i / count) - Math.PI / 2;
      positions[actor.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      };
    });
  }

  function setActors(actorList) {
    actors = actorList;
    assignPositions();
  }

  function setLinks(linkList) {
    links = linkList;
  }

  function setAttractors(attractorList) {
    attractors = attractorList;
  }

  function setHighlight(actorId) {
    highlightedActor = actorId;
  }

  function startLoop() {
    if (animFrame) cancelAnimationFrame(animFrame);
    function loop() {
      pulsePhase += 0.025;
      draw();
      animFrame = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopLoop() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  function draw() {
    if (!ctx || !canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    drawBackground(W, H);
    drawGrid(W, H);
    drawAttractorZones();
    drawLinks();
    drawNodes();
  }

  function drawBackground(W, H) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    grad.addColorStop(0, 'rgba(10,20,40,0.98)');
    grad.addColorStop(1, 'rgba(5,10,20,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrid(W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,255,0.04)';
    ctx.lineWidth = 0.5;
    const step = 48;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawAttractorZones() {
    attractors.forEach(att => {
      const memberPositions = att.members
        .map(id => positions[id])
        .filter(Boolean);
      if (memberPositions.length === 0) return;

      const cx = memberPositions.reduce((s, p) => s + p.x, 0) / memberPositions.length;
      const cy = memberPositions.reduce((s, p) => s + p.y, 0) / memberPositions.length;

      let r = 70;
      memberPositions.forEach(p => {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d + 50 > r) r = d + 50;
      });

      const pulse = Math.sin(pulsePhase * 1.5) * 0.02 + ATTRACTOR_OPACITY_BASE;
      const outerPulse = Math.sin(pulsePhase * 0.8) * 0.015 + ATTRACTOR_OPACITY_BASE * 0.6;

      const color = att.type === 'false' ? '#ffd700' : att.type === 'contested' ? '#ff6b6b' : '#00c8ff';

      const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, colorWithAlpha(color, pulse * 2.5));
      grad.addColorStop(0.6, colorWithAlpha(color, pulse));
      grad.addColorStop(1, colorWithAlpha(color, 0));

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(color, outerPulse * 4);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colorWithAlpha(color, 0.6);
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      const label = att.label || att.type.toUpperCase();
      ctx.fillText(label, cx, cy - r + 14);
      ctx.restore();
    });
  }

  function drawLinks() {
    links.forEach(link => {
      const pa = positions[link.a];
      const pb = positions[link.b];
      if (!pa || !pb) return;

      const strength = link.strength || 0.5;
      const type = link.type || 'weak';

      let color, alpha, dash;
      if (type === 'strong') {
        color = '#00c8ff'; alpha = 0.25 + strength * 0.5; dash = [];
      } else if (type === 'provisional') {
        color = '#ffd700'; alpha = 0.2 + strength * 0.4; dash = [8, 5];
      } else {
        color = '#64748b'; alpha = 0.12 + strength * 0.2; dash = [3, 6];
      }

      const pulse = type === 'strong' ? Math.sin(pulsePhase * 2 + link.a.charCodeAt(0)) * 0.08 : 0;
      alpha = Math.max(0, Math.min(1, alpha + pulse));

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = colorWithAlpha(color, alpha);
      ctx.lineWidth = 1 + strength * 2;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);

      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const pct = Math.round(strength * 100);
      ctx.fillStyle = colorWithAlpha(color, 0.5);
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pct + '%', mx, my - 5);

      ctx.restore();
    });
  }

  function drawNodes() {
    actors.forEach(actor => {
      const pos = positions[actor.id];
      if (!pos) return;

      const isHighlighted = actor.interventionTargeted || actor.id === highlightedActor;
      const pulse = Math.sin(pulsePhase * 3 + actor.id.charCodeAt(0) * 0.5) * 0.5 + 0.5;
      const r = NODE_RADIUS;

      ctx.save();

      if (isHighlighted) {
        const glowR = r + 14 + pulse * 8;
        const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, glowR);
        glow.addColorStop(0, colorWithAlpha(actor.color, 0.35));
        glow.addColorStop(1, colorWithAlpha(actor.color, 0));
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      const grad = ctx.createRadialGradient(pos.x - r * 0.3, pos.y - r * 0.3, r * 0.1, pos.x, pos.y, r);
      grad.addColorStop(0, colorWithAlpha(actor.color, 0.35));
      grad.addColorStop(1, colorWithAlpha(actor.color, 0.08));
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(actor.color, isHighlighted ? 0.9 : 0.6);
      ctx.lineWidth = isHighlighted ? 2 : 1.5;
      ctx.stroke();

      const trustAlpha = actor.trust || 0.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(actor.color, trustAlpha * 0.8);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = `bold 10px "Share Tech Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(actor.label, pos.x, pos.y + r + 14);

      const stanceColors = {
        aligned: '#34d399', contested: '#ff6b6b', isolated: '#94a3b8',
        pivoting: '#ffd700', locked: '#00c8ff', neutral: '#64748b'
      };
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.fillStyle = stanceColors[actor.stance] || '#64748b';
      ctx.fillText((actor.stance || 'neutral').toUpperCase(), pos.x, pos.y + r + 26);

      ctx.restore();
    });
  }

  function colorWithAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function getActorAtPoint(mx, my) {
    for (const actor of actors) {
      const pos = positions[actor.id];
      if (!pos) continue;
      if (Math.hypot(mx - pos.x, my - pos.y) <= NODE_RADIUS + 8) return actor.id;
    }
    return null;
  }

  function snapshot() {
    return canvas.toDataURL('image/png');
  }

  return {
    init, resize, setActors, setLinks, setAttractors,
    setHighlight, startLoop, stopLoop, draw, getActorAtPoint, snapshot
  };
})();

window.TopologyRenderer = TopologyRenderer;
