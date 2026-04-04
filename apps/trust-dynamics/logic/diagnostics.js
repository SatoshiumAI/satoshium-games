/**
 * diagnostics.js
 * Header diagnostic grammar — derives regime, form, driver, health, and temporal labels
 * from current simulation metrics and conditions.
 *
 * Designed for easy expansion: each label group is a scored rule set.
 */

/**
 * Derive all diagnostic labels from metrics + conditions.
 * Returns { regime, form, driver, health, temporal }
 */
function computeDiagnostics(metrics, conditions, history) {
  return {
    regime: deriveRegime(metrics),
    form: deriveForm(metrics),
    driver: deriveDriver(conditions),
    health: deriveHealth(metrics),
    temporal: deriveTemporal(history, metrics),
  };
}

function deriveRegime(metrics) {
  const { networkTrust, stability, cascadeRisk } = metrics;

  if (networkTrust >= 65 && stability >= 65 && cascadeRisk < 25) return 'TRUSTED';
  if (cascadeRisk >= 60 || (networkTrust < 30 && stability < 35)) return 'COLLAPSE RISK';
  if (networkTrust < 40 && cascadeRisk >= 40) return 'FRACTURING';
  if (networkTrust < 50 && stability < 50) return 'UNSTABLE';
  if (networkTrust >= 45 && stability >= 40 && cascadeRisk < 40) return 'RECOVERING';
  return 'UNSTABLE';
}

function deriveForm(metrics) {
  const { trustAsymmetry, brokenLinks, totalLinks, density, cascadeRisk, anchorShare } = metrics;
  const brokenRatio = brokenLinks / totalLinks;

  if (brokenRatio > 0.35) return 'FRACTURED NETWORK';
  if (trustAsymmetry > 28) return 'ASYMMETRIC TRUST';
  if (density > 0.65) return 'BALANCED TRUST';
  if (cascadeRisk > 55 && brokenRatio > 0.15) return 'TRUST CLUSTERING';

  // Explicit anchor detection: one agent absorbs more than 35% of all inbound trust
  if (anchorShare > 0.35) return 'ANCHOR-DEPENDENT NETWORK';

  // Fallback anchor pattern — high variance in link scores suggests hub concentration
  if (metrics.maxTrust - metrics.minTrust > 55) return 'ANCHOR-DEPENDENT NETWORK';
  return 'BALANCED TRUST';
}

function deriveDriver(conditions) {
  const scores = [
    { key: 'TRANSPARENCY-DOMINANT', value: conditions.transparency },
    { key: 'PRESSURE-DOMINANT', value: conditions.pressure },
    { key: 'CONFLICT-DOMINANT', value: conditions.conflictIntensity },
    { key: 'INCONSISTENCY-DOMINANT', value: conditions.inconsistency },
    { key: 'RECOVERY-DOMINANT', value: conditions.recoveryOpportunity },
    { key: 'SCARCITY-DOMINANT', value: conditions.scarcity },
    { key: 'COOPERATION-DOMINANT', value: conditions.cooperationIncentive },
  ].sort((a, b) => b.value - a.value);

  // Only label as dominant if the top condition is meaningfully above rest
  if (scores[0].value > 0.52) return scores[0].key;
  return 'BALANCED CONDITIONS';
}

function deriveHealth(metrics) {
  const { networkTrust, cascadeRisk, stability, brokenLinks, totalLinks } = metrics;
  const brokenRatio = brokenLinks / totalLinks;

  if (networkTrust >= 65 && cascadeRisk < 20 && brokenRatio < 0.05) return 'HEALTHY';
  if (cascadeRisk >= 55 || brokenRatio > 0.3) return 'COLLAPSING';
  if (networkTrust < 38 || (brokenRatio > 0.15 && cascadeRisk > 35)) return 'DAMAGED';
  if (networkTrust >= 45 && stability >= 40 && brokenRatio < 0.15) return 'REPAIRING';
  return 'FRAGILE';
}

function deriveTemporal(history, metrics) {
  if (!history || history.length < 4) return 'STABLE PATTERN';

  const recent = history.slice(-5).map(h => h.networkTrust);
  const diffs = recent.slice(1).map((v, i) => v - recent[i]);

  const signChanges = diffs.slice(1).filter((d, i) => Math.sign(d) !== Math.sign(diffs[i])).length;
  const maxDiff = Math.max(...diffs.map(Math.abs));

  if (maxDiff > 12) return 'VOLATILE';
  if (signChanges >= 2) return 'OSCILLATING';
  return 'STABLE PATTERN';
}

/**
 * Returns a color class name for a diagnostic label value.
 */
function getDiagnosticColor(label) {
  const reds = ['COLLAPSE RISK', 'FRACTURING', 'COLLAPSING', 'FRACTURED NETWORK', 'VOLATILE'];
  const ambers = ['UNSTABLE', 'FRAGILE', 'DAMAGED', 'ASYMMETRIC TRUST', 'ANCHOR-DEPENDENT NETWORK', 'OSCILLATING', 'PRESSURE-DOMINANT', 'CONFLICT-DOMINANT', 'INCONSISTENCY-DOMINANT', 'SCARCITY-DOMINANT'];
  const amberBlues = ['DISPLACEMENT RISK'];
  const violetBlues = ['ANCHOR COMPETITION'];
  const dimRedViolets = ['ANCHOR VACUUM'];
  const greens = ['TRUSTED', 'HEALTHY', 'BALANCED TRUST', 'STABLE PATTERN', 'TRANSPARENCY-DOMINANT', 'RECOVERY-DOMINANT', 'COOPERATION-DOMINANT'];
  const blues = ['RECOVERING', 'REPAIRING', 'TRUST CLUSTERING', 'ANCHOR TRANSITION'];

  if (reds.includes(label)) return 'diag-red';
  if (ambers.includes(label)) return 'diag-amber';
  if (amberBlues.includes(label)) return 'diag-amber-blue';
  if (violetBlues.includes(label)) return 'diag-violet-blue';
  if (dimRedViolets.includes(label)) return 'diag-dim-red-violet';
  if (greens.includes(label)) return 'diag-green';
  if (blues.includes(label)) return 'diag-blue';
  return 'diag-neutral';
}
