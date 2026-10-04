import crypto from 'node:crypto';
import {canonicalize, sha256} from './core.js';
import {DisclosureLedger, TrustRegistry} from './privacy.js';

const BOOLEAN_OPS = new Set(['eq','neq','gt','gte','lt','lte','between']);

function compare(value, op, arg) {
  if (op === 'eq') return value === arg;
  if (op === 'neq') return value !== arg;
  if (op === 'gt') return value > arg;
  if (op === 'gte') return value >= arg;
  if (op === 'lt') return value < arg;
  if (op === 'lte') return value <= arg;
  if (op === 'between') {
    if (!Array.isArray(arg) || arg.length !== 2) throw new Error('between expects [min,max]');
    return value >= arg[0] && value <= arg[1];
  }
  throw new Error(`Unsupported predicate: ${op}`);
}

function masked(value) {
  const s = String(value);
  if (s.length <= 4) return '*'.repeat(s.length);
  return `${'*'.repeat(Math.max(1, s.length - 4))}${s.slice(-4)}`;
}

/**
 * Experimental personal-context runtime.
 *
 * Agents receive opaque lease handles instead of raw context. Every lease belongs
 * to a Supakeep-minted privacy trajectory representing one user-authorized task.
 * Agents cannot rename the purpose to reset privacy accounting: the opaque
 * trajectory id is the accounting scope and follows delegated/sub-agent leases.
 *
 * Each distinct predicate is accounted as a distinct disclosure so adaptive query
 * sequences cannot evade cumulative privacy budgets by repeatedly asking same-level
 * boolean questions about the same private atom.
 */
export class PrivateContextRuntime {
  constructor({trustRegistry = new TrustRegistry(), ledger = null, now = () => Date.now()} = {}) {
    this.trustRegistry = trustRegistry;
    this.ledger = ledger ?? new DisclosureLedger({trustRegistry});
    this.now = now;
    this.atoms = new Map();
    this.trajectories = new Map();
    this.leases = new Map();
  }

  put({id, category='general', value}) {
    const atomId = String(id || crypto.randomUUID());
    this.atoms.set(atomId, {id: atomId, category: String(category), value});
    return {id: atomId, category: String(category)};
  }

  beginTrajectory({purpose='unspecified', ttlMs = 30 * 60 * 1000} = {}) {
    const id = `traj_${crypto.randomBytes(24).toString('base64url')}`;
    const trajectory = {
      id,
      purposeLabel: String(purpose),
      issuedAt: this.now(),
      expiresAt: this.now() + Math.max(1000, Math.min(Number(ttlMs), 24 * 60 * 60 * 1000)),
      revokedAt: null
    };
    this.trajectories.set(id, trajectory);
    return {trajectoryId:id, purpose:trajectory.purposeLabel, expiresAt:trajectory.expiresAt};
  }

  revokeTrajectory(trajectoryId) {
    const trajectory = this.trajectories.get(String(trajectoryId));
    if (!trajectory) return false;
    trajectory.revokedAt = this.now();
    return true;
  }

  _trajectory(trajectoryId) {
    const trajectory = this.trajectories.get(String(trajectoryId));
    if (!trajectory) throw new Error('Privacy trajectory not found');
    if (trajectory.revokedAt) throw new Error('Privacy trajectory revoked');
    if (this.now() >= trajectory.expiresAt) throw new Error('Privacy trajectory expired');
    return trajectory;
  }

  issueLease({agent, sink, atomId, trajectoryId, ttlMs = 5 * 60 * 1000}) {
    const atom = this.atoms.get(String(atomId));
    if (!atom) throw new Error('Context atom not found');
    const trajectory = this._trajectory(trajectoryId);
    const handle = `ctx_${crypto.randomBytes(24).toString('base64url')}`;
    const expiresAt = Math.min(
      trajectory.expiresAt,
      this.now() + Math.max(1000, Math.min(Number(ttlMs), 60 * 60 * 1000))
    );
    const lease = {
      handle,
      agent: String(agent || 'unknown-agent'),
      sink: String(sink || 'unknown-sink'),
      atomId: atom.id,
      trajectoryId: trajectory.id,
      issuedAt: this.now(),
      expiresAt,
      revokedAt: null
    };
    this.leases.set(handle, lease);
    return {
      handle,
      agent: lease.agent,
      sink: lease.sink,
      trajectoryId: trajectory.id,
      purpose: trajectory.purposeLabel,
      expiresAt: lease.expiresAt
    };
  }

  revoke(handle) {
    const lease = this.leases.get(String(handle));
    if (!lease) return false;
    lease.revokedAt = this.now();
    return true;
  }

  _lease(handle, {agent, sink}) {
    const lease = this.leases.get(String(handle));
    if (!lease) throw new Error('Context lease not found');
    if (lease.revokedAt) throw new Error('Context lease revoked');
    if (this.now() >= lease.expiresAt) throw new Error('Context lease expired');
    if (lease.agent !== String(agent)) throw new Error('Context lease is bound to another agent');
    if (lease.sink !== String(sink)) throw new Error('Context lease is bound to another sink');
    this._trajectory(lease.trajectoryId);
    return lease;
  }

  _disclosureRequest(lease, atom, op, arg) {
    let level;
    let disclosureAtomId;
    if (op === 'exists') {
      level = 'presence';
      disclosureAtomId = `${atom.id}:presence`;
    } else if (BOOLEAN_OPS.has(op)) {
      level = 'boolean';
      // Distinct predicates are distinct disclosures. Repeating the exact same
      // predicate is free; adaptive threshold changes consume more budget.
      const predicateId = sha256(canonicalize({op,arg}));
      disclosureAtomId = `${atom.id}:predicate:${predicateId}`;
    } else if (op === 'masked') {
      level = 'masked';
      disclosureAtomId = `${atom.id}:masked`;
    } else if (op === 'exact') {
      level = 'exact';
      disclosureAtomId = atom.id;
    } else {
      throw new Error(`Unsupported context operation: ${op}`);
    }
    return {
      agent: lease.agent,
      // The accounting scope is runtime-minted, not agent-supplied prose.
      purpose: lease.trajectoryId,
      sink: lease.sink,
      category: atom.category,
      level,
      atomId: disclosureAtomId
    };
  }

  query({handle, agent, sink, op, arg, approvedByHuman=false}) {
    const lease = this._lease(handle, {agent,sink});
    const atom = this.atoms.get(lease.atomId);
    if (!atom) throw new Error('Context atom no longer exists');
    const trajectory = this._trajectory(lease.trajectoryId);
    const request = this._disclosureRequest(lease, atom, String(op), arg);
    const evaluation = this.ledger.evaluate(request, this.now());
    if (evaluation.decision === 'deny') return {decision:'deny', reason:evaluation.reason, privacy:evaluation};
    if (evaluation.decision === 'ask' && !approvedByHuman) return {decision:'ask', reason:evaluation.reason, privacy:evaluation};

    let result;
    if (op === 'exists') result = true;
    else if (BOOLEAN_OPS.has(op)) result = compare(atom.value, op, arg);
    else if (op === 'masked') result = masked(atom.value);
    else if (op === 'exact') result = atom.value;

    const effective = evaluation.decision === 'ask' ? {...evaluation,decision:'ask'} : evaluation;
    this.ledger.record({...request, approvedByHuman}, effective, this.now());
    return {
      decision:'allow',
      result,
      disclosure:{category:atom.category, level:request.level},
      privacy:evaluation,
      receipt:{
        v:1,
        at:this.now(),
        agent:lease.agent,
        trajectoryId:lease.trajectoryId,
        purpose:trajectory.purposeLabel,
        sink:lease.sink,
        operation:String(op),
        queryHash:sha256(canonicalize({op,arg})),
        rawValueIncluded:op==='exact'
      }
    };
  }
}
