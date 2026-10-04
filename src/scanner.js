const wordsFromSchema = schema => JSON.stringify(schema??{}).toLowerCase();
const hit=(s,re)=>re.test(s);
const levelFor=score=>score>=75?'critical':score>=55?'high':score>=30?'medium':'low';

export function scanMcpTool(tool,{annotationsTrusted=false}={}){
  const annotations=tool?.annotations??{};
  const schemaText=wordsFromSchema(tool?.inputSchema);
  let score=0;
  const factors=[];
  const add=(points,label)=>{score+=points;factors.push({points,label})};

  if(annotations.destructiveHint===true) add(45,'Tool declares destructive behavior');
  if(annotations.readOnlyHint!==true) add(20,'Tool is not declared read-only');
  if(annotations.openWorldHint===true) add(18,'Tool may interact with the open world');
  if(!annotationsTrusted) add(10,'Tool annotations are not independently trusted');
  if(hit(schemaText,/command|shell|exec|script|powershell|terminal/)) add(30,'Input schema can express command execution');
  if(hit(schemaText,/password|secret|token|credential|api[_-]?key|private[_-]?key/)) add(35,'Input schema references credential-like material');
  if(hit(schemaText,/amount|price|payment|card|purchase|checkout|transfer/)) add(25,'Input schema appears capable of financial actions');
  if(hit(schemaText,/recipient|\"to\"|email|message|post|send/)) add(18,'Input schema appears capable of external communication');
  if(hit(schemaText,/url|uri|endpoint|webhook/)) add(12,'Input schema accepts network destinations');
  if(hit(schemaText,/path|file|folder|repo|repository/)) add(10,'Input schema references files or repositories');

  score=Math.min(100,score);
  return {
    name:String(tool?.name||'unknown-tool'),
    title:tool?.title??null,
    score,
    level:levelFor(score),
    claimed:{readOnly:annotations.readOnlyHint===true,destructive:annotations.destructiveHint===true,openWorld:annotations.openWorldHint===true},
    annotationsTrusted:Boolean(annotationsTrusted),
    factors
  };
}

export function scanMcpCatalog(tools,{annotationsTrusted=false}={}){
  const results=(tools??[]).map(tool=>scanMcpTool(tool,{annotationsTrusted})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  const counts={critical:0,high:0,medium:0,low:0};
  for(const r of results) counts[r.level]++;
  const highRisk=counts.critical+counts.high;
  const exposureScore=results.length?Math.round(results.reduce((s,r)=>s+r.score,0)/results.length):0;
  return {
    version:1,
    disclaimer:'Heuristic exposure scan. This is not a vulnerability scan or proof that a tool is safe or unsafe.',
    tools:results,
    summary:{total:results.length,...counts,highRisk,exposureScore,untrustedAnnotations:annotationsTrusted?0:results.length}
  };
}
