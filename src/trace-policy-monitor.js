import { canonicalize, sha256 } from './core.js';

const EVENT_TYPES = new Set(['read', 'action', 'release']);

function normalizePolicy(policy = {}) {
  return {
    allowedReads: [...new Set(policy.allowedReads ?? [])].map(String).sort(),
    allowedActions: [...new Set(policy.allowedActions ?? [])].map(String).sort()
  };
}

function normalizeEvent(event = {}) {
  const type = String(event.type ?? '');
  if (!EVENT_TYPES.has(type)) throw Error(`Unsupported trace event type: ${type || '<empty>'}`);
  if (type === 'release') return { type, value: structuredClone(event.value) };
  const name = String(event.name ?? '');
  if (!name) throw Error(`${type} event requires a name`);
  return { type, name };
}

export function tracePolicyDecision(policy, event) {
  const p = normalizePolicy(policy);
  const e = normalizeEvent(event);
  if (e.type === 'read') {
    const allowed = p.allowedReads.includes('*') || p.allowedReads.includes(e.name);
    return { decision: allowed ? 'allow' : 'deny', reason: allowed ? 'Read is in policy scope.' : 'Read is outside policy scope.' };
  }
  if (e.type === 'action') {
    const allowed = p.allowedActions.includes('*') || p.allowedActions.includes(e.name);
    return { decision: allowed ? 'allow' : 'deny', reason: allowed ? 'Action is in policy scope.' : 'Action is outside policy scope.' };
  }
  return { decision: 'allow', reason: 'Release does not authorize prior internal events.' };
}

export function verifyTraceReceiptChain(receipts) {
  let previousHash = null;
  for (let sequence = 0; sequence < receipts.length; sequence += 1) {
    const receipt = receipts[sequence];
    const { hash, ...body } = receipt;
    if (body.sequence !== sequence || body.previousHash !== previousHash) return false;
    if (sha256(canonicalize(body)) !== hash) return false;
    previousHash = hash;
  }
  return true;
}

export class TracePolicyMonitor {
  constructor(policy, { failClosed = true } = {}) {
    this.policy = normalizePolicy(policy);
    this.failClosed = Boolean(failClosed);
    this.denied = false;
    this.receipts = [];
  }

  authorize(event) {
    const normalized = normalizeEvent(event);
    const priorDenied = this.denied;
    const policyResult = tracePolicyDecision(this.policy, normalized);
    const decision = priorDenied && this.failClosed ? 'deny' : policyResult.decision;
    const reason = priorDenied && this.failClosed ? 'Monitor is locked after a prior denial.' : policyResult.reason;
    if (decision === 'deny') this.denied = true;
    const body = {
      v: 1,
      sequence: this.receipts.length,
      previousHash: this.receipts.at(-1)?.hash ?? null,
      event: normalized,
      decision,
      reason
    };
    const receipt = { ...body, hash: sha256(canonicalize(body)) };
    this.receipts.push(receipt);
    return structuredClone(receipt);
  }

  async execute(event, effect) {
    if (typeof effect !== 'function') throw Error('Trace effect must be a function');
    const receipt = this.authorize(event);
    if (receipt.decision !== 'allow') return { dispatched: false, receipt, result: undefined };
    const result = await effect();
    return { dispatched: true, receipt, result };
  }

  exportReceipts() {
    return structuredClone(this.receipts);
  }
}
