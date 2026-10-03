/* Mon Ciné Tracker — service worker : appli installable + consultable sans réseau */
var V='v4';
var SHELL='shell-'+V, IMG='img-'+V, API='api-'+V, LIB='lib-'+V;
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(SHELL).then(function(c){return c.addAll(['./','./manifest.webmanifest','./icon-192.png','./icon-512.png']);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return [SHELL,IMG,API,LIB].indexOf(k)<0;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
function trim(name,max){caches.open(name).then(function(c){c.keys().then(function(ks){if(ks.length>max){for(var i=0;i<ks.length-max;i++)c.delete(ks[i]);}});});}
function networkFirst(req,name,timeout,max,ign){var mo=ign?{ignoreSearch:true}:undefined;
  return new Promise(function(resolve){
    var done=false;
    var t=setTimeout(function(){caches.match(req,mo).then(function(r){if(r&&!done){done=true;resolve(r);}});},timeout);
    fetch(req).then(function(res){
      clearTimeout(t);
      if(res&&res.ok){var cp=res.clone();caches.open(name).then(function(c){c.put(req,cp);if(max)trim(name,max);});}
      if(!done){done=true;resolve(res);}
    }).catch(function(){
      clearTimeout(t);
      caches.match(req,mo).then(function(r){if(!done){done=true;resolve(r||new Response('',{status:504,statusText:'offline'}));}});
    });
  });
}
function cacheFirst(req,name,max){
  return caches.match(req).then(function(r){
    if(r)return r;
    return fetch(req).then(function(res){if(res&&(res.ok||res.type==='opaque')){var cp=res.clone();caches.open(name).then(function(c){c.put(req,cp);trim(name,max);});}return res;});
  });
}
function swr(req,name){
  return caches.match(req).then(function(r){
    var f=fetch(req).then(function(res){if(res&&(res.ok||res.type==='opaque')){var cp=res.clone();caches.open(name).then(function(c){c.put(req,cp);});}return res;}).catch(function(){return r;});
    return r||f;
  });
}
self.addEventListener('fetch',function(e){
  var req=e.request;if(req.method!=='GET')return;
  var u=new URL(req.url);
  // Jamais de cache pour la connexion / la synchro des comptes
  if(/firestore\.googleapis|identitytoolkit|securetoken|firebaseinstallations|googleapis\.com\/(identity|token)|ntfy\.sh|workers\.dev/.test(u.host+u.pathname))return;
  if(req.mode==='navigate'||(u.origin===location.origin&&/\/(index\.html)?$/.test(u.pathname))){e.respondWith(networkFirst(req,SHELL,4000,0,true));return;}
  if(u.origin===location.origin){e.respondWith(swr(req,SHELL));return;}
  if(u.host==='image.tmdb.org'){e.respondWith(cacheFirst(req,IMG,600));return;}
  if(u.host==='api.themoviedb.org'||u.host==='api.tvmaze.com'){e.respondWith(networkFirst(req,API,6000,400));return;}
  if(/gstatic\.com|googleapis\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(u.host)){e.respondWith(swr(req,LIB));return;}
});
