function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export function verifyObservablePrefixClosure(rows){
  if(!Array.isArray(rows)||rows.length<2)throw new TypeError('At least two finite private worlds are required');
  const horizon=rows[0]?.authorized?.length;
  if(!Number.isInteger(horizon)||horizon<1)throw new TypeError('A non-empty authorized event trace is required');
  const ids=new Set();
  for(const row of rows){
    if(ids.has(row.secretId))throw new TypeError('secretId values must be unique');
    ids.add(row.secretId);
    if(!Array.isArray(row.authorized)||!Array.isArray(row.observable)||row.authorized.length!==horizon||row.observable.length!==horizon)throw new TypeError('All traces must share one non-empty horizon');
  }
  const violations=[];
  for(let prefix=1;prefix<=horizon;prefix++){
    const fibers=new Map();
    for(const row of rows){
      const key=canonical([row.publicInput??null,row.authorized.slice(0,prefix)]);
      const observation=canonical(row.observable.slice(0,prefix));
      const prior=fibers.get(key);
      if(prior&&prior.observation!==observation){
        violations.push({prefix,secretA:prior.secretId,secretB:row.secretId,authorizedPrefix:row.authorized.slice(0,prefix),observableA:prior.raw,observableB:row.observable.slice(0,prefix)});
        break;
      }
      if(!prior)fibers.set(key,{secretId:row.secretId,observation,raw:row.observable.slice(0,prefix)});
    }
  }
  return {
    safe:violations.length===0,
    finalSafe:!violations.some(item=>item.prefix===horizon),
    checkedWorlds:rows.length,
    checkedPrefixes:horizon,
    witness:violations[0]??null,
    finalWitness:violations.find(item=>item.prefix===horizon)??null
  };
}

export {canonical as canonicalObservable};
