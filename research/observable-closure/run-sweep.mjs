import fs from 'node:fs';
import {certifyObservableClosure} from '../../src/observable-closure-contract.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const maps=[];
for(let bits=0;bits<16;bits++){
  const trace={};
  worlds.forEach((world,index)=>{trace[world]=[(bits>>index)&1];});
  maps.push(trace);
}
const factored=maps.filter(trace=>trace['00'][0]===trace['11'][0]&&trace['01'][0]===trace['10'][0]);

let legacyAccepted=0,legacyFalseAccepts=0,closureAccepted=0,closureFalseAccepts=0,closureFalseRejects=0;
const rows=[];
for(let ownedCount=1;ownedCount<=5;ownedCount++){
  const ownedAssignments=4**ownedCount;
  let accepted=0,falseAccepts=0,closed=0;
  for(let assignment=0;assignment<ownedAssignments;assignment++){
    const owned={};
    let cursor=assignment;
    for(let index=0;index<ownedCount;index++){
      owned[`owned-${index}`]={mode:'broker-owned',traces:factored[cursor%4]};
      cursor=Math.floor(cursor/4);
    }
    for(const unownedTrace of maps){
      accepted++;
      legacyAccepted++;
      const actuallySafe=factored.some(trace=>JSON.stringify(trace)===JSON.stringify(unownedTrace));
      if(!actuallySafe){ falseAccepts++; legacyFalseAccepts++; }
      const externalChannels=[...Object.keys(owned),'out-of-band'];
      const incomplete=certifyObservableClosure({worlds,globalAuthorization:parity,externalChannels,closure:owned});
      if(incomplete.safe) throw new Error('uncovered channel was accepted');
      const complete=certifyObservableClosure({
        worlds,globalAuthorization:parity,externalChannels,
        closure:{...owned,'out-of-band':{mode:'independently-verified',traces:unownedTrace}}
      });
      if(complete.safe){ closed++; closureAccepted++; if(!actuallySafe) closureFalseAccepts++; }
      else if(actuallySafe) closureFalseRejects++;
    }
  }
  rows.push({ownedCount,legacyAccepted:accepted,legacyFalseAccepts:falseAccepts,closureAccepted:closed});
}
const result={
  schema:'hush.observable-closure-sweep.v1',
  worlds,authorization:'parity',rows,
  totals:{legacyAccepted,legacyFalseAccepts,closureAccepted,closureFalseAccepts,closureFalseRejects},
  prediction:{legacyAccepted:21824,legacyFalseAccepts:16368,closureAccepted:5456,closureFalseAccepts:0,closureFalseRejects:0}
};
result.predictionsMatch=JSON.stringify(result.totals)===JSON.stringify(result.prediction);
if(!result.predictionsMatch) throw new Error('frozen prediction mismatch');
const output=JSON.stringify(result,null,2)+'\n';
if(process.argv[2]) fs.writeFileSync(process.argv[2],output);
process.stdout.write(output);
