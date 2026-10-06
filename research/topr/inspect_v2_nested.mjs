import fs from 'node:fs';
const [,,p='/tmp/topr-v2.json',n='/tmp/topr-v2-neg.json']=process.argv;
const load=x=>JSON.parse(fs.readFileSync(x,'utf8'));
const arr=x=>Array.isArray(x)?x:Object.values(x??{});
function type(v){if(Array.isArray(v))return `array(${v.length})`;if(v===null)return'null';return typeof v;}
function shape(o){return Object.fromEntries(Object.entries(o??{}).map(([k,v])=>[k,type(v)]));}
function inspect(rows){
 const r=arr(rows)[0]??{}; const tools=arr(r.available_tools);
 return {recordShape:shape(r),metadataShape:shape(r.metadata),evaluationShape:shape(r.evaluation_benchmarks),goal:r.user_goal,firstTool:tools[0]?{shape:shape(tools[0]),tool_id:tools[0].tool_id,tool_name:tools[0].tool_name,tool_description:tools[0].tool_description,noise_tool:tools[0].noise_tool,parameters:tools[0].parameters,return_data:tools[0].return_data}:null,evaluation_benchmarks:r.evaluation_benchmarks,metadata:r.metadata};
}
const out={positive:inspect(load(p)),negative:inspect(load(n))};
console.log(JSON.stringify(out,null,2));fs.mkdirSync('research/topr/out',{recursive:true});fs.writeFileSync('research/topr/out/v2-nested-inspect.json',JSON.stringify(out,null,2)+'\n');
