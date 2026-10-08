import crypto from 'node:crypto';

const MAX_LABEL=240;
const MAX_TAGS=16;
const MAX_TTL=24*60*60*1000;
const MAX_PROPOSALS=256;
const MAX_VALUE_BYTES=64*1024;

function text(value,max=MAX_LABEL){
  const out=String(value??'').trim();
  if(!out) return '';
  return out.length>max?out.slice(0,max):out;
}
function tags(values=[]){
  if(!Array.isArray(values)) throw new Error('Memory tags must be an array');
  if(values.length>MAX_TAGS) throw new Error(`Memory proposals support at most ${MAX_TAGS} tags`);
  return [...new Set(values.map(value=>text(value,120)).filter(Boolean))].sort();
}
function stablePath({label,category,tags}){
  const key=JSON.stringify({label:String(label).toLowerCase(),category:String(category).toLowerCase(),tags:[...tags].map(x=>x.toLowerCase()).sort()});
  const digest=crypto.createHash('sha256').update(key).digest('hex').slice(0,32);
  return `memory.shared.${digest}`;
}
function safeProposal(proposal){
  return {
    proposalId:proposal.id,
    decision:proposal.deniedAt?'deny':proposal.approvedAt?'approved':'ask',
    reason:proposal.deniedAt?'Memory proposal was denied.':proposal.approvedAt?'Memory proposal approved into shared Hush context.':'AI memory writes require explicit local approval.',
    agent:proposal.agent,
    label:proposal.label,
    category:proposal.category,
    tags:[...proposal.tags],
    createdAt:proposal.createdAt,
    expiresAt:proposal.expiresAt,
    approvedAt:proposal.approvedAt,
    deniedAt:proposal.deniedAt,
    committedRevision:proposal.committedRevision??null,
    valueIncluded:false
  };
}

/**
 * SharedMemoryBroker lets any AI propose memory without giving it unilateral write
 * access to the user's canonical context. Approved facts are stored once in the
 * encrypted ContextKernel and are then available to every provider through the same
 * bounded semantic interfaces.
 */
export class SharedMemoryBroker {
  constructor({kernel,now=()=>Date.now()}={}){
    if(!kernel||typeof kernel.put!=='function') throw new Error('SharedMemoryBroker requires a ContextKernel');
    this.kernel=kernel;
    this.now=now;
    this.proposals=new Map();
  }

  propose({agent='unknown-agent',label,category='general',tags:inputTags=[],value,ttlMs=30*60*1000}={}){
    this._purge();
    if(this.proposals.size>=MAX_PROPOSALS)throw new Error('Memory proposal queue is full; review or wait for expired proposals before adding more');
    const safeLabel=text(label);
    if(!safeLabel) throw new Error('Memory proposal label is required');
    if(!Object.hasOwn(arguments[0]??{},'value')) throw new Error('Memory proposal value is required');
    const encoded=JSON.stringify(value);
    if(encoded===undefined||Buffer.byteLength(encoded)>MAX_VALUE_BYTES)throw new Error('Memory proposal value exceeds the safety limit');
    const safeCategory=text(category,120)||'general';
    const safeTags=tags(inputTags);
    const ttl=Number(ttlMs);
    if(!Number.isFinite(ttl)||ttl<1000) throw new Error('Memory proposal TTL must be finite and at least 1000 ms');
    const now=this.now();
    const proposal={
      id:`memprop_${crypto.randomBytes(24).toString('base64url')}`,
      agent:text(agent||'unknown-agent',120),
      label:safeLabel,
      category:safeCategory,
      tags:safeTags,
      value:structuredClone(value),
      path:stablePath({label:safeLabel,category:safeCategory,tags:safeTags}),
      createdAt:now,
      expiresAt:now+Math.min(ttl,MAX_TTL),
      approvedAt:null,
      deniedAt:null,
      committedRevision:null
    };
    this.proposals.set(proposal.id,proposal);
    return safeProposal(proposal);
  }

  _proposal(id){
    const proposal=this.proposals.get(String(id));
    if(!proposal) throw new Error('Memory proposal not found');
    if(this.now()>=proposal.expiresAt){
      this.proposals.delete(proposal.id);
      throw new Error('Memory proposal expired');
    }
    return proposal;
  }

  queue({includeValues=false}={}){
    this._purge();
    return [...this.proposals.values()].map(proposal=>({
      ...safeProposal(proposal),
      ...(includeValues&&Object.hasOwn(proposal,'value')?{value:structuredClone(proposal.value)}:{})
    })).sort((a,b)=>b.createdAt-a.createdAt);
  }

  approve(id){
    const proposal=this._proposal(id);
    if(proposal.deniedAt) throw new Error('Memory proposal was denied');
    if(proposal.approvedAt) return safeProposal(proposal);
    const item=this.kernel.put(proposal.path,proposal.value,{label:proposal.label,category:proposal.category,tags:['memory',...proposal.tags]});
    proposal.approvedAt=this.now();
    proposal.committedRevision=item.revision;
    delete proposal.value;
    return safeProposal(proposal);
  }

  deny(id){
    const proposal=this._proposal(id);
    if(proposal.approvedAt) throw new Error('Approved memory cannot be denied; remove the stored memory instead');
    if(!proposal.deniedAt) proposal.deniedAt=this.now();
    delete proposal.value;
    return safeProposal(proposal);
  }

  _purge(){
    for(const [id,proposal] of this.proposals)if(this.now()>=proposal.expiresAt)this.proposals.delete(id);
  }
}
