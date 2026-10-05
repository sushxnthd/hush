const PRIVATE_PROGRAM_SCHEMA={
  type:'object',
  description:'A bounded Private Decision Program evaluated locally over user-controlled context.',
  oneOf:[
    {
      type:'object',
      properties:{kind:{const:'predicate'},private:{type:'string'},op:{enum:['eq','neq','lt','lte','gt','gte','in','notIn']},value:{}},
      required:['kind','private','op','value'],additionalProperties:false
    },
    {
      type:'object',
      properties:{kind:{const:'bucket'},private:{type:'string'},thresholds:{type:'array',items:{type:'number'},minItems:1,maxItems:63}},
      required:['kind','private','thresholds'],additionalProperties:false
    },
    {
      type:'object',
      properties:{
        kind:{const:'choose'},
        candidates:{type:'array',items:{type:'object'},minItems:1,maxItems:100},
        constraints:{type:'array',items:{type:'object'}},
        preferences:{type:'array',items:{type:'object'}}
      },
      required:['kind','candidates'],additionalProperties:false
    }
  ]
};

export const NATIVE_MCP_TOOLS=Object.freeze([
  {
    name:'hush_begin_private_task',
    description:'Start a short-lived private-computation task. Returns an opaque trajectory handle. The handle carries a per-task disclosure budget and is also subject to persistent cross-task reconstruction limits.',
    inputSchema:{
      type:'object',
      properties:{
        purpose:{type:'string',maxLength:240},
        maxBits:{type:'number',minimum:0,maximum:16,default:4},
        sinkMaxBits:{type:'number',minimum:0,maximum:16},
        ttlMs:{type:'integer',minimum:1000,maximum:86400000}
      },
      additionalProperties:false
    },
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },
  {
    name:'hush_private_decision',
    description:'Evaluate a bounded decision over private user context without returning the private values. Use the trajectory handle from hush_begin_private_task. The result may be denied when cumulative disclosure could enable reconstruction.',
    inputSchema:{
      type:'object',
      properties:{trajectoryId:{type:'string'},program:PRIVATE_PROGRAM_SCHEMA},
      required:['trajectoryId','program'],additionalProperties:false
    },
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },
  {
    name:'hush_revoke_private_task',
    description:'Revoke a private-computation trajectory so it cannot be used again.',
    inputSchema:{type:'object',properties:{trajectoryId:{type:'string'}},required:['trajectoryId'],additionalProperties:false},
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}
  }
]);

export const isNativeMcpTool=name=>NATIVE_MCP_TOOLS.some(tool=>tool.name===String(name));

function toolResult(structuredContent,{isError=false}={}){
  return {
    content:[{type:'text',text:JSON.stringify(structuredContent)}],
    structuredContent,
    ...(isError?{isError:true}:{})
  };
}

function finiteBits(value,fallback){
  const n=Number(value??fallback);
  if(!Number.isFinite(n)||n<0||n>16) throw new Error('Bit budget must be between 0 and 16');
  return n;
}

/**
 * Execute only Hush-native MCP tools. Private values never appear in these
 * responses; the decision runtime returns bounded outputs plus capacity receipts.
 * Agent identity is audit metadata only and is never used as the security boundary.
 */
export function callNativeMcpTool({name,args={},kernel,agent='unknown-agent',sink='mcp-client'}={}){
  if(!kernel) return toolResult({decision:'deny',reason:'Private context is locked on this device.'},{isError:true});
  const tool=String(name||'');
  try{
    if(tool==='hush_begin_private_task'){
      const maxBits=finiteBits(args.maxBits,4);
      const sinkMaxBits=finiteBits(args.sinkMaxBits,maxBits);
      const trajectory=kernel.beginTrajectory({purpose:String(args.purpose??'agent task'),maxBits,sinkMaxBits,ttlMs:args.ttlMs});
      return toolResult({decision:'allow',trajectory});
    }
    if(tool==='hush_private_decision'){
      if(!args.trajectoryId||!args.program) throw new Error('trajectoryId and program are required');
      const result=kernel.run({trajectoryId:String(args.trajectoryId),agent:String(agent),sink:String(sink),program:args.program});
      return toolResult(result,{isError:result.decision!=='allow'});
    }
    if(tool==='hush_revoke_private_task'){
      if(!args.trajectoryId) throw new Error('trajectoryId is required');
      const revoked=kernel.revokeTrajectory(String(args.trajectoryId));
      return toolResult({decision:revoked?'allow':'deny',revoked},{isError:!revoked});
    }
    return toolResult({decision:'deny',reason:'Unknown Hush tool.'},{isError:true});
  }catch(error){
    return toolResult({decision:'deny',reason:error?.message||'Private-context tool failed.'},{isError:true});
  }
}
