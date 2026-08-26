const CACHE='bc16-1-test-shell-v2';
const SHELL=['/','/app.js','/styles.css','/manifest.webmanifest','/icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(x=>new Request(x,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function updateCache(request){
  try{
    const fresh=await fetch(request);
    if(fresh.ok){const cache=await caches.open(CACHE);cache.put(request,fresh.clone()).catch(()=>{});}
    return fresh;
  }catch{return null;}
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/'))return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cached=await caches.match('/');
      const network=updateCache(req);
      if(cached){event.waitUntil(network);return cached;}
      return await network||new Response('Offline',{status:503,headers:{'content-type':'text/plain;charset=utf-8'}});
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached){event.waitUntil(updateCache(req));return cached;}
    return await updateCache(req)||new Response('',{status:503,statusText:'Offline'});
  })());
});

self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c)return c.focus();}return clients.openWindow?clients.openWindow('/'):null;}));});
