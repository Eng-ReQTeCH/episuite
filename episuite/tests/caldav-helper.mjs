import http from 'node:http';
export function calendarMock(observed=[]){
  const resources=new Map();let version=0;
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const c of req)body+=c;
    if(req.method!=='REPORT')observed.push({method:req.method,url:req.url,body,auth:req.headers.authorization});
    if(req.method==='REPORT'){res.writeHead(207,{'Content-Type':'application/xml'});res.end(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${[...resources].map(([url,r])=>`<d:response><d:href>${url}</d:href><d:propstat><d:prop><d:getetag>${r.etag.replaceAll('"','&quot;')}</d:getetag><c:calendar-data><![CDATA[${r.body}]]></c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('')}</d:multistatus>`);return;}
    const old=resources.get(req.url);
    if(req.headers['if-none-match']==='*'&&old||req.headers['if-match']&&req.headers['if-match']!==old?.etag){res.writeHead(412);res.end();return;}
    if(req.method==='PUT'){const etag=`"${++version}"`;resources.set(req.url,{body,etag});res.writeHead(201,{ETag:etag});res.end();return;}
    if(req.method==='DELETE'){resources.delete(req.url);res.writeHead(old?204:404);res.end();return;}
    res.writeHead(404);res.end();
  });
  return {server,resources};
}
