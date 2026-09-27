import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const roots=['api','public','scripts','tests'];
let js=[];
for(const root of roots){for(const f of await readdir(root)){if(f.endsWith('.js')||f.endsWith('.mjs'))js.push(path.join(root,f));}}
for(const f of js)execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
JSON.parse(await readFile('package.json','utf8'));JSON.parse(await readFile('vercel.json','utf8'));JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
const html=await readFile('public/index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),dupes=ids.filter((x,i)=>ids.indexOf(x)!==i);
if(dupes.length)throw new Error('Duplicate IDs: '+[...new Set(dupes)].join(', '));
if(/style\s*=/.test(html))throw new Error('Inline style attribute would conflict with CSP.');
const sw=await readFile('public/sw.js','utf8');
if(!sw.includes("bc20-money-sprint-v1")||!sw.includes("/commercial-live.js")||!sw.includes("url.pathname.startsWith('/api/')")||!sw.includes('notificationclick'))throw new Error('Service worker strategy missing.');
const app=await readFile('public/app.js','utf8');
if(app.includes('$$('))throw new Error('Broken selector helper: $$ found in public/app.js.');
if(/(?<!\\$)\\$\\((['"])\\.[^'"]+\\1\\)\\.forEach/.test(app))throw new Error('Broken collection iteration: singleton $() used with forEach.');
for(const marker of ['MEDIA_THUMB_CACHE','IntersectionObserver','ensureMediaFile','clearThumbCache','generateReel','renderMetaConnection','generateCampaign','leadFollowKit','autoSelectReelPhotos','truthGuard','renderSales','pipelineStats','quoteSave','dealCoachRun','renderJobs','JOB_TEMPLATES','renderCashWatch','buildReelPreview','renderControlRoom','controlRoomData','maybeDueNotification','requestPersistentStorage','runContentWorker','renderWorker','lastContentWorker'])if(!app.includes(marker))throw new Error('V15 marker missing: '+marker);
const literalIds=[...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
// Some UI controls are intentionally created dynamically by the runtime (e.g. More navigation).
const dynamicIds=new Set(['navMore']);
const missing=[...new Set(literalIds.filter(id=>!ids.includes(id)&&!dynamicIds.has(id)))];
if(missing.length)throw new Error('JS references missing HTML ids: '+missing.join(', '));
const vercel=JSON.parse(await readFile('vercel.json','utf8'));const csp=vercel.headers?.flatMap(x=>x.headers||[]).find(x=>x.key==='Content-Security-Policy')?.value||'';
if(!csp.includes("media-src 'self' blob: https:"))throw new Error('CSP media-src missing for local Reel preview.');
const lib=await readFile('api/_lib.js','utf8');
const leadsSource=await readFile('api/leads.js','utf8');
const commercialSource=await readFile('api/commercial.js','utf8');
const crmBridge=await readFile('public/crm-live.js','utf8');
const commercialBridge=await readFile('public/commercial-live.js','utf8');
for(const marker of ['supabaseRequestCredentials','supabaseBearerToken','supabasePublishableKey'])if(!lib.includes(marker))throw new Error('Supabase JWT fallback missing: '+marker);
for(const marker of ['supabaseRequestCredentials(req)','CRM_DB_NOT_CONFIGURED_OR_CLOUD_LOGIN_REQUIRED'])if(!leadsSource.includes(marker))throw new Error('CRM live fallback missing: '+marker);
for(const marker of ['supabaseRequestCredentials(req)','COMMERCIAL_DB_NOT_CONFIGURED_OR_CLOUD_LOGIN_REQUIRED'])if(!commercialSource.includes(marker))throw new Error('Commercial live fallback missing: '+marker);
for(const marker of ['bc81-sb-session','LOKÁLNÍ CRM','__BCO_LIVE_CRM'])if(!crmBridge.includes(marker))throw new Error('CRM bridge fallback missing: '+marker);
for(const marker of ['bc81-sb-session','LOKÁLNÍ REŽIM','clearLive'])if(!commercialBridge.includes(marker))throw new Error('Commercial bridge fallback missing: '+marker);
if(!app.includes('if(window.__BCO_LIVE_CRM)return'))throw new Error('Local CRM guard missing.');

const comms=await readFile('api/_comms.js','utf8');if(!comms.includes('regional'))throw new Error('RCS endpoint mode missing.');
console.log(`CHECK OK — ${js.length} JS files, ${ids.length} unique UI ids, commercial/PWA checks enabled.`);
