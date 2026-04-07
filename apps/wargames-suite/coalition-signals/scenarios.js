const SCENARIOS = {
  fragileBalance: {
    id: 'fragileBalance',
    name: 'Fragile Balance',
    desc: '5 actors in cautious equilibrium with moderate distrust. Cooperation is possible but fragile.',
    setup(actors) {
      const ids = Object.keys(actors);
      ids.forEach(id => {
        actors[id].attrs.cooperationTendency = 38 + rand(12);
        actors[id].attrs.sensitivityToThreat  = 58 + rand(15);
        actors[id].attrs.preferenceForStability = 55 + rand(15);
        ids.forEach(oid => {
          if (oid !== id) actors[id].trust[oid] = 32 + rand(22);
        });
      });
    }
  },
  risingPressure: {
    id: 'risingPressure',
    name: 'Rising Pressure',
    desc: 'External stress increases incentive for rapid alignment. Hesitation carries growing costs.',
    setup(actors) {
      const ids = Object.keys(actors);
      ids.forEach(id => {
        actors[id].attrs.cooperationTendency   = 52 + rand(20);
        actors[id].attrs.sensitivityToThreat   = 72 + rand(15);
        actors[id].attrs.riskTolerance         = 45 + rand(20);
        actors[id].attrs.preferenceForStability = 40 + rand(20);
        ids.forEach(oid => {
          if (oid !== id) actors[id].trust[oid] = 42 + rand(18);
        });
      });
    }
  },
  opportunistPivot: {
    id: 'opportunistPivot',
    name: 'Opportunist Pivot',
    desc: 'One actor is highly adaptive and may swing the entire system toward a new equilibrium.',
    setup(actors) {
      const ids = Object.keys(actors);
      ids.forEach(id => {
        actors[id].attrs.cooperationTendency   = 48 + rand(18);
        actors[id].attrs.sensitivityToThreat   = 50 + rand(20);
        actors[id].attrs.riskTolerance         = 50 + rand(20);
        actors[id].attrs.preferenceForStability = 50 + rand(20);
        ids.forEach(oid => {
          if (oid !== id) actors[id].trust[oid] = 45 + rand(20);
        });
      });
      // Cipher is the opportunist
      actors.cipher.attrs.riskTolerance          = 88 + rand(8);
      actors.cipher.attrs.preferenceForStability = 12 + rand(8);
      actors.cipher.attrs.strategicPatience      = 18 + rand(10);
      actors.cipher.attrs.cooperationTendency    = 35 + rand(15);
    }
  },
  trustCollapse: {
    id: 'trustCollapse',
    name: 'Trust Collapse',
    desc: 'One broken commitment cascades into systemic instability. Watch how fractures propagate.',
    setup(actors) {
      const ids = Object.keys(actors);
      ids.forEach(id => {
        actors[id].attrs.cooperationTendency   = 50 + rand(20);
        actors[id].attrs.sensitivityToThreat   = 60 + rand(20);
        actors[id].attrs.riskTolerance         = 45 + rand(20);
        actors[id].attrs.preferenceForStability = 65 + rand(15);
        ids.forEach(oid => {
          if (oid !== id) actors[id].trust[oid] = 55 + rand(20);
        });
      });
      // Nexus is the defector
      actors.nexus.attrs.cooperationTendency   = 10 + rand(8);
      actors.nexus.attrs.strategicPatience     = 10 + rand(8);
      actors.nexus.attrs.sensitivityToThreat   = 85 + rand(10);
      actors.nexus.trust.sentinel = 20 + rand(10);
      actors.nexus.trust.vanguard = 18 + rand(10);
      actors.nexus.trust.arbiter  = 22 + rand(10);
      actors.nexus.trust.cipher   = 15 + rand(10);
    }
  },
  partialCooperation: {
    id: 'partialCooperation',
    name: 'Partial Cooperation',
    desc: 'Actors align only on certain dimensions. Full alliance is unavailable — observe the hedging dynamics.',
    setup(actors) {
      const ids = Object.keys(actors);
      ids.forEach(id => {
        actors[id].attrs.cooperationTendency   = 42 + rand(16);
        actors[id].attrs.sensitivityToThreat   = 55 + rand(20);
        actors[id].attrs.riskTolerance         = 55 + rand(18);
        actors[id].attrs.preferenceForStability = 60 + rand(18);
        ids.forEach(oid => {
          if (oid !== id) actors[id].trust[oid] = 38 + rand(28);
        });
      });
    }
  }
};

function rand(n) { return Math.floor(Math.random() * n); }
