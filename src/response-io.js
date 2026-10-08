// Shared by native Node clients and browser companion modules.
export async function readResponseText(response,maxBytes=262144){
  const tooLarge=()=>Object.assign(new Error('Response exceeded the safety limit'),{status:502,code:'RESPONSE_TOO_LARGE'});
  const declared=response.headers?.get?.('content-length');
  if(declared&&Number(declared)>maxBytes){await response.body?.cancel?.();throw tooLarge();}
  if(!response.body?.getReader){
    const value=await response.text();
    if(new TextEncoder().encode(value).byteLength>maxBytes)throw tooLarge();
    return value;
  }
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  const chunks=[];
  let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();throw tooLarge();}
      chunks.push(decoder.decode(value,{stream:true}));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  }finally{reader.releaseLock();}
}
