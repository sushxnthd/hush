import {canonicalize, sha256} from './core.js';

const DAY = 24 * 60 * 60 * 1000;

function uniqueStrings(values = []) {
  return [...new Set(values.map(String).filter(Boolean))].sort();
}

function finiteNonNegative(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < 0) throw new Error('Reconstruction budgets must be finite and non-negative');
  return n;
}

/**
 * PersistentReconstructionFirewall closes the trajectory-reset loophole.
 *
 * A trajectory is intentionally short lived, but information learned about a private
 * field survives the trajectory. The firewall therefore accounts explicit channel
 * capacity per private field across trajectories, agents and sinks within a rolling
 * window. Rotating purpose labels, agent names or destinations cannot reset the
 * global field budget.
 *
 * This is still an explicit-channel defense. It does not claim to cover timing,
 * crashes, network metadata, external side effects or information released outside
 * Supakeep's boundary.
 */
export class PersistentReconstructionFirewall {
  constructor({
    now = () => Date.now(),
    windowMs = 7 * DAY,
    fieldBudgetBits = 8,
    audienceBudgetBits = 6
  } = {}) {
    this.now = now;
    this.windowMs = Math.max(1000, Number(windowMs));
    this.fieldBudgetBits = finiteNonNegative(fieldBudgetBits, 8);
    this.audienceBudgetBits = finiteNonNegative(audienceBudgetBits, 6);
    this.events = [];
  }

  restore(events = []) {
    if (!Array.isArray(events)) throw new Error('Firewall events must be an array');
    this.events = events.map(event => ({...event}));
    return this;
  }

  snapshot() {
    return this.events.map(event => ({...event}));
  }

  recent(now = this.now()) {
    const cutoff = now - this.windowMs;
    return this.events.filter(event => Number(event.at) >= cutoff);
  }

  _queryKey({programHash, profileRevision}) {
    return sha256(canonicalize({programHash:String(programHash),profileRevision:Number(profileRevision)}));
  }

  evaluate({privatePaths, audience='unknown-sink', programHash, profileRevision=0, bits=0} = {}) {
    const paths = uniqueStrings(privatePaths);
    const requestedBits = finiteNonNegative(bits, 0);
    const audienceKey = String(audience || 'unknown-sink');
    const queryKey = this._queryKey({programHash, profileRevision});
    const recent = this.recent();
    const fields = [];

    for (const field of paths) {
      const fieldEvents = recent.filter(event => event.field === field);
      const audienceEvents = fieldEvents.filter(event => event.audience === audienceKey);
      const seenGlobally = fieldEvents.some(event => event.queryKey === queryKey);
      const seenByAudience = audienceEvents.some(event => event.queryKey === queryKey);
      const globalMarginalBits = seenGlobally ? 0 : requestedBits;
      const audienceMarginalBits = seenByAudience ? 0 : requestedBits;
      const fieldSpentBits = fieldEvents.reduce((sum,event)=>sum+Number(event.globalBits || 0),0);
      const audienceSpentBits = audienceEvents.reduce((sum,event)=>sum+Number(event.audienceBits || 0),0);
      const fieldAfterBits = fieldSpentBits + globalMarginalBits;
      const audienceAfterBits = audienceSpentBits + audienceMarginalBits;
      fields.push({
        field,
        fieldSpentBits:Number(fieldSpentBits.toFixed(6)),
        audienceSpentBits:Number(audienceSpentBits.toFixed(6)),
        fieldAfterBits:Number(fieldAfterBits.toFixed(6)),
        audienceAfterBits:Number(audienceAfterBits.toFixed(6)),
        fieldBudgetBits:this.fieldBudgetBits,
        audienceBudgetBits:this.audienceBudgetBits,
        globalMarginalBits:Number(globalMarginalBits.toFixed(6)),
        audienceMarginalBits:Number(audienceMarginalBits.toFixed(6)),
        repeatGlobally:seenGlobally,
        repeatForAudience:seenByAudience
      });
    }

    const blocked = fields.find(field =>
      field.fieldAfterBits > this.fieldBudgetBits + 1e-12 ||
      field.audienceAfterBits > this.audienceBudgetBits + 1e-12
    );

    if (blocked) {
      return {
        decision:'deny',
        reason:'Persistent reconstruction budget exceeded across trajectories.',
        queryKey,
        audience:audienceKey,
        fields
      };
    }

    return {
      decision:'allow',
      reason:paths.length ? 'Within persistent reconstruction budget.' : 'Program does not reference private fields.',
      queryKey,
      audience:audienceKey,
      fields
    };
  }

  record({privatePaths, audience='unknown-sink', programHash, profileRevision=0, bits=0, trajectoryId=null, resultHash=null} = {}) {
    const evaluation = this.evaluate({privatePaths,audience,programHash,profileRevision,bits});
    if (evaluation.decision !== 'allow') throw new Error(evaluation.reason);
    const at = this.now();
    for (const field of evaluation.fields) {
      // Exact deterministic repeats add no information for that scope and need not
      // grow the ledger indefinitely.
      if (field.globalMarginalBits === 0 && field.audienceMarginalBits === 0) continue;
      this.events.push({
        v:1,
        at,
        field:field.field,
        audience:evaluation.audience,
        queryKey:evaluation.queryKey,
        trajectoryId:trajectoryId == null ? null : String(trajectoryId),
        globalBits:field.globalMarginalBits,
        audienceBits:field.audienceMarginalBits,
        resultHash:resultHash == null ? null : String(resultHash)
      });
    }
    return evaluation;
  }

  footprint(now = this.now()) {
    const recent = this.recent(now);
    const fields = new Map();
    for (const event of recent) {
      const row = fields.get(event.field) ?? {field:event.field,spentBits:0,audiences:new Map(),queries:new Set()};
      row.spentBits += Number(event.globalBits || 0);
      row.audiences.set(event.audience,(row.audiences.get(event.audience)??0)+Number(event.audienceBits||0));
      row.queries.add(event.queryKey);
      fields.set(event.field,row);
    }
    return [...fields.values()].map(row=>({
      field:row.field,
      spentBits:Number(row.spentBits.toFixed(6)),
      fieldBudgetBits:this.fieldBudgetBits,
      queries:row.queries.size,
      audiences:[...row.audiences.entries()].map(([audience,spentBits])=>({audience,spentBits:Number(spentBits.toFixed(6)),audienceBudgetBits:this.audienceBudgetBits})).sort((a,b)=>b.spentBits-a.spentBits)
    })).sort((a,b)=>b.spentBits-a.spentBits||a.field.localeCompare(b.field));
  }
}
