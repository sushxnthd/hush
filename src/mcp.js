import { detectSensitive, evaluatePolicy, requestHash } from './core.js';

export class McpToolCatalog {
  constructor(){ this.tools=new Map(); }
  ingestListResult(payload){
    const tools=payload?.result?.tools;
    if(!Array.isArray(tools)) return 0;
    for(const tool of tools){
      if(tool?.name) this.tools.set(String(tool.name), structuredClone(tool));
    }
    return tools.length;
  }
  get(name){ return this.tools.get(String(name)); }
  list(){ return [...this.tools.values()]; }
}

export function classifyMcpTool(tool){
  if(!tool) return {known:false,action:'write',category:'general',risk:'unknown',reason:'Tool is not in the observed tools/list catalog.'};
  const a=tool.annotations??{};
  if(a.readOnlyHint===true){
    return {known:true,action:'read',category:'general',risk:a.openWorldHint===false?'low':'medium',reason:'Tool declares read-only behavior.'};
  }
  if(a.destructiveHint===true){
    return {known:true,action:'delete',category:'destructive',risk:'high',reason:'Tool declares destructive behavior.'};
  }
  return {known:true,action:'write',category:a.openWorldHint===true?'communication':'general',risk:'medium',reason:'Tool may modify state.'};
}

export function mcpActionRequest({agent='unknown-agent',purpose='unspecified',params={},tool=null}){
  const name=String(params?.name||'unknown-tool');
  const c=classifyMcpTool(tool);
  return {
    agent:String(agent),
    purpose:String(purpose),
    category:c.category,
    action:c.action,
    resource:`mcp:${name}`,
    tool:name,
    arguments:structuredClone(params?.arguments??{}),
    mcp:{knownTool:c.known,risk:c.risk,annotations:tool?.annotations??null}
  };
}

export function evaluateMcpCall({agent,purpose,params,catalog,policy,preapprovedHash=null,trustAnnotations=false}){
  const tool=catalog?.get(params?.name);
  const request=mcpActionRequest({agent,purpose,params,tool});
  const exactHash=requestHash(request);

  // Hard data-loss prevention runs before any user-approval override.
  const raw=JSON.stringify(params?.arguments??{});
  const secretHits=detectSensitive(raw).filter(x=>x.type!=='email');
  if(secretHits.length){
    return {decision:'deny',hardDeny:true,reason:'Raw secret material detected in MCP tool arguments.',request,requestHash:exactHash,tool,detected:secretHits.map(({value,...x})=>x)};
  }

  // Tool-server annotations are hints, not a security boundary. Only an explicitly
  // trusted upstream may use them to reach an automatic policy decision.
  const policyResult=tool&&trustAnnotations?evaluatePolicy(policy,request):null;
  if(policyResult?.decision==='deny'){
    return {...policyResult,hardDeny:true,request,requestHash:exactHash,tool};
  }

  // Exact human approval can override ASK, never a hard deny.
  if(preapprovedHash && preapprovedHash===exactHash){
    return {decision:'allow',reason:'Exact tool call was approved by the user.',request,requestHash:exactHash,tool};
  }

  if(!tool){
    return {decision:'ask',reason:'Unknown MCP tool. Supakeep fails closed until the user approves the exact call.',request,requestHash:exactHash,tool:null};
  }
  if(!trustAnnotations){
    return {decision:'ask',reason:'MCP tool annotations are untrusted for this upstream. Exact approval is required.',request,requestHash:exactHash,tool};
  }
  return {...policyResult,request,requestHash:exactHash,tool};
}

export function jsonRpcError(id,code,message,data={}){
  return {jsonrpc:'2.0',id:id??null,error:{code,message,data}};
}

export function sanitizeForwardHeaders(headers,{brokeredAuth=null}={}){
  const out={};
  for(const [k,v] of Object.entries(headers??{})){
    const key=k.toLowerCase();
    if(['host','content-length','connection','transfer-encoding','x-supakeep-agent','x-supakeep-purpose'].includes(key)) continue;
    if(key==='authorization'&&brokeredAuth) continue;
    if(key==='authorization'||key==='accept'||key==='content-type'||key==='user-agent'||key.startsWith('mcp-')||key==='last-event-id') out[key]=Array.isArray(v)?v.join(', '):v;
  }
  if(brokeredAuth) out.authorization=brokeredAuth;
  return out;
}
