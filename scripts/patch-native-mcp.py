from pathlib import Path
import json

p=Path('src/server.js')
s=p.read_text()

anchor="import { ContextKernel } from './context-kernel.js';\n"
addition="import { NATIVE_MCP_TOOLS, callNativeMcpTool, isNativeMcpTool } from './native-mcp.js';\n"
if addition not in s:
    assert anchor in s
    s=s.replace(anchor,anchor+addition,1)

old="  if(!mcpUpstream) return sendRpc(res,jsonRpcError(null,-32050,'Supakeep MCP upstream is not configured.'));\n\n"
if old in s:
    s=s.replace(old,'',1)

old="""  if(req.method==='GET'||req.method==='DELETE'){
    const upstream=await fetchMcpUpstream(req,u,null);
    return pipeMcpResponse(res,upstream);
  }
"""
new="""  if(req.method==='GET'||req.method==='DELETE'){
    if(!mcpUpstream){res.writeHead(405,{'allow':'POST'});res.end();return;}
    const upstream=await fetchMcpUpstream(req,u,null);
    return pipeMcpResponse(res,upstream);
  }
"""
assert old in s
s=s.replace(old,new,1)

anchor="""  const agent=String(req.headers['x-supakeep-agent']||'unknown-agent');
  const purpose=String(req.headers['x-supakeep-purpose']||'unspecified');

"""
block="""  const envelope=rpc.params?._meta??{};
  const clientInfo=envelope['io.modelcontextprotocol/clientInfo'];
  const agent=String(req.headers['x-supakeep-agent']||clientInfo?.name||'unknown-agent');
  const purpose=String(req.headers['x-supakeep-purpose']||'unspecified');
  const requestedVersion=String(req.headers['mcp-protocol-version']||envelope['io.modelcontextprotocol/protocolVersion']||'');
  const modern=requestedVersion==='2026-07-28'||rpc.method==='server/discover';
  const serverMeta={'io.modelcontextprotocol/serverInfo':{name:'supakeep',version:'0.6.0'}};
  const complete=result=>modern?{...result,resultType:'complete',_meta:{...(result?._meta??{}),...serverMeta}}:result;
  const rpcResult=result=>sendRpc(res,{jsonrpc:'2.0',id:rpc.id,result:complete(result)});

  if(rpc.method==='server/discover') return rpcResult({supportedVersions:['2026-07-28','2025-11-25'],capabilities:{tools:{listChanged:false}},instructions:'Supakeep provides bounded private computation. Private values are not exposed as MCP tools.'});
  if(rpc.method==='initialize'&&!mcpUpstream) return sendRpc(res,{jsonrpc:'2.0',id:rpc.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'supakeep',version:'0.6.0'},instructions:'Supakeep provides bounded private computation. Private values are not exposed as MCP tools.'}});
  if(rpc.method==='notifications/initialized'){res.writeHead(204);res.end();return;}
  if(rpc.method==='ping') return rpcResult({});
  if(rpc.method==='tools/list'&&!mcpUpstream) return rpcResult({tools:NATIVE_MCP_TOOLS});

  if(rpc.method==='tools/call'&&isNativeMcpTool(rpc.params?.name)){
    const result=callNativeMcpTool({name:rpc.params.name,args:rpc.params.arguments??{},kernel:contextKernel,agent,sink:`mcp:${agent}`});
    return rpcResult(result);
  }
  if(rpc.method==='tools/call'&&!mcpUpstream) return sendRpc(res,jsonRpcError(rpc.id,-32602,'Unknown tool.'));

"""
assert anchor in s
s=s.replace(anchor,block,1)

old="""  if(rpc.method==='tools/list'&&upstream.ok){
    const contentType=upstream.headers.get('content-type')||'';
    if(contentType.includes('json')){
      const text=await upstream.text();
      try{mcpCatalog.ingestListResult(JSON.parse(text));}catch{}
      res.writeHead(upstream.status,responseHeaders(upstream.headers));res.end(text);return;
    }
  }
"""
new="""  if(rpc.method==='tools/list'&&upstream.ok){
    const contentType=upstream.headers.get('content-type')||'';
    if(contentType.includes('json')){
      const text=await upstream.text();
      try{
        const payload=JSON.parse(text);
        mcpCatalog.ingestListResult(payload);
        if(payload?.result&&Array.isArray(payload.result.tools)) payload.result.tools=[...NATIVE_MCP_TOOLS,...payload.result.tools.filter(tool=>!isNativeMcpTool(tool?.name))];
        res.writeHead(upstream.status,responseHeaders(upstream.headers));res.end(JSON.stringify(payload));return;
      }catch{}
      res.writeHead(upstream.status,responseHeaders(upstream.headers));res.end(text);return;
    }
  }
"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

pkg=Path('package.json')
data=json.loads(pkg.read_text())
data['version']='0.6.0'
data['scripts']['check']='node --check src/server.js && node --check src/context-kernel.js && node --check src/secure-context.js && node --check src/reconstruction-firewall.js && node --check src/native-mcp.js && node --test && npm run bench'
pkg.write_text(json.dumps(data,separators=(',',':'))+'\n')
