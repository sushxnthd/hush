import {SealedContextStore} from './secure-context.js';
import {PersistentReconstructionFirewall} from './reconstruction-firewall.js';
import {PrivateDecisionRuntime} from './private-decision.js';
import {compileSemanticProgram} from './context-compiler.js';

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
      v:3,
      profileRevision:this.runtime.profileRevision,
      firewallEvents:this.firewall.snapshot(),
      partitionState:this.runtime.partitionFirewall?.snapshot()??null,
      jointChoiceState:this.runtime.jointChoiceFirewall?.snapshot()??null
    });
  }

  put(path,value,{label=null,category='general',tags=[],domain=undefined}={}){
    const key=String(path||'');
    if(!key) throw new Error('Private context path is required');
    const item=this.store.put({
      id:this.pathToId.get(key)??null,
      kind:'context',
      path:key,
      label:label??key,
      category,
      value,
      tags,
      domain
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
    return this.store.list().filter(record=>record.kind==='context').map(({kind,domain,...record})=>({...record,partitionProtected:Boolean(domain)}));
  }

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
   */
  runSemantic({program,...input}={}){
    const compiled=compileSemanticProgram(this.list(),program);
    return this.run({...input,program:compiled});
  }

  exposure(){ return this.firewall.footprint(); }
  partitionExposure(){ return this.runtime.partitionFootprint(); }
  jointChoiceExposure(){ return this.runtime.jointChoiceFootprint(); }
  exportCiphertextBundle(){ return this.store.exportCiphertextBundle(); }
  ciphertextFingerprint(){ return this.store.ciphertextFingerprint(); }

  stats(){
    return {
      contextItems:this.list().length,
      profileRevision:this.runtime.profileRevision,
      exposureFields:this.exposure().length,
      partitionFields:this.partitionExposure().length,
      jointChoiceObservations:this.jointChoiceExposure().length,
      ciphertextFingerprint:this.ciphertextFingerprint()
    };
  }
}
