const DEFAULT_LIMIT=50;
const MAX_LIMIT=100;

function boundedLimit(value=DEFAULT_LIMIT){
  const n=Math.floor(Number(value));
  if(!Number.isFinite(n)||n<1) throw new Error('Connector limit must be a positive integer');
  return Math.min(n,MAX_LIMIT);
}
function token(value){
  const out=String(value??'').trim();
  if(!out) throw new Error('Connector access token is required');
  return out;
}
function fetcher(value){
  if(typeof value!=='function') throw new Error('A fetch implementation is required');
  return value;
}
async function authorizedJson(fetchImpl,url,accessToken,{github=false}={}){
  const response=await fetchImpl(url,{
    method:'GET',
    headers:{
      authorization:`Bearer ${accessToken}`,
      accept:github?'application/vnd.github+json':'application/json',
      ...(github?{'x-github-api-version':'2022-11-28','user-agent':'hush-local-connector'}:{})
    },
    redirect:'error'
  });
  if(!response?.ok){
    const status=Number(response?.status||0);
    throw new Error(`Connector request failed${status?` (${status})`:''}`);
  }
  return response.json();
}
function header(message,name){
  const headers=message?.payload?.headers;
  if(!Array.isArray(headers)) return null;
  return headers.find(item=>String(item?.name||'').toLowerCase()===String(name).toLowerCase())?.value??null;
}

async function gmail({fetchImpl,accessToken,limit}){
  const listUrl=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('maxResults',String(limit));
  listUrl.searchParams.set('includeSpamTrash','false');
  const listed=await authorizedJson(fetchImpl,listUrl,accessToken);
  const refs=Array.isArray(listed?.messages)?listed.messages.slice(0,limit):[];
  const items=[];
  for(const ref of refs){
    if(!ref?.id) continue;
    const url=new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}`);
    url.searchParams.set('format','metadata');
    for(const name of ['Subject','From','To','Date']) url.searchParams.append('metadataHeaders',name);
    const message=await authorizedJson(fetchImpl,url,accessToken);
    items.push({
      id:String(message.id),threadId:message.threadId??null,subject:header(message,'Subject')??'Email',from:header(message,'From'),to:header(message,'To'),date:header(message,'Date')??message.internalDate??null,
      snippet:message.snippet??null,labelIds:Array.isArray(message.labelIds)?message.labelIds:[]
    });
  }
  return {provider:'gmail',collection:'messages',items,replace:true};
}

async function calendar({fetchImpl,accessToken,limit,options}){
  const url=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('maxResults',String(limit));
  url.searchParams.set('singleEvents','true');
  url.searchParams.set('orderBy','startTime');
  url.searchParams.set('timeMin',String(options?.timeMin??new Date().toISOString()));
  if(options?.timeMax) url.searchParams.set('timeMax',String(options.timeMax));
  const payload=await authorizedJson(fetchImpl,url,accessToken);
  return {provider:'calendar',collection:'events',items:(payload?.items??[]).slice(0,limit),replace:true};
}

async function drive({fetchImpl,accessToken,limit}){
  const url=new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('pageSize',String(limit));
  url.searchParams.set('q','trashed = false');
  url.searchParams.set('orderBy','modifiedTime desc');
  url.searchParams.set('fields','files(id,name,mimeType,modifiedTime,owners(displayName,emailAddress),webViewLink,description)');
  const payload=await authorizedJson(fetchImpl,url,accessToken);
  return {provider:'drive',collection:'files',items:(payload?.files??[]).slice(0,limit),replace:true};
}

async function contacts({fetchImpl,accessToken,limit}){
  const url=new URL('https://people.googleapis.com/v1/people/me/connections');
  url.searchParams.set('pageSize',String(limit));
  url.searchParams.set('personFields','names,emailAddresses,phoneNumbers,organizations,addresses,birthdays');
  const payload=await authorizedJson(fetchImpl,url,accessToken);
  const items=(payload?.connections??[]).slice(0,limit).map(person=>({
    ...person,
    id:person.resourceName,
    displayName:person.names?.[0]?.displayName??'Contact',
    emails:person.emailAddresses??[],
    phones:person.phoneNumbers??[]
  }));
  return {provider:'contacts',collection:'people',items,replace:true};
}

async function github({fetchImpl,accessToken,limit,options}){
  const collection=String(options?.collection??'repos');
  if(collection!=='repos') throw new Error('GitHub connector currently supports the repos collection');
  const url=new URL('https://api.github.com/user/repos');
  url.searchParams.set('per_page',String(limit));
  url.searchParams.set('sort','updated');
  url.searchParams.set('direction','desc');
  url.searchParams.set('affiliation','owner,collaborator,organization_member');
  const payload=await authorizedJson(fetchImpl,url,accessToken,{github:true});
  if(!Array.isArray(payload)) throw new Error('GitHub connector returned an invalid repository list');
  return {provider:'github',collection:'repos',items:payload.slice(0,limit),replace:true};
}

const CLIENTS=Object.freeze({gmail,calendar,drive,contacts,github});

export function liveConnectorProviders(){ return Object.keys(CLIENTS); }

/**
 * Fetch one bounded provider snapshot. Access tokens are used only in outbound
 * Authorization headers and are never included in the returned snapshot.
 */
export async function fetchConnectorSnapshot({provider,accessToken,limit=DEFAULT_LIMIT,options={},fetchImpl=globalThis.fetch}={}){
  const name=String(provider??'').trim().toLowerCase();
  const client=CLIENTS[name];
  if(!client) throw new Error(`Unsupported live connector provider: ${name||'(empty)'}`);
  return client({fetchImpl:fetcher(fetchImpl),accessToken:token(accessToken),limit:boundedLimit(limit),options:structuredClone(options??{})});
}

/**
 * Fetch and immediately seal a provider snapshot into a ContextKernel. The return
 * value is aggregate sync metadata only; neither the access token nor provider
 * payloads are returned to the caller.
 */
export async function syncConnectorToKernel({kernel,...input}={}){
  if(!kernel||typeof kernel.ingestConnectorSnapshot!=='function') throw new Error('An unlocked ContextKernel is required');
  const snapshot=await fetchConnectorSnapshot(input);
  return kernel.ingestConnectorSnapshot(snapshot);
}
