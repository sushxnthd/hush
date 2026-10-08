// Same-device owner API. The server's LocalClientAuth gates this control surface
// before dispatch; MCP bearer credentials cannot authorize owner API calls.
import {readJsonObject} from './http-io.js';
const body=req=>readJsonObject(req,{maxBytes:65536});
const text=(v,label,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} is required (maximum ${max} characters).`);return v.trim();};
export async function handleOwnerContextRequest({req,res,u,kernel,send,audit}){
  const prefix='/api/context/owner';if(!u.pathname.startsWith(prefix+'/'))return false;
  try{
    if(req.method==='GET'&&u.pathname===prefix+'/memory'){send(res,200,{proposals:kernel.memoryProposalQueue({includeValues:true})});return true;}
    if(req.method==='POST'&&u.pathname===prefix+'/memory'){
      const b=await body(req);const proposal=kernel.proposeMemory({agent:'hush-owner',label:text(b.label,'Memory label'),category:text(b.category??'general','Category',80),value:text(b.value,'Memory',20000),tags:['owner']});
      audit('memory_propose',{proposalId:proposal.proposalId});send(res,201,{proposal});return true;
    }
    const m=u.pathname.match(/^\/api\/context\/owner\/memory\/([^/]+)\/(approve|deny)$/);
    if(req.method==='POST'&&m){const id=decodeURIComponent(m[1]);const proposal=m[2]==='approve'?kernel.approveMemoryProposal(id):kernel.denyMemoryProposal(id);audit('memory_'+m[2],{proposalId:id});send(res,200,{proposal});return true;}
    if(req.method==='POST'&&u.pathname===prefix+'/remove'){
      const b=await body(req),path=text(b.path,'Context path',500);const removed=kernel.remove(path);audit('context_remove',{removed});send(res,removed?200:404,{removed});return true;
    }
    send(res,404,{error:'Owner context route not found'});return true;
  }catch(e){send(res,e.status||400,{error:e.message||'Owner context request failed'});return true;}
}
