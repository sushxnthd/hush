import crypto from 'node:crypto';

export const TRUST_PROFILES = Object.freeze({
  trusted: { globalBudget: 12, sinkBudget: 8 },
  standard: { globalBudget: 8, sinkBudget: 5 },
  limited: { globalBudget: 4, sinkBudget: 2.5 },
  blocked: { globalBudget: 0, sinkBudget: 0 }
});

export const DISCLOSURE_LEVEL_COST = Object.freeze({
  presence: 0.2,
  boolean: 0.3,
  derived: 0.4,
  coarse: 0.6,
  masked: 0.8,
  exact: 1.5
});

export const CATEGORY_MULTIPLIER = Object.freeze({
  credential: 100,
  identity: 2.5,
  finance: 2.5,
  health: 2.5,
  relationship: 2,
  location: 1.5,
  work: 1.5,
  preference: 1,
  general: 0.75
});

const SENSITIVE = new Set(['identity','finance','health','relationship','credential']);
const LEVEL_RANK = Object.freeze({presence:0,boolean:1,derived:2,coarse:3,masked:4,exact:5});
const stableHash = value => crypto.createHash('sha256').update(String(value)).digest('hex');

export function disclosureCost(category='general', level='exact') {
  const base = DISCLOSURE_LEVEL_COST[level];
  if (base == null) throw new Error(`Unknown disclosure level: ${level}`);
  return base * (CATEGORY_MULTIPLIER[category] ?? CATEGORY_MULTIPLIER.general);
}

export class TrustRegistry {
  constructor(defaultLevel='limited') {
    if (!TRUST_PROFILES[defaultLevel]) throw new Error('Invalid default trust level');
    this.defaultLevel = defaultLevel;
    this.profiles = new Map();
  }
  set(agent, level) {
    if (!TRUST_PROFILES[level]) throw new Error(`Unknown trust level: ${level}`);
    this.profiles.set(String(agent), { level, setAt: Date.now(), source: 'user' });
    return this.get(agent);
  }
  get(agent) {
    const profile = this.profiles.get(String(agent));
    return profile ?? { level: this.defaultLevel, setAt: null, source: 'default' };
  }
}

export class DisclosureLedger {
  constructor({ trustRegistry = new TrustRegistry(), windowMs = 24*60*60*1000 } = {}) {
    this.trustRegistry = trustRegistry;
    this.windowMs = windowMs;
    this.events = [];
  }
  recent(now=Date.now()) {
    const cutoff = now - this.windowMs;
    return this.events.filter(e => e.at >= cutoff);
  }
  _scopeEvents(request, now=Date.now()) {
    return this.recent(now).filter(e => e.agent === request.agent && e.purpose === request.purpose);
  }
  _marginalCost(request, now=Date.now()) {
    const prior = this._scopeEvents(request, now).filter(e => e.atomHash === stableHash(request.atomId));
    const priorMaxRank = prior.reduce((m,e)=>Math.max(m, LEVEL_RANK[e.level] ?? -1), -1);
    const requestedRank = LEVEL_RANK[request.level];
    if (requestedRank == null) throw new Error(`Unknown disclosure level: ${request.level}`);
    if (priorMaxRank >= requestedRank) return 0;
    if (priorMaxRank < 0) return disclosureCost(request.category, request.level);
    const priorLevel = Object.entries(LEVEL_RANK).find(([,r])=>r===priorMaxRank)?.[0];
    return Math.max(0, disclosureCost(request.category, request.level) - disclosureCost(request.category, priorLevel));
  }
  evaluate(request, now=Date.now()) {
    const r = {
      agent: String(request.agent || 'unknown-agent'),
      purpose: String(request.purpose || 'unspecified'),
      sink: String(request.sink || 'unknown-sink'),
      category: String(request.category || 'general'),
      level: String(request.level || 'exact'),
      atomId: String(request.atomId || `${request.category || 'general'}:${request.field || 'value'}`)
    };
    const trust = this.trustRegistry.get(r.agent);
    const limits = TRUST_PROFILES[trust.level];
    if (trust.level === 'blocked') return { decision:'deny', reason:'Agent is blocked by the user.', trust:trust.level, marginalCost:0 };
    if (r.category === 'credential' && ['masked','exact'].includes(r.level)) return { decision:'deny', reason:'Credential material may be used by a broker but never disclosed to an agent.', trust:trust.level, marginalCost:0 };
    const marginalCost = this._marginalCost(r, now);
    const scope = this._scopeEvents(r, now);
    const globalSpent = scope.reduce((s,e)=>s+e.cost,0);
    const sinkSpent = scope.filter(e=>e.sink===r.sink).reduce((s,e)=>s+e.cost,0);
    const globalAfter = globalSpent + marginalCost;
    const sinkAfter = sinkSpent + marginalCost;
    if (globalAfter > limits.globalBudget || sinkAfter > limits.sinkBudget) return { decision:'deny', reason:'Disclosure budget exceeded.', trust:trust.level, marginalCost, globalSpent, sinkSpent, globalAfter, sinkAfter, limits };
    const sensitiveExact = SENSITIVE.has(r.category) && r.level === 'exact';
    const nearBudget = globalAfter > limits.globalBudget*0.8 || sinkAfter > limits.sinkBudget*0.8;
    const unknownSink = r.sink === 'unknown-sink';
    const decision = sensitiveExact || nearBudget || unknownSink ? 'ask' : 'allow';
    const reason = sensitiveExact ? 'Exact sensitive disclosure requires human approval.' : nearBudget ? 'Disclosure is close to the current privacy budget.' : unknownSink ? 'Unknown destination requires approval.' : 'Within disclosure budget.';
    return { decision, reason, trust:trust.level, marginalCost, globalSpent, sinkSpent, globalAfter, sinkAfter, limits };
  }
  record(request, evaluation, now=Date.now()) {
    if (!['allow','ask'].includes(evaluation.decision)) throw new Error('Denied disclosures cannot be recorded as released');
    const event = {
      id: crypto.randomUUID(), at: now,
      agent: String(request.agent || 'unknown-agent'), purpose: String(request.purpose || 'unspecified'), sink: String(request.sink || 'unknown-sink'),
      category: String(request.category || 'general'), level: String(request.level || 'exact'),
      atomHash: stableHash(String(request.atomId || `${request.category || 'general'}:${request.field || 'value'}`)),
      cost: Number(evaluation.marginalCost || 0), approvedByHuman: Boolean(request.approvedByHuman)
    };
    this.events.push(event);
    return event;
  }
  footprint(now=Date.now()) {
    const byAgent = new Map();
    for (const e of this.recent(now)) {
      const x = byAgent.get(e.agent) ?? { agent:e.agent, disclosures:0, privacyCost:0, categories:new Set(), sinks:new Set(), exactSensitive:0 };
      x.disclosures += 1; x.privacyCost += e.cost; x.categories.add(e.category); x.sinks.add(e.sink);
      if (SENSITIVE.has(e.category) && e.level==='exact') x.exactSensitive += 1;
      byAgent.set(e.agent,x);
    }
    return [...byAgent.values()].map(x=>({ ...x, privacyCost:Number(x.privacyCost.toFixed(2)), categories:[...x.categories].sort(), sinks:[...x.sinks].sort() })).sort((a,b)=>b.privacyCost-a.privacyCost);
  }
}
