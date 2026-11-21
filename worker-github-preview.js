const SOURCE = "https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/infra/cloudflare-workers-preview-2026-11-21/public";
const CSP = "connect-src 'self'; form-action 'self'; worker-src 'none'";
const ALLOWED = new Set([
  "/_headers",
  "/app.js",
  "/assets/distribution/fve-feed-01.svg",
  "/assets/distribution/fve-feed-02.svg",
  "/assets/distribution/nrsm-feed-01.svg",
  "/assets/distribution/nrsm-feed-02.svg",
  "/boot.js",
  "/commercial-live.js",
  "/crm-live.js",
  "/fve.html",
  "/icon.svg",
  "/index.html",
  "/manifest.webmanifest",
  "/mazliprint.html",
  "/nrsm.html",
  "/projects.html",
  "/robots.txt",
  "/sitemap.xml",
  "/studio",
  "/studio-entry",
  "/studio-status.js",
  "/studio.css",
  "/studio.html",
  "/studio.js",
  "/styles.css",
  "/sw.js"
]);
const REWRITES = { "/projects": "/projects.html", "/fve": "/fve.html", "/nrsm": "/nrsm.html", "/mazliprint": "/mazliprint.html" };
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": CSP,
  "Cache-Control": "no-store",
  "X-Preview-Source": "isolated-github-branch"
};
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...SECURITY,"Content-Type":"application/json; charset=utf-8"}});
}
function mime(path){
  const ext=path.includes(".")?path.slice(path.lastIndexOf(".")):"";
  return TYPES[ext] || "text/html; charset=utf-8";
}
export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(url.pathname==="/api/health" && request.method==="GET"){
      return json({ok:true,service:"bco-cloudflare-preview",preview:true,backend:"not-connected",source:"isolated-github-branch"});
    }
    if(url.pathname.startsWith("/api/")){
      return json({ok:false,error:"PREVIEW_BACKEND_NOT_CONNECTED",preview:true},503);
    }
    if(request.method!=="GET" && request.method!=="HEAD"){
      return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
    }
    let path;
    try { path=decodeURIComponent(url.pathname); }
    catch { return json({ok:false,error:"INVALID_PATH"},400); }
    if(path==="/") path="/index.html";
    if(REWRITES[path]) path=REWRITES[path];
    if(path.includes("\\") || path.includes("\0") || path.split("/").includes("..")){
      return json({ok:false,error:"INVALID_PATH"},400);
    }
    if(!ALLOWED.has(path)) return json({ok:false,error:"NOT_FOUND"},404);
    let upstream;
    try {
      upstream=await fetch(SOURCE+path,{method:request.method,headers:{Accept:"*/*"}});
    } catch (error) {
      return json({ok:false,error:"PREVIEW_ASSET_SOURCE_UNAVAILABLE",detail:String(error).slice(0,180)},502);
    }
    if(!upstream.ok) return json({ok:false,error:"PREVIEW_ASSET_NOT_FOUND"},404);
    const headers=new Headers(SECURITY);
    headers.set("Content-Type",mime(path));
    return new Response(request.method==="HEAD"?null:upstream.body,{status:200,headers});
  }
};
