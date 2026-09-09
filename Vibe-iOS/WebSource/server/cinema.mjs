// Anonymous invitation rooms. The read capability is the unguessable room id;
// only a separate, hashed host capability may change playback. No media is fetched here.
const cinemaLimits = new Map();
const cinemaDB = env => { if (!env.DB?.prepare) throw Error('cinema_storage_unavailable'); return env.DB; };
const randomCapability = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function capabilityHash(token) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function cinemaMedia(value) {
 if(typeof value!=='string'||value.length>2048)return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':')||/\.(local|internal)$/.test(u.hostname))return null;
 const host=u.hostname.toLowerCase();let id;
 if(host==='youtu.be')id=u.pathname.slice(1);
 if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)\/?$/)?.[1];
 if(id&&/^[\w-]{11}$/.test(id))return {type:'youtube',id,url:'https://www.youtube.com/watch?v='+id};
 if(/\.(mp4|webm|m4v)$/i.test(u.pathname))return {type:'video',url:u.href};
 return null;
}
function publicCinema(row) { return {id:row.id,media:JSON.parse(row.media),position:row.position,paused:!!row.paused,version:row.version,updatedAt:row.updated_at,expiresAt:row.expires_at,serverNow:Date.now()}; }
async function cinemaRoute(request,env,url) {
 const match=url.pathname.match(/^\/api\/cinema(?:\/([a-f0-9]{48}))?$/);
 if(!match)return json({error:'not_found'},404);
 const id=match[1],method=request.method;
 if(!['GET','POST','PATCH','DELETE'].includes(method))return json({error:'method_not_allowed'},405);
 if(method!=='GET'&&request.headers.get('Origin')!==trustedOrigin)return json({error:'forbidden_origin'},403);
 if(['POST','PATCH'].includes(method)&&!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'invalid_content_type'},415);
 try {
  const db=cinemaDB(env),now=Date.now();
  if(!id&&method==='POST') {
   for(const [k,v]of cinemaLimits)if(v.until<now)cinemaLimits.delete(k);
   const key=request.headers.get('CF-Connecting-IP')||'unknown',limit=cinemaLimits.get(key)||{until:now+3600000,count:0};
   if(limit.count>=10||cinemaLimits.size>=1000&&!cinemaLimits.has(key))return json({error:'rate_limited'},429);
   let body;try{body=await readBody(request);}catch{return json({error:'invalid_request'},400);}
   const media=cinemaMedia(body?.url);if(!media)return json({error:'unsupported_link'},400);
   limit.count++;cinemaLimits.set(key,limit);
   await db.prepare('DELETE FROM cinema_sessions WHERE expires_at < ?').bind(now).run();
   const count=await db.prepare('SELECT COUNT(*) AS total FROM cinema_sessions').first();
   if(count.total>=2000)return json({error:'capacity'},503);
   const roomId=randomCapability(),token=randomCapability(),expires=now+86400000;
   await db.prepare('INSERT INTO cinema_sessions (id,host_hash,media,position,paused,version,updated_at,expires_at) VALUES (?,?,?,0,1,1,?,?)').bind(roomId,await capabilityHash(token),JSON.stringify(media),now,expires).run();
   return json({id:roomId,hostToken:token,media,position:0,paused:true,version:1,updatedAt:now,expiresAt:expires,serverNow:now},201);
  }
  if(!id)return json({error:'not_found'},404);
  const row=await db.prepare('SELECT * FROM cinema_sessions WHERE id = ? AND expires_at > ?').bind(id,now).first();
  if(!row)return json({error:'session_ended'},404);
  if(method==='GET')return json(publicCinema(row));
  if(!['PATCH','DELETE'].includes(method))return json({error:'method_not_allowed'},405);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{48})$/)?.[1];
  if(!token||await capabilityHash(token)!==row.host_hash)return json({error:'host_only'},403);
  if(method==='DELETE'){await db.prepare('DELETE FROM cinema_sessions WHERE id = ?').bind(id).run();return json({ended:true});}
  let body;try{body=await readBody(request);}catch{return json({error:'invalid_request'},400);}
  const media=body?.url===undefined?JSON.parse(row.media):cinemaMedia(body.url);
  if(!media||typeof body?.paused!=='boolean'||!Number.isFinite(body.position)||body.position<0||body.position>604800||!Number.isSafeInteger(body.version))return json({error:'invalid_state'},400);
  const result=await db.prepare('UPDATE cinema_sessions SET media=?, position=?, paused=?, updated_at=?, version=version+1 WHERE id=? AND version=? AND expires_at>?').bind(JSON.stringify(media),body.position,body.paused?1:0,now,id,body.version,now).run();
  if(!result.meta.changes)return json({error:'state_changed'},409);
  return json(publicCinema({...row,media:JSON.stringify(media),position:body.position,paused:body.paused?1:0,updated_at:now,version:row.version+1}));
 }catch(error){console.error('Cinema storage request failed',error?.message);return json({error:'cinema_unavailable'},503);}
}
