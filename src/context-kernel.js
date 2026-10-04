import {SealedContextStore} from './secure-context.js';
import {PersistentReconstructionFirewall} from './reconstruction-firewall.js';
import {PrivateDecisionRuntime} from './private-decision.js';

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
      this.pathToId.set(record.path,record.id);
    }
    if(Number.isInteger(state.profileRevision) && state.profileRevision>=0){
      this.runtime.profileRevision=state.profileRevision;
    }
  }

  _persistState(){
    this.store.setState({
      v:1,
      profileRevision:this.runtime.profileRevision,
      firewallEvents:this.firewall.snapshot()
    });
  }

  put(path,value,{label=null,category='general',tags=[]}={}){
    const key=String(path||'');
    if(!key) throw new Error('Private context path is required');
    const item=this.store.put({
      id:this.pathToId.get(key)??null,
      kind:'context',
      path:key,
      label:label??key,
      category,
      value,
      tags
    });
    this.pathToId.set(key,item.id);
    const revision=this.runtime.setPrivate(key,value).revision;
    this._persistState();
    return {id:item.id,path:key,label:item.label,category:item.category,tags:item.tags,revision};
  }

  remove(path){
    const key=String(path||'');
    const id=this.pathToId.get(key);
    if(!id) return false;
    const ok=this.store.remove(id);
    if(ok){
      this.pathToId.delete(key);
      // Rebuild the in-memory profile so removed values cannot remain queryable.
      const savedRevision=this.runtime.profileRevision+1;
      this.runtime=new PrivateDecisionRuntime({now:this.now,firewall:this.firewall});
      for(const record of this.store.records()){
        if(record.kind==='context'&&record.path){
          this.runtime.setPrivate(record.path,record.value);
          this.pathToId.set(record.path,record.id);
        }
      }
      this.runtime.profileRevision=savedRevision;
      this._persistState();
    }
    return ok;
  }

  list(){
    return this.store.list().filter(record=>record.kind==='context').map(({kind,...record})=>record);
  }

  beginTrajectory(options={}){ return this.runtime.beginTrajectory(options); }
  revokeTrajectory(id){ return this.runtime.revokeTrajectory(id); }

  run(input){
    const result=this.runtime.run(input);
    if(result.decision==='allow') this._persistState();
    return result;
  }

  exposure(){ return this.firewall.footprint(); }
  exportCiphertextBundle(){ return this.store.exportCiphertextBundle(); }
  ciphertextFingerprint(){ return this.store.ciphertextFingerprint(); }

  stats(){
    return {
      contextItems:this.list().length,
      profileRevision:this.runtime.profileRevision,
      exposureFields:this.exposure().length,
      ciphertextFingerprint:this.ciphertextFingerprint()
    };
  }
}
