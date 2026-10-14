function checkedRisks(memberRisks){
  if(!Array.isArray(memberRisks) || memberRisks.length===0) throw new TypeError('memberRisks must be a nonempty array');
  const values=memberRisks.map(Number);
  if(values.some(value=>!Number.isFinite(value) || value<0)) throw new TypeError('member risks must be finite and nonnegative');
  return values;
}

export class TraceEnvelopeLedger{
  #value=0;
  #steps=0;

  update(memberRisks){
    const values=checkedRisks(memberRisks);
    this.#value=Math.max(this.#value,...values);
    this.#steps+=1;
    return this.snapshot();
  }

  snapshot(){ return Object.freeze({chargeBits:this.#value,steps:this.#steps,stateScalars:1}); }
}

export class IndependentStepLedger{
  #value=0;
  #previous=null;
  #steps=0;

  update(memberRisks){
    const values=checkedRisks(memberRisks);
    if(this.#previous!==null && values.length!==this.#previous.length) throw new TypeError('ensemble size changed');
    const previous=this.#previous ?? values.map(()=>0);
    const increment=Math.max(...values.map((value,index)=>Math.max(0,value-previous[index])));
    this.#value+=increment;
    this.#previous=values;
    this.#steps+=1;
    return this.snapshot();
  }

  snapshot(){
    return Object.freeze({chargeBits:this.#value,steps:this.#steps,stateScalars:1+(this.#previous?.length??0)});
  }
}
