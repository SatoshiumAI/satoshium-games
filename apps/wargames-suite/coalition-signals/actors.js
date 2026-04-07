const ACTOR_DEFS = {
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    color: '#00eaff',
    shadowColor: 'rgba(0,234,255,.55)',
    defaultAttrs: {
      cooperationTendency:    62,
      riskTolerance:          45,
      strategicPatience:      70,
      sensitivityToThreat:    52,
      preferenceForStability: 68
    }
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    color: '#f4c36a',
    shadowColor: 'rgba(244,195,106,.55)',
    defaultAttrs: {
      cooperationTendency:    55,
      riskTolerance:          65,
      strategicPatience:      50,
      sensitivityToThreat:    60,
      preferenceForStability: 45
    }
  },
  arbiter: {
    id: 'arbiter',
    name: 'Arbiter',
    color: '#a57ff4',
    shadowColor: 'rgba(165,127,244,.55)',
    defaultAttrs: {
      cooperationTendency:    58,
      riskTolerance:          40,
      strategicPatience:      75,
      sensitivityToThreat:    42,
      preferenceForStability: 72
    }
  },
  nexus: {
    id: 'nexus',
    name: 'Nexus',
    color: '#2ecc71',
    shadowColor: 'rgba(46,204,113,.55)',
    defaultAttrs: {
      cooperationTendency:    50,
      riskTolerance:          55,
      strategicPatience:      55,
      sensitivityToThreat:    55,
      preferenceForStability: 55
    }
  },
  cipher: {
    id: 'cipher',
    name: 'Cipher',
    color: '#ff4a5a',
    shadowColor: 'rgba(255,74,90,.55)',
    defaultAttrs: {
      cooperationTendency:    40,
      riskTolerance:          70,
      strategicPatience:      35,
      sensitivityToThreat:    70,
      preferenceForStability: 30
    }
  }
};

const ACTOR_IDS = ['sentinel', 'vanguard', 'arbiter', 'nexus', 'cipher'];

function createActors() {
  const actors = {};
  ACTOR_IDS.forEach(id => {
    const def = ACTOR_DEFS[id];
    const trust = {};
    ACTOR_IDS.forEach(oid => { trust[oid] = oid === id ? 100 : 50; });
    actors[id] = {
      id,
      name:       def.name,
      color:      def.color,
      shadowColor: def.shadowColor,
      attrs:      { ...def.defaultAttrs },
      trust,
      stance:     'Neutral',
      lastAction: 'None',
      coalitionId: null
    };
  });
  return actors;
}
