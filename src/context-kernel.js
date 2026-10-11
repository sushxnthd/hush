import crypto from 'node:crypto';
import {ContextKernel as BaseContextKernel} from './context-kernel-base.js';
import {resolvePrivateRef} from './context-compiler.js';
import {compilePrivateConstraint,normalizeConstraintContract,constraintContractSummary} from './private-constraint-compiler.js';

const DEFAULT_CONSTRAINT_TTL=5*60*1000;
const MAX_CONSTRAINT_TTL=15*60*1000;

function consentSummary(verdict){
  return {
    decision:verdict.decision,
    ruleId:verdict.rule?.id??null,
    mode:verdict.rule?.mode??null,
    reason:verdict.reason
  };
}

function safeConstraintReleaseMetadata(release){
  return {
    releaseId:release.id,
    contractId:release.contractId,
    decision:release.deniedAt?'deny':release.approvedAt?'approved':'ask',
    reason:release.deniedAt?'Compiled constraint release was denied.':release.approvedAt?'Compiled constraint approved for one release.':'Compiled constraint requires explicit local approval.',
    agent:release.agent,
    sink:release.sink,
    purpose:release.purpose,
    category:release.category,
    valueType:release.valueType,
    releaseKind:release.releaseKind,
    outputBytes:release.outputBytes,
    createdAt:release.createdAt,
    expiresAt:release.expiresAt,
    approvedAt:release.approvedAt,
    deniedAt:release.deniedAt,
    consumedAt:release.consumedAt,
    consent:release.consent??null,
    rawSourceIncluded:false,
    rawPrivatePathIncluded:false,
    derivedDisclosure:true
  };
}

function safeConstraintBundleMetadata(bundle){
  return {
    bundleId:bundle.id,
    contractIds:[...bundle.contractIds],
    decision:bundle.deniedAt?'deny':bundle.approvedAt?'approved':'ask',
    reason:bundle.deniedAt?'Compiled constraint bundle was denied.':bundle.approvedAt?'Compiled constraint bundle approved for one release.':'Compiled constraint bundle requires one explicit local approval.',
    agent:bundle.agent,
    sink:bundle.sink,
    purpose:bundle.purpose,
    category:bundle.category,
    releaseKind:'compare_bundle',
    outputCount:bundle.outputs.length,
    capacityBits:bundle.capacityBits,
    createdAt:bundle.createdAt,
    expiresAt:bundle.expiresAt,
    approvedAt:bundle.approvedAt,
    deniedAt:bundle.deniedAt,
    consumedAt:bundle.consumedAt,
    consent:bundle.consent??null,
    rawSourceIncluded:false,
    rawPrivatePathIncluded:false,
    derivedDisclosure:true
  };
}

/**
 * ContextKernel with Private Constraint Compilation.
 *
 * The inherited kernel remains byte-for-byte preserved in context-kernel-base.js.
 * This compatibility layer adds a compute-before-disclose path for private facts
 * whose useful task constraint is fused with unrelated sensitive prose.
 */
export class ContextKernel extends BaseContextKernel{
  constructor(options={}){
    super(options);
    this.pendingConstraintReleases=new Map();
    this.pendingConstraintBundles=new Map();
    this.constraintContracts=new Map();
    const state=this.store.getState();
    for(const raw of state.constraintContracts??[]){
      try{
        const contract=normalizeConstraintContract(raw);
        this.constraintContracts.set(contract.id,contract);
      }catch{
        // Old/corrupt experimental contracts fail closed rather than preventing
        // the rest of the encrypted context store from opening.
      }
    }
  }

  _persistState(){
    super._persistState();
    const state=this.store.getState();
    this.store.setState({
      ...state,
      v:6,
      constraintContracts:[...this.constraintContracts.values()].map(contract=>structuredClone(contract))
    });
  }

  _invalidateConstraintReleases(path){
    const key=String(path||'');
    if(!this.pendingConstraintReleases) return;
    for(const [id,release] of this.pendingConstraintReleases){
      if(release.path===key&&!release.consumedAt) this.pendingConstraintReleases.delete(id);
    }
    for(const [id,bundle] of this.pendingConstraintBundles){
      if(bundle.path===key&&!bundle.consumedAt) this.pendingConstraintBundles.delete(id);
    }
  }

  put(path,value,options={}){
    this._invalidateConstraintReleases(path);
    return super.put(path,value,options);
  }

  remove(path){
    this._invalidateConstraintReleases(path);
    return super.remove(path);
  }

  registerConstraintContract(rawContract){
    const contract=normalizeConstraintContract(rawContract);
    this.constraintContracts.set(contract.id,contract);
    this._persistState();
    return constraintContractSummary(contract);
  }

  removeConstraintContract(id){
    const key=String(id||'');
    const removed=this.constraintContracts.delete(key);
    if(!removed) return false;
    for(const [releaseId,release] of this.pendingConstraintReleases){
      if(release.contractId===key&&!release.consumedAt) this.pendingConstraintReleases.delete(releaseId);
    }
    for(const [bundleId,bundle] of this.pendingConstraintBundles){
      if(bundle.contractIds.includes(key)&&!bundle.consumedAt) this.pendingConstraintBundles.delete(bundleId);
    }
    this._persistState();
    return true;
  }

  listConstraintContracts(){
    return [...this.constraintContracts.values()].map(constraintContractSummary).sort((a,b)=>a.id.localeCompare(b.id));
  }

  prepareConstraintRelease({contractId,task='',agent='unknown-agent',sink='unknown-sink',purpose='unspecified',ttlMs=DEFAULT_CONSTRAINT_TTL}={}){
    const ttl=Number(ttlMs);
    if(!Number.isFinite(ttl)||ttl<1000) throw new Error('Constraint release TTL must be finite and at least 1000 ms');
    const contract=this.constraintContracts.get(String(contractId||''));
    if(!contract) throw new Error('Constraint contract not found');

    const path=resolvePrivateRef(this.list(),contract.privateRef,{task:String(task??'')});
    const recordId=this.pathToId.get(path);
    if(!recordId) throw new Error('Selected private context is unavailable');
    const record=this.store.get(recordId);
    const compiled=compilePrivateConstraint(record.value,contract);
    const now=this.now();
    const request={
      capability:'context.compute',
      agent:String(agent||'unknown-agent'),
      sink:String(sink||'unknown-sink'),
      purpose:String(purpose||'unspecified'),
      category:String(record.category||'general'),
      resource:contract.id
    };
    const verdict=this.consentRegistry.evaluate(request,{consume:false});
    const serialized=JSON.stringify({statement:compiled.statement,value:compiled.value,valueType:compiled.valueType,releaseKind:compiled.releaseKind});
    const release={
      id:`pccrel_${crypto.randomBytes(24).toString('base64url')}`,
      path,
      contractId:contract.id,
      agent:request.agent,
      sink:request.sink,
      purpose:request.purpose,
      category:request.category,
      statement:compiled.statement,
      value:structuredClone(compiled.value),
      valueType:compiled.valueType,
      releaseKind:compiled.releaseKind,
      contractDigest:compiled.contractDigest,
      sourceDigest:compiled.sourceDigest,
      outputDigest:crypto.createHash('sha256').update(serialized).digest('hex'),
      outputBytes:Buffer.byteLength(serialized),
      createdAt:now,
      expiresAt:now+Math.min(ttl,MAX_CONSTRAINT_TTL),
      approvedAt:verdict.decision==='allow'?now:null,
      deniedAt:verdict.decision==='deny'?now:null,
      consumedAt:null,
      consent:consentSummary(verdict)
    };
    if(verdict.decision==='allow'&&verdict.rule?.mode==='once'){
      this.consentRegistry.evaluate(request,{consume:true});
      release.consent={...release.consent,consumed:true};
      this._persistState();
    }
    this.pendingConstraintReleases.set(release.id,release);
    return safeConstraintReleaseMetadata(release);
  }

  _constraintRelease(id){
    const release=this.pendingConstraintReleases.get(String(id));
    if(!release) throw new Error('Constraint release not found');
    if(this.now()>=release.expiresAt){
      this.pendingConstraintReleases.delete(release.id);
      throw new Error('Constraint release expired');
    }
    return release;
  }

  constraintReleaseQueue(){
    const now=this.now();
    for(const [id,release] of this.pendingConstraintReleases){
      if(now>=release.expiresAt) this.pendingConstraintReleases.delete(id);
    }
    return [...this.pendingConstraintReleases.values()].map(safeConstraintReleaseMetadata).sort((a,b)=>b.createdAt-a.createdAt);
  }

  approveConstraintRelease(id){
    const release=this._constraintRelease(id);
    if(release.deniedAt) throw new Error('Constraint release was denied');
    if(release.consumedAt) throw new Error('Constraint release already consumed');
    if(!release.approvedAt) release.approvedAt=this.now();
    return safeConstraintReleaseMetadata(release);
  }

  denyConstraintRelease(id){
    const release=this._constraintRelease(id);
    if(release.consumedAt) throw new Error('Constraint release already consumed');
    release.deniedAt=this.now();
    return safeConstraintReleaseMetadata(release);
  }

  consumeConstraintRelease({releaseId,agent='unknown-agent',sink='unknown-sink'}={}){
    const release=this._constraintRelease(releaseId);
    if(release.agent!==String(agent)||release.sink!==String(sink)) throw new Error('Constraint release is bound to another agent or sink');
    if(release.deniedAt) throw new Error('Constraint release was denied');
    if(!release.approvedAt) return {...safeConstraintReleaseMetadata(release),decision:'ask'};
    if(release.consumedAt) throw new Error('Constraint release already consumed');
    release.consumedAt=this.now();
    return {
      decision:'allow',
      constraint:{
        statement:release.statement,
        value:structuredClone(release.value),
        valueType:release.valueType,
        releaseKind:release.releaseKind
      },
      category:release.category,
      contractId:release.contractId,
      rawSourceIncluded:false,
      rawPrivatePathIncluded:false,
      derivedDisclosure:true,
      receipt:{
        v:1,
        at:release.consumedAt,
        releaseId:release.id,
        contractId:release.contractId,
        agent:release.agent,
        sink:release.sink,
        purpose:release.purpose,
        outputDigest:release.outputDigest,
        contractDigest:release.contractDigest,
        outputBytes:release.outputBytes,
        oneShot:true,
        rawSourceIncluded:false,
        rawPrivatePathIncluded:false,
        consentRuleId:release.consent?.ruleId??null
      }
    };
  }

  prepareConstraintReleaseBundle({contractIds=[],maxBits=0,task='',agent='unknown-agent',sink='unknown-sink',purpose='unspecified',ttlMs=DEFAULT_CONSTRAINT_TTL}={}){
    const ttl=Number(ttlMs);
    if(!Number.isFinite(ttl)||ttl<1000) throw new Error('Constraint bundle TTL must be finite and at least 1000 ms');
    if(!Array.isArray(contractIds)) throw new Error('Constraint bundle contractIds must be an array');
    const ids=contractIds.map(id=>String(id||''));
    if(ids.length<2||ids.length>4||new Set(ids).size!==ids.length) throw new Error('Constraint bundle requires 2 to 4 unique contracts');
    const declaredBits=Number(maxBits);
    if(!Number.isInteger(declaredBits)||declaredBits<ids.length||declaredBits>4) throw new Error('Constraint bundle maxBits must cover every boolean output and be at most 4');

    const outputs=[];
    let sharedPath=null;
    let sharedCategory=null;
    for(const id of ids){
      const contract=this.constraintContracts.get(id);
      if(!contract) throw new Error('Constraint contract not found');
      const path=resolvePrivateRef(this.list(),contract.privateRef,{task:String(task??'')});
      if(sharedPath!==null&&path!==sharedPath) throw new Error('Constraint bundle contracts must resolve to the same private record');
      const recordId=this.pathToId.get(path);
      if(!recordId) throw new Error('Selected private context is unavailable');
      const record=this.store.get(recordId);
      const compiled=compilePrivateConstraint(record.value,contract);
      if(compiled.releaseKind!=='compare'||compiled.valueType!=='boolean') throw new Error('Constraint bundle permits boolean comparison releases only');
      sharedPath=path;
      sharedCategory=String(record.category||'general');
      outputs.push({
        contractId:id,
        statement:compiled.statement,
        value:compiled.value,
        valueType:compiled.valueType,
        releaseKind:compiled.releaseKind,
        contractDigest:compiled.contractDigest,
        sourceDigest:compiled.sourceDigest
      });
    }

    const request={
      capability:'context.compute',
      agent:String(agent||'unknown-agent'),
      sink:String(sink||'unknown-sink'),
      purpose:String(purpose||'unspecified'),
      category:sharedCategory,
      resource:`bundle:${crypto.createHash('sha256').update(ids.join('\n')).digest('hex')}`
    };
    const verdict=this.consentRegistry.evaluate(request,{consume:false});
    const serialized=JSON.stringify(outputs.map(({statement,value,valueType,releaseKind})=>({statement,value,valueType,releaseKind})));
    const now=this.now();
    const bundle={
      id:`pccbun_${crypto.randomBytes(24).toString('base64url')}`,
      path:sharedPath,
      contractIds:ids,
      agent:request.agent,
      sink:request.sink,
      purpose:request.purpose,
      category:request.category,
      outputs,
      capacityBits:ids.length,
      declaredMaxBits:declaredBits,
      outputDigest:crypto.createHash('sha256').update(serialized).digest('hex'),
      outputBytes:Buffer.byteLength(serialized),
      createdAt:now,
      expiresAt:now+Math.min(ttl,MAX_CONSTRAINT_TTL),
      approvedAt:verdict.decision==='allow'?now:null,
      deniedAt:verdict.decision==='deny'?now:null,
      consumedAt:null,
      consent:consentSummary(verdict)
    };
    if(verdict.decision==='allow'&&verdict.rule?.mode==='once'){
      this.consentRegistry.evaluate(request,{consume:true});
      bundle.consent={...bundle.consent,consumed:true};
      this._persistState();
    }
    this.pendingConstraintBundles.set(bundle.id,bundle);
    return safeConstraintBundleMetadata(bundle);
  }

  _constraintBundle(id){
    const bundle=this.pendingConstraintBundles.get(String(id));
    if(!bundle) throw new Error('Constraint bundle not found');
    if(this.now()>=bundle.expiresAt){
      this.pendingConstraintBundles.delete(bundle.id);
      throw new Error('Constraint bundle expired');
    }
    return bundle;
  }

  constraintReleaseBundleQueue(){
    const now=this.now();
    for(const [id,bundle] of this.pendingConstraintBundles){
      if(now>=bundle.expiresAt) this.pendingConstraintBundles.delete(id);
    }
    return [...this.pendingConstraintBundles.values()].map(safeConstraintBundleMetadata).sort((a,b)=>b.createdAt-a.createdAt);
  }

  approveConstraintReleaseBundle(id){
    const bundle=this._constraintBundle(id);
    if(bundle.deniedAt) throw new Error('Constraint bundle was denied');
    if(bundle.consumedAt) throw new Error('Constraint bundle already consumed');
    if(!bundle.approvedAt) bundle.approvedAt=this.now();
    return safeConstraintBundleMetadata(bundle);
  }

  denyConstraintReleaseBundle(id){
    const bundle=this._constraintBundle(id);
    if(bundle.consumedAt) throw new Error('Constraint bundle already consumed');
    bundle.deniedAt=this.now();
    return safeConstraintBundleMetadata(bundle);
  }

  consumeConstraintReleaseBundle({bundleId,agent='unknown-agent',sink='unknown-sink'}={}){
    const bundle=this._constraintBundle(bundleId);
    if(bundle.agent!==String(agent)||bundle.sink!==String(sink)) throw new Error('Constraint bundle is bound to another agent or sink');
    if(bundle.deniedAt) throw new Error('Constraint bundle was denied');
    if(!bundle.approvedAt) return {...safeConstraintBundleMetadata(bundle),decision:'ask'};
    if(bundle.consumedAt) throw new Error('Constraint bundle already consumed');
    bundle.consumedAt=this.now();
    return {
      decision:'allow',
      constraints:bundle.outputs.map(({contractId,statement,value,valueType,releaseKind})=>({contractId,statement,value:structuredClone(value),valueType,releaseKind})),
      category:bundle.category,
      contractIds:[...bundle.contractIds],
      capacityBits:bundle.capacityBits,
      rawSourceIncluded:false,
      rawPrivatePathIncluded:false,
      derivedDisclosure:true,
      receipt:{
        v:1,
        at:bundle.consumedAt,
        bundleId:bundle.id,
        contractIds:[...bundle.contractIds],
        agent:bundle.agent,
        sink:bundle.sink,
        purpose:bundle.purpose,
        outputDigest:bundle.outputDigest,
        contractDigests:bundle.outputs.map(output=>output.contractDigest),
        capacityBits:bundle.capacityBits,
        declaredMaxBits:bundle.declaredMaxBits,
        oneShot:true,
        rawSourceIncluded:false,
        rawPrivatePathIncluded:false,
        consentRuleId:bundle.consent?.ruleId??null
      }
    };
  }

  stats(){
    return {
      ...super.stats(),
      registeredConstraintContracts:this.constraintContracts.size,
      pendingConstraintReleases:this.constraintReleaseQueue().filter(release=>release.decision==='ask').length,
      pendingConstraintBundles:this.constraintReleaseBundleQueue().filter(bundle=>bundle.decision==='ask').length
    };
  }
}
