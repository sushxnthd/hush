const GMAIL_SEND='https://www.googleapis.com/auth/gmail.send';
const CALENDAR_EVENTS='https://www.googleapis.com/auth/calendar.events';
const GMAIL_SEND_URL='https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const CALENDAR_BASE='https://www.googleapis.com/calendar/v3/calendars';

export const GOOGLE_ACTION_SCOPES=Object.freeze({
  send_email:GMAIL_SEND,
  calendar_create:CALENDAR_EVENTS
});

const EMAIL=/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
function text(value,{name,max,required=false}={}){
  const out=String(value??'').trim();
  if(required&&!out) throw new Error(`${name} is required`);
  if(out.length>max) throw new Error(`${name} exceeds ${max} characters`);
  if(/[\r\n]/.test(out)&&name!=='body'&&name!=='description') throw new Error(`${name} contains an invalid newline`);
  return out;
}
function recipients(value){
  const list=(Array.isArray(value)?value:[value]).flatMap(item=>String(item??'').split(',')).map(x=>x.trim()).filter(Boolean);
  if(!list.length) throw new Error('At least one recipient is required');
  if(list.length>25) throw new Error('At most 25 recipients are allowed per Hush email action');
  for(const email of list) if(!EMAIL.test(email)) throw new Error(`Invalid recipient email address: ${email}`);
  return [...new Set(list)];
}
function encodeHeader(value){
  return /^[\x20-\x7E]*$/.test(value)?value:`=?UTF-8?B?${Buffer.from(value,'utf8').toString('base64')}?=`;
}
function encodeRawMail({to,cc=[],bcc=[],subject='',body=''}){
  const lines=[`To: ${to.join(', ')}`];
  if(cc.length) lines.push(`Cc: ${cc.join(', ')}`);
  if(bcc.length) lines.push(`Bcc: ${bcc.join(', ')}`);
  lines.push(`Subject: ${encodeHeader(subject)}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit','',body);
  return Buffer.from(lines.join('\r\n'),'utf8').toString('base64url');
}
async function jsonRequest(fetchImpl,url,{accessToken,body}){
  const response=await fetchImpl(url,{
    method:'POST',
    headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify(body),
    redirect:'error'
  });
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok) throw new Error(payload?.error?.message||payload?.error_description||`Google action failed (${response.status})`);
  return payload;
}

export function normalizeGoogleAction(action,args={}){
  if(action==='send_email'){
    const to=recipients(args.to);
    const cc=args.cc?recipients(args.cc):[];
    const bcc=args.bcc?recipients(args.bcc):[];
    const subject=text(args.subject,{name:'subject',max:998});
    const body=text(args.body,{name:'body',max:100000});
    return {to,cc,bcc,subject,body};
  }
  if(action==='calendar_create'){
    const summary=text(args.summary,{name:'summary',max:500,required:true});
    const description=text(args.description,{name:'description',max:10000});
    const location=text(args.location,{name:'location',max:1000});
    const start=String(args.start??'').trim(),end=String(args.end??'').trim();
    if(!start||!end) throw new Error('start and end are required');
    const startDate=new Date(start),endDate=new Date(end);
    if(Number.isNaN(startDate.valueOf())||Number.isNaN(endDate.valueOf())) throw new Error('start and end must be valid ISO date-times');
    if(endDate<=startDate) throw new Error('Calendar event end must be after start');
    const calendarId=text(args.calendarId??'primary',{name:'calendarId',max:500,required:true});
    const timeZone=args.timeZone?text(args.timeZone,{name:'timeZone',max:100}):undefined;
    return {summary,description,location,start:startDate.toISOString(),end:endDate.toISOString(),calendarId,timeZone};
  }
  throw new Error(`Unsupported Google action: ${action}`);
}

export function registerGoogleActionAdapter({broker,getAccessToken,fetchImpl=globalThis.fetch}={}){
  if(!broker?.registerAdapter) throw new Error('ActionBroker is required');
  if(typeof getAccessToken!=='function') throw new Error('getAccessToken is required');
  if(typeof fetchImpl!=='function') throw new Error('fetch is required');
  return broker.registerAdapter({
    name:'google',actions:Object.keys(GOOGLE_ACTION_SCOPES),description:'Least-privilege Gmail and Calendar actions brokered by Hush',
    execute:async({action,arguments:args})=>{
      const accessToken=await getAccessToken();
      const safe=normalizeGoogleAction(action,args);
      if(action==='send_email'){
        const payload=await jsonRequest(fetchImpl,GMAIL_SEND_URL,{accessToken,body:{raw:encodeRawMail(safe)}});
        return {provider:'google',action,id:payload.id??null,threadId:payload.threadId??null,sent:true};
      }
      if(action==='calendar_create'){
        const {calendarId,timeZone,...event}=safe;
        const body={summary:event.summary,start:{dateTime:event.start},end:{dateTime:event.end}};
        if(event.description) body.description=event.description;
        if(event.location) body.location=event.location;
        if(timeZone){body.start.timeZone=timeZone;body.end.timeZone=timeZone;}
        const url=`${CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events?sendUpdates=none`;
        const payload=await jsonRequest(fetchImpl,url,{accessToken,body});
        return {provider:'google',action,id:payload.id??null,status:payload.status??null,htmlLink:payload.htmlLink??null,created:true};
      }
      throw new Error(`Unsupported Google action: ${action}`);
    }
  });
}
