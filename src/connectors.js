import crypto from 'node:crypto';

const MAX_ITEMS=5000;
const NAME=/^[a-z0-9][a-z0-9._-]{0,63}$/;

function text(value,max=500){
  const out=String(value??'').trim();
  return out.length>max?out.slice(0,max):out;
}
function uniq(values=[]){ return [...new Set(values.map(v=>text(v,160)).filter(Boolean))].sort(); }
function safeName(value,label){
  const name=text(value,64).toLowerCase();
  if(!NAME.test(name)) throw new Error(`${label} must use lowercase letters, numbers, dots, underscores, or hyphens`);
  return name;
}
function sourceId(item,index){
  const id=item?.id??item?.sourceId??item?.resourceName??item?.name??null;
  if(id==null||String(id).trim()==='') throw new Error(`Connector item ${index} is missing a stable source id`);
  return String(id);
}
function stablePath(provider,collection,id){
  const digest=crypto.createHash('sha256').update(`${provider}\0${collection}\0${id}`).digest('hex').slice(0,32);
  return `connector.${provider}.${collection}.${digest}`;
}
function envelope({provider,collection,id,label,category,tags,value,domain=null,kind='context'}){
  return {
    kind,
    path:stablePath(provider,collection,id),
    label:text(label||`${provider} ${collection}`,500),
    category:text(category||collection,160)||'general',
    tags:uniq([provider,collection,...(tags??[])]),
    value:structuredClone(value),
    domain:domain==null?null:structuredClone(domain),
    source:{provider,collection,sourceId:String(id)}
  };
}

function normalizeGmail(item,index,provider,collection){
  const id=sourceId(item,index);
  const subject=text(item.subject||item.payload?.headers?.find?.(h=>String(h.name).toLowerCase()==='subject')?.value||'Email',500);
  const from=text(item.from||item.payload?.headers?.find?.(h=>String(h.name).toLowerCase()==='from')?.value||'',500);
  return envelope({provider,collection,id,label:subject,category:'email',tags:['message',...(item.labelIds??item.labels??[])],value:{
    id,
    threadId:item.threadId??null,
    subject,
    from:from||null,
    to:item.to??null,
    date:item.date??item.internalDate??null,
    snippet:item.snippet??null,
    body:item.body??item.text??null,
    labels:item.labelIds??item.labels??[]
  }});
}

function normalizeCalendar(item,index,provider,collection){
  const id=sourceId(item,index);
  const summary=text(item.summary||item.title||'Calendar event',500);
  return envelope({provider,collection,id,label:summary,category:'calendar',tags:['event',...(item.tags??[])],value:{
    id,
    summary,
    description:item.description??null,
    location:item.location??null,
    start:item.start??null,
    end:item.end??null,
    attendees:item.attendees??[],
    organizer:item.organizer??null,
    recurrence:item.recurrence??null,
    status:item.status??null
  }});
}

function normalizeDrive(item,index,provider,collection){
  const id=sourceId(item,index);
  const name=text(item.name||item.title||'File',500);
  return envelope({provider,collection,id,label:name,category:'files',tags:['file',item.mimeType??item.type??'',...(item.tags??[])],value:{
    id,
    name,
    mimeType:item.mimeType??item.type??null,
    modifiedTime:item.modifiedTime??item.updatedAt??null,
    owners:item.owners??[],
    webViewLink:item.webViewLink??null,
    text:item.text??item.content??null,
    metadata:item.metadata??null
  }});
}

function normalizeContact(item,index,provider,collection){
  const id=sourceId(item,index);
  const displayName=text(item.displayName||item.name||item.names?.[0]?.displayName||'Contact',500);
  return envelope({provider,collection,id,label:displayName,category:'contacts',tags:['contact',...(item.tags??[])],value:{
    id,
    displayName,
    emails:item.emails??item.emailAddresses??[],
    phones:item.phones??item.phoneNumbers??[],
    organizations:item.organizations??[],
    addresses:item.addresses??[],
    birthdays:item.birthdays??[]
  }});
}

function normalizeGithub(item,index,provider,collection){
  const id=sourceId(item,index);
  const label=text(item.full_name||item.name||item.login||item.title||'GitHub item',500);
  return envelope({provider,collection,id,label,category:'github',tags:['github',collection,item.private?'private':'public',...(item.topics??item.tags??[])],value:structuredClone(item)});
}

function normalizeGeneric(item,index,provider,collection){
  const id=sourceId(item,index);
  if(!Object.hasOwn(item,'value')) throw new Error(`Generic connector item ${index} is missing value`);
  return envelope({provider,collection,id,label:item.label??id,category:item.category??collection,tags:item.tags??[],value:item.value,domain:item.domain??null});
}

const NORMALIZERS=Object.freeze({
  gmail:normalizeGmail,
  calendar:normalizeCalendar,
  drive:normalizeDrive,
  contacts:normalizeContact,
  github:normalizeGithub,
  generic:normalizeGeneric
});

export function supportedConnectorProviders(){ return Object.keys(NORMALIZERS); }

export function normalizeConnectorSnapshot(snapshot={}){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)) throw new Error('Connector snapshot must be an object');
  const provider=safeName(snapshot.provider,'provider');
  const collection=safeName(snapshot.collection??({gmail:'messages',calendar:'events',drive:'files',contacts:'people',github:'resources'}[provider]??'items'),'collection');
  const normalize=NORMALIZERS[provider];
  if(!normalize) throw new Error(`Unsupported connector provider: ${provider}`);
  if(!Array.isArray(snapshot.items)) throw new Error('Connector snapshot items must be an array');
  if(snapshot.items.length>MAX_ITEMS) throw new Error(`Connector snapshots support at most ${MAX_ITEMS} items per import`);
  const records=snapshot.items.map((item,index)=>normalize(item,index,provider,collection));
  const ids=new Set();
  for(const record of records){
    if(ids.has(record.source.sourceId)) throw new Error('Connector snapshot contains duplicate source ids');
    ids.add(record.source.sourceId);
  }
  return {provider,collection,replace:snapshot.replace!==false,records};
}

export function connectorSummary(records=[]){
  const map=new Map();
  for(const record of records){
    const source=record?.source;
    if(!source?.provider||!source?.collection) continue;
    const key=`${source.provider}\0${source.collection}`;
    const row=map.get(key)??{provider:String(source.provider),collection:String(source.collection),items:0};
    row.items+=1;
    map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>a.provider.localeCompare(b.provider)||a.collection.localeCompare(b.collection));
}
