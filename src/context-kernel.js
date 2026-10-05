import crypto from 'node:crypto';
import {SealedContextStore} from './secure-context.js';
import {PersistentReconstructionFirewall} from './reconstruction-firewall.js';
import {PrivateDecisionRuntime} from './private-decision.js';
import {compileSemanticProgram,resolvePrivateRef} from './context-compiler.js';
import {normalizeConnectorSnapshot,connectorSummary} from './connectors.js';
import {sanitizeContextValue,contextSanitizationModes} from './context-sanitizer.js';
import {SharedMemoryBroker} from './memory-broker.js';
import {ModelRouter} from './model-router.js';

const DEFAULT_RELEASE_TTL=5*60*1000;
const MAX_RELEASE_TTL=15*60*1000;

function stripSemanticPaths(result){
  const out=structuredClone(result);
  if(out?.reconstruction?.fields){
    out.reconstruction.fields=out.reconstruction.fields.map(({field,...rest})=>rest);
  }
  if(out?.partition&&Object.hasOwn(out.partition,'field')) delete out.partition.field;
  if(out?.joint?.fields){
    out.joint.fieldCount=out.joint.fields.length;
    delete out.joint.fields;
  }
  return out;
}

function safeReleaseMetadata(release){
  return {
    releaseId:release.id,
    decision:release.deniedAt?'deny':release.approvedAt?'approved':'ask',
    reason:release.deniedAt?'Context fallback was denied.':release.approvedAt?'Sanitized context fallback approved for one release.':'Sanitized context fallback requires explicit local approval.',
    agent:release.agent,
    sink:release.sink,
    purpose:release.purpose,
    category:release.category,
    mode:release.mode,
    transformations:[...release.transformations],
    outputBytes:release.outputBytes,
    createdAt:release.createdAt,
    expiresAt:release.expiresAt,
    approvedAt:release.approvedAt,
    deniedAt:release.deniedAt,
    consumedAt:release.consumedAt,
    exactPrivateValuesIntended:false,
    bestEffortTextSanitization:true
  };
}

/**
 * ContextKernel ties encrypted persistence to bounded private computation.
 * Plaintext is decrypted only inside the local process; callers receive metadata,
 * bounded decision results and receipts, never the stored private values.
 */
export class ContextKernel {
  constructor({dir,passphrase,now=()=>Date.now(),firewallOptions={}}={}){
    this.now=now;
    this.store=new SealedContextStore({dir,passphrase,now});
    const state=this.store.getState();
    this.firewall=new PersistentReconstructionFirewall({now,...firewallOptions});
    this.firewall.restore(state.firewallEvents??[]);
    this.runtime=new PrivateDecisionRuntime({now,firewall:this.firewall});
    this.pathToId=new Map();
    this.pendingContextReleases=new Map();
    this.memoryBroker=new SharedMemoryBroker({kernel:this,now});
    this.modelRouter=new ModelRouter();
    for(const model of state.routerModels??[]) this.modelRouter.register(model);

    for(const record of this.store.records()){
      if(record.kind!=='context' || !record.path) continue;
      this.runtime.setPrivate(record.path,record.value);
      if(record.domain) this.runtime.registerPrivateDomain(record.path,record.domain);
      this.pathToId.set(record.path,record.id);
    }
    if(state.partitionState) this.runtime.partitionFirewall?.restore(state.partitionState);
    if(state.jointChoiceState) this.runtime.jointChoiceFirewall?.restore(state.jointChoiceState);
    if(Number.isInteger(state.profileRevision) && state.profileRevision>=0){
      this.runtime.profileRevision=state.profileRevision;
    }
  }

  _persistState(){
    this.store.setState({
      v:4,
      profileRevision:this.runtime.profileRevision,
      firewallEvents:this.firewall.snapshot(),
      partitionState:this.runtime.partitionFirewall?.snapshot()??null,
      jointChoiceState:this.runtime.jointChoiceFirewall?.snapshot()??null,
      routerModels:this.modelRouter.list()
    });
  }

  _invalidateContextReleases(path){
    const key=String(path||'');
    for(const [id,release] of this.pendingContextReleases){
      if(release.path===key&&!release.consumedAt) this.pendingContextReleases.delete(id);
    }
  }

  put(path,value,{label=null,category='general',tags=[],domain=undefined,source=undefined}={}){
    const key=String(path||'');
    if(!key) throw new Error('Private context path is required');
    this._invalidateContextReleases(key);
    const item=this.store.put({
      id:this.pathToId.get(key)??null,
      kind:'context',
      path:key,
      label:label??key,
      category,
      value,
      tags,
      domain,
      source
    });
    this.pathToId.set(key,item.id);
    const revision=this.runtime.setPrivate(key,value,{domain:item.domain??undefined}).revision;
    this._persistState();
    return {id:item.id,path:key,label:item.label,category:item.category,tags:item.tags,partitionProtected:Boolean(item.domain),revision};
  }

  remove(path){
    const key=String(path||'');
    const id=this.pathToId.get(key);
    if(!id) return false;
    this._invalidateContextReleases(key);
    const partitionSnapshot=this.runtime.partitionFirewall?.snapshot()??null;
    const jointChoiceSnapshot=this.runtime.jointChoiceFirewall?.snapshot()??null;
    const ok=this.store.remove(id);
    if(ok){
      this.pathToId.delete(key);
      const savedRevision=this.runtime.profileRevision+1;
      this.runtime=new PrivateDecisionRuntime({now:this.now,firewall:this.firewall});
      for(const record of this.store.records()){
        if(record.kind==='context'&&record.path){
          this.runtime.setPrivate(record.path,record.value);
          if(record.domain) this.runtime.registerPrivateDomain(record.path,record.domain);
          this.pathToId.set(record.path,record.id);
        }
      }
      if(partitionSnapshot?.v===1){
        this.runtime.partitionFirewall?.restore({...partitionSnapshot,fields:(partitionSnapshot.fields??[]).filter(field=>String(field.field)!==key)});
      }
      if(jointChoiceSnapshot?.v===1){
        this.runtime.jointChoiceFirewall?.restore(jointChoiceSnapshot);
        this.runtime.jointChoiceFirewall?.resetField(key);
      }
      this.runtime.profileRevision=savedRevision;
      this._persistState();
    }
    return ok;
  }

  list(){
    return this.store.list().filter(record=>record.kind==='context').map(({kind,domain,source,...record})=>({...record,partitionProtected:Boolean(domain)}));
  }

  connectorStats(){
    return connectorSummary(this.store.records().filter(record=>record.kind==='context'));
  }

  /**
   * Import a provider snapshot into the encrypted Context Kernel. Stable source ids
   * are hashed into private paths; raw ids and provider payloads remain encrypted.
   * A replace import removes records from the same provider/collection that are no
   * longer present in the new snapshot.
   */
  ingestConnectorSnapshot(snapshot){
    const normalized=normalizeConnectorSnapshot(snapshot);
    const previous=this.store.records().filter(record=>record.kind==='context'&&record.source?.provider===normalized.provider&&record.source?.collection===normalized.collection);
    const incomingPaths=new Set(normalized.records.map(record=>record.path));
    let created=0,updated=0,removed=0;

    for(const record of normalized.records){
      const existed=this.pathToId.has(record.path);
      this.put(record.path,record.value,{label:record.label,category:record.category,tags:record.tags,domain:record.domain,source:record.source});
      if(existed) updated+=1; else created+=1;
    }

    if(normalized.replace){
      for(const record of previous){
        if(!incomingPaths.has(record.path)&&this.remove(record.path)) removed+=1;
      }
    }

    const row=this.connectorStats().find(item=>item.provider===normalized.provider&&item.collection===normalized.collection);
    return {provider:normalized.provider,collection:normalized.collection,received:normalized.records.length,created,updated,removed,total:row?.items??0,replace:normalized.replace};
  }

  proposeMemory(input={}){ return this.memoryBroker.propose(input); }
  memoryProposalQueue(options={}){ return this.memoryBroker.queue(options); }
  approveMemoryProposal(id){ return this.memoryBroker.approve(id); }
  denyMemoryProposal(id){ return this.memoryBroker.deny(id); }

  registerModel(model){ const registered=this.modelRouter.register(model); this._persistState(); return registered; }
  removeModel(id){ const removed=this.modelRouter.remove(id); if(removed) this._persistState(); return removed; }
  listModels(){ return this.modelRouter.list(); }
  routeTask(request={}){ return this.modelRouter.route(request); }

  beginTrajectory(options={}){ return this.runtime.beginTrajectory(options); }
  revokeTrajectory(id){ return this.runtime.revokeTrajectory(id); }

  run(input){
    const result=this.runtime.run(input);
    if(result.decision==='allow') this._persistState();
    return result;
  }

  /**
   * Compile a path-free semantic request entirely inside the trusted local process.
   * Raw private paths are never accepted from, or returned to, the calling agent.
   * Task text is used only as local context-selection evidence.
   */
  runSemantic({program,task='',...input}={}){
    const compiled=compileSemanticProgram(this.list(),program,{task});
    return stripSemanticPaths(this.run({...input,program:compiled}));
  }

  /**
   * Prepare a sanitized content fallback without releasing the content. Unlike the
   * bounded PDP path, free-form context cannot currently receive an exact leakage
   * bound, so Hush always requires an explicit local approval before one-shot use.
   */
  prepareContextRelease({task='',privateRef={},mode='pseudonymous',agent='unknown-agent',sink='unknown-sink',purpose='unspecified',ttlMs=DEFAULT_RELEASE_TTL}={}){
    const ttl=Number(ttlMs);
    if(!Number.isFinite(ttl)||ttl<1000) throw new Error('Context release TTL must be finite and at least 1000 ms');
    const path=resolvePrivateRef(this.list(),privateRef,{task:String(task??'')});
    const recordId=this.pathToId.get(path);
    if(!recordId) throw new Error('Selected private context is unavailable');
    const record=this.store.get(recordId);
    const prepared=sanitizeContextValue(record.value,{mode});
    const now=this.now();
    const release={
      id:`ctxrel_${crypto.randomBytes(24).toString('base64url')}`,
      path,
      agent:String(agent||'unknown-agent'),
      sink:String(sink||'unknown-sink'),
      purpose:String(purpose||'unspecified'),
      category:String(record.category||'general'),
      mode:prepared.mode,
      sanitized:prepared.sanitized,
      transformations:prepared.transformations,
      outputBytes:prepared.outputBytes,
      digest:prepared.digest,
      createdAt:now,
      expiresAt:now+Math.min(ttl,MAX_RELEASE_TTL),
      approvedAt:null,
      deniedAt:null,
      consumedAt:null
    };
    this.pendingContextReleases.set(release.id,release);
    return safeReleaseMetadata(release);
  }

  _contextRelease(id){
    const release=this.pendingContextReleases.get(String(id));
    if(!release) throw new Error('Context release not found');
    if(this.now()>=release.expiresAt){
      this.pendingContextReleases.delete(release.id);
      throw new Error('Context release expired');
    }
    return release;
  }

  contextReleaseQueue(){
    const now=this.now();
    for(const [id,release] of this.pendingContextReleases){
      if(now>=release.expiresAt) this.pendingContextReleases.delete(id);
    }
    return [...this.pendingContextReleases.values()].map(safeReleaseMetadata).sort((a,b)=>b.createdAt-a.createdAt);
  }

  approveContextRelease(id){
    const release=this._contextRelease(id);
    if(release.deniedAt) throw new Error('Context release was denied');
    if(release.consumedAt) throw new Error('Context release already consumed');
    if(!release.approvedAt) release.approvedAt=this.now();
    return safeReleaseMetadata(release);
  }

  denyContextRelease(id){
    const release=this._contextRelease(id);
    if(release.consumedAt) throw new Error('Context release already consumed');
    release.deniedAt=this.now();
    return safeReleaseMetadata(release);
  }

  consumeContextRelease({releaseId,agent='unknown-agent',sink='unknown-sink'}={}){
    const release=this._contextRelease(releaseId);
    if(release.agent!==String(agent)||release.sink!==String(sink)) throw new Error('Context release is bound to another agent or sink');
    if(release.deniedAt) throw new Error('Context release was denied');
    if(!release.approvedAt) return {...safeReleaseMetadata(release),decision:'ask'};
    if(release.consumedAt) throw new Error('Context release already consumed');
    release.consumedAt=this.now();
    return {
      decision:'allow',
      context:structuredClone(release.sanitized),
      category:release.category,
      mode:release.mode,
      transformations:[...release.transformations],
      exactPrivateValuesIntended:false,
      bestEffortTextSanitization:true,
      receipt:{
        v:1,at:release.consumedAt,releaseId:release.id,agent:release.agent,sink:release.sink,purpose:release.purpose,
        sanitizedDigest:release.digest,outputBytes:release.outputBytes,oneShot:true,rawPrivatePathIncluded:false
      }
    };
  }

  contextReleaseModes(){ return contextSanitizationModes(); }

  exposure(){ return this.firewall.footprint(); }
  partitionExposure(){ return this.runtime.partitionFootprint(); }
  jointChoiceExposure(){ return this.runtime.jointChoiceFootprint(); }
  exportCiphertextBundle(){ return this.store.exportCiphertextBundle(); }
  ciphertextFingerprint(){ return this.store.ciphertextFingerprint(); }

  stats(){
    return {
      contextItems:this.list().length,
      connectors:this.connectorStats(),
      pendingContextReleases:this.contextReleaseQueue().filter(release=>release.decision==='ask').length,
      pendingMemoryProposals:this.memoryProposalQueue().filter(proposal=>proposal.decision==='ask').length,
      registeredModels:this.modelRouter.list().length,
      profileRevision:this.runtime.profileRevision,
      exposureFields:this.exposure().length,
      partitionFields:this.partitionExposure().length,
      jointChoiceObservations:this.jointChoiceExposure().length,
      ciphertextFingerprint:this.ciphertextFingerprint()
    };
  }
}
