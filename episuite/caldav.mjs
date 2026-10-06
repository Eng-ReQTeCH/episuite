import ICAL from 'ical.js';
import {XMLParser} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
import {blockInput, dateKey, zonedTimestamp, calendarText, schedule,assignBlockColor} from './public/domain.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const fingerprint = b => hash(JSON.stringify([b.name,b.date,b.start,b.duration,b.location,b.description,b.reminderMinutes,b.color]));
const list = value => value ? Array.isArray(value) ? value : [value] : [];
const error = message => Object.assign(new Error(message),{status:400});
export async function syncCalDAV(snapshot, dates, remove = false) {
  const config=snapshot.calendar, base=new URL(config.url.replace(/\/+$/,'')+'/');
  const headers={Authorization:`Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`};
  const request=async(url,method,body,extra={})=>fetch(url,{method,body,headers:{...headers,...extra},redirect:'error',signal:AbortSignal.timeout(15000)});
  const report=await request(base,'REPORT','<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>',{'Content-Type':'application/xml; charset=utf-8',Depth:'1'});
  if(report.status!==207)throw error(`Calendar discovery failed (${report.status}). Use the calendar collection URL, not the server homepage.`);
  const xml=new XMLParser({removeNSPrefix:true,parseTagValue:false}).parse(await report.text());
  const remote=new Map();
  for(const item of list(xml.multistatus?.response)) {
    const url=new URL(item.href,base);
    if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search||url.hash)throw error('Calendar returned an event outside its collection.');
    const prop=list(item.propstat).find(p=>/ 200 /.test(p.status||''))?.prop;
    if(!prop?.['calendar-data']){if(list(item.propstat).some(p=>/ (401|403|500|503) /.test(p.status||'')))throw error('Calendar discovery denied access to an event. No changes were made.');continue;}
    if(!prop.getetag)throw error('Calendar did not provide an event ETag. Conditional sync requires ETags.');
    try {
      const component=new ICAL.Component(ICAL.parse(prop['calendar-data']));
      for(const tz of component.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(new ICAL.Timezone(tz));
      for(const event of component.getAllSubcomponents('vevent'))for(const name of ['dtstart','dtend']){const tzid=event.getFirstProperty(name)?.getParameter('tzid');if(tzid&&!ICAL.TimezoneService.has(tzid)){new Intl.DateTimeFormat('en',{timeZone:tzid});ICAL.TimezoneService.register(tzid,new ICAL.Timezone({tzid}));}}
      remote.set(url.href,{etag:prop.getetag,raw:prop['calendar-data'],component});
    }
    catch {throw error('The calendar returned an unreadable event. Sync stopped before making changes.');}
  }
  const records=structuredClone(config.syncRecords||{}), eventUrls={...config.eventUrls}, blocks=structuredClone(snapshot.blocks), conflicts=[];
  let uploaded=0, imported=0, deleted=0;const seenImports=new Set();
  const desired=new Map(dates.flatMap(day=>schedule(snapshot,day).filter(b=>b.startMinute!==null&&!b.caldav).map(b=>[b.id+':'+day,{...b,date:day}])));
  const write=async(url,raw,etag)=>{
    const r=await request(url,'PUT',raw,{'Content-Type':'text/calendar; charset=utf-8',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})});
    if(r.status===412){conflicts.push(url);return null;}
    if(!r.ok)throw error(`Calendar rejected an update (${r.status}). Earlier successful changes will be rediscovered on the next sync.`);
    return r.headers.get('etag')||'';
  };
  // Rediscover our UIDs after an interrupted sync or when a server renamed the resource.
  for(const [key,b] of desired)if(!eventUrls[key]){const uid=`${b.id}-${b.date}@episuite`;const matches=[...remote].filter(([,r])=>r.component.getAllSubcomponents('vevent').some(c=>c.getFirstPropertyValue('uid')===uid));if(matches.length===1)eventUrls[key]=matches[0][0];}
  for(const [id,old] of Object.entries(records))if(old.url&&dates.includes(old.date)&&!blocks.some(b=>b.id===id)){
    const r=remote.get(old.url);if(r){if(old.readOnly||old.etag!==r.etag){conflicts.push(old.url);continue;}const response=await request(old.url,'DELETE',undefined,{'If-Match':r.etag});if(response.status===412){conflicts.push(old.url);continue;}if(!response.ok&&response.status!==404)throw error(`Calendar rejected removal (${response.status}).`);remote.delete(old.url);deleted++;}delete records[id];
  }
  for(const [key,url] of Object.entries(eventUrls)) {
    if(!dates.includes(key.slice(key.lastIndexOf(':')+1)))continue;
    if(new URL(url).origin!==base.origin||!new URL(url).pathname.startsWith(base.pathname))throw error('Reconnect the original calendar before syncing its events.');
    const r=remote.get(url), old=records[key], local=desired.get(key);
    if(remove||!local){
      if(r&&old&&r.etag!==old.etag){conflicts.push(url);continue;}
      if(r){const response=await request(url,'DELETE',undefined,r.etag?{'If-Match':r.etag}:{});if(response.status===412){conflicts.push(url);continue;}if(!response.ok&&response.status!==404)throw error(`Calendar rejected removal (${response.status}).`);deleted++;}
      delete eventUrls[key];delete records[key];remote.delete(url);continue;
    }
    if(old&&r&&r.etag!==old.etag) {
      if(fingerprint(local)!==old.fingerprint){conflicts.push(url);remote.delete(url);desired.delete(key);continue;}
      // Import a remote edit into its original local block rather than creating a duplicate.
      const event=new ICAL.Event(r.component.getFirstSubcomponent('vevent'));
      const parsed=eventBlock(event,event.startDate,event.endDate,snapshot.settings.timezone,key);
      const target=blocks.find(b=>b.id===local.id);
      if(target.repeat!=='none'){conflicts.push(url);remote.delete(url);desired.delete(key);continue;}
      Object.assign(target,parsed,{id:target.id,caldav:undefined,personIds:target.personIds,taskIds:target.taskIds});imported++;
      const nextKey=target.id+':'+target.date;
      if(nextKey!==key){delete records[key];delete eventUrls[key];eventUrls[nextKey]=url;}
      records[nextKey]={etag:r.etag,fingerprint:fingerprint(target)};remote.delete(url);desired.delete(key);continue;
    }
    if(old&&!r){if(fingerprint(local)!==old.fingerprint){conflicts.push(url);desired.delete(key);continue;}const target=blocks.find(b=>b.id===local.id);if(target.repeat==='none')blocks.splice(blocks.indexOf(target),1);else target.excludedDates=[...new Set([...target.excludedDates,local.date])];delete eventUrls[key];delete records[key];desired.delete(key);continue;}
    if(r&&old&&fingerprint(local)===old.fingerprint){remote.delete(url);desired.delete(key);}
  }
  if(!remove)for(const [key,b] of desired){
    const url=eventUrls[key]||new URL(encodeURIComponent(b.id+'-'+b.date)+'.ics',base).href;
    const r=remote.get(url);
    const etag=await write(url,calendarText({...snapshot,blocks:[b]},b.date),r?.etag);
    if(etag===null){remote.delete(url);continue;}
    eventUrls[key]=url;records[key]={etag,fingerprint:fingerprint(b)};uploaded++;remote.delete(url);
  }
  if(!remove)for(const [url,r] of remote){
    const events=r.component.getAllSubcomponents('vevent');
    for(const component of events.filter(c=>!c.hasProperty('recurrence-id'))){
      const event=new ICAL.Event(component,{exceptions:events.filter(c=>c.hasProperty('recurrence-id'))});
      const recurring=event.isRecurring();
      const iterator=event.iterator();let iterations=0;
      while(iterations++<20000){const start=recurring?iterator.next():event.startDate;if(!start)break;
        const occurrence=event.getOccurrenceDetails(start), day=localDate(occurrence.startDate,snapshot.settings.timezone);
        if(day>dates.at(-1))break;
        if(dates.includes(day)){
          const id='caldav-'+hash(url+'|'+event.uid+'|'+start.toString()).slice(0,24);
          seenImports.add(id);
          const parsed=eventBlock(occurrence.item,occurrence.startDate,occurrence.endDate,snapshot.settings.timezone,id);
          const existing=blocks.find(b=>b.id===id), baseline=records[id];
          if(!parsed.color)parsed.color=existing?.color||'';
          if(existing){parsed.personIds=existing.personIds;parsed.taskIds=existing.taskIds;}
          assignBlockColor(parsed,blocks);
          if(existing&&baseline&&fingerprint(existing)!==baseline.fingerprint){
            if(recurring||baseline.etag!==r.etag){conflicts.push(url);if(!recurring)break;continue;}
            const edited=r.component.getFirstSubcomponent('vevent');
            for(const [name,value] of [['summary',existing.name],['location',existing.location],['description',existing.description]])edited.updatePropertyWithValue(name,value);
            const time=ICAL.Time.fromJSDate(new Date(zonedTimestamp(existing.date,Number(existing.start.slice(0,2))*60+Number(existing.start.slice(3)),snapshot.settings.timezone)),true);
            edited.updatePropertyWithValue('dtstart',time);edited.updatePropertyWithValue('dtend',ICAL.Time.fromJSDate(new Date(time.toUnixTime()*1000+existing.duration*60000),true));
            edited.removeAllSubcomponents('valarm');
            if(existing.reminderMinutes!==null){const alarm=new ICAL.Component('valarm');alarm.addPropertyWithValue('action','DISPLAY');alarm.addPropertyWithValue('description',existing.name);alarm.addPropertyWithValue('trigger',ICAL.Duration.fromSeconds(-existing.reminderMinutes*60));edited.addSubcomponent(alarm);}
            if(existing.color)edited.updatePropertyWithValue('color',existing.color);
            const etag=await write(url,r.component.toString(),r.etag);if(etag!==null){records[id]={...baseline,etag,fingerprint:fingerprint(existing)};uploaded++;}if(!recurring)break;continue;
          }
          parsed.caldav={url,recurring,readOnly:recurring||occurrence.startDate.isDate||(timestamp(occurrence.endDate,snapshot.settings.timezone)-timestamp(occurrence.startDate,snapshot.settings.timezone)>480*60000)};
          if(existing)Object.assign(existing,parsed);else blocks.push(parsed);
          records[id]={etag:r.etag,fingerprint:fingerprint(parsed),url,date:parsed.date,readOnly:parsed.caldav.readOnly};imported++;
        }
        if(!recurring)break;
      }
      if(iterations>=20000)throw error('A calendar recurrence exceeded the safe expansion limit.');
    }
  }
  // Remote-only events removed from the collection disappear from the local calendar.
  if(!remove)for(let i=blocks.length-1;i>=0;i--)if(blocks[i].caldav&&dates.includes(blocks[i].date)&&!seenImports.has(blocks[i].id)){
    const b=blocks[i],old=records[b.id];if(old&&fingerprint(b)!==old.fingerprint){conflicts.push(b.caldav.url);continue;}
    delete records[b.id];blocks.splice(i,1);
  }
  return {blocks,calendar:{...config,eventUrls,syncRecords:records},count:remove?deleted:dates.reduce((n,day)=>n+schedule({...snapshot,blocks},day).filter(b=>!b.caldav&&b.startMinute!==null).length,0),uploaded,imported,deleted,conflicts:[...new Set(conflicts)]};
}
function timestamp(time,zone){if(time.zone?.tzid==='UTC'||time.zone?.component)return time.toUnixTime()*1000;const day=time.toString().slice(0,10);return zonedTimestamp(day,time.hour*60+time.minute,time.zone?.tzid&&time.zone.tzid!=='floating'?time.zone.tzid:zone);}
function localDate(time,zone){return time.isDate?time.toString().slice(0,10):dateKey(timestamp(time,zone),zone);}
function eventBlock(event,start,end,zone,id){
  const ms=timestamp(start,zone), parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms));
  const alarm=event.component.getFirstSubcomponent('valarm')?.getFirstPropertyValue('trigger');
  const color=event.component.getFirstPropertyValue('color')||'';
  return blockInput({name:event.summary||'Calendar event',date:localDate(start,zone),start:start.isDate?'00:00':parts,duration:start.isDate?480:Math.max(5,(timestamp(end,zone)-ms)/60000),commitment:true,color:/^#[0-9a-f]{6}$/i.test(color)?color:'',location:event.component.getFirstPropertyValue('location')||'',description:event.component.getFirstPropertyValue('description')||'',reminderMinutes:alarm?.toSeconds&&alarm.toSeconds()<=0?Math.min(10080,Math.round(-alarm.toSeconds()/60)):null},{id});
}
