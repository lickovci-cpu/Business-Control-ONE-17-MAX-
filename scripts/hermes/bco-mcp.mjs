#!/usr/bin/env node
// Minimal stdio MCP bridge for Hermes -> BCO. No email-send tool is exposed.
const BASE=String(process.env.BCO_BASE_URL||'https://business-control-one.vercel.app').replace(/\/$/,'');
const READ_TOKEN=process.env.HERMES_BCO_READ_TOKEN||'';
const WRITE_TOKEN=process.env.HERMES_BCO_WRITE_TOKEN||'';
const send=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');
const error=(id,code,message)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\n');
const tools=[
 {name:'bco_list_verified_leads',description:'Read-only: list existing BCO NŘŠM prospects and CRM leads. Never sends messages.',inputSchema:{type:'object',properties:{organization:{type:'string',enum:['ne-e-m','local-proof-factory']},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
 {name:'bco_ingest_verified_prospect',description:'Store one independently verified prospect in NŘŠM merch_prospects. Requires exact HTTPS source URL, observed date and source_verified=true. Does not create outreach drafts or send messages.',inputSchema:{type:'object',properties:{organization:{type:'string',enum:['ne-e-m']},company_name:{type:'string',minLength:2,maxLength:200},domain:{type:'string',maxLength:240},contact_name:{type:'string',maxLength:160},email:{type:'string',maxLength:320},phone:{type:'string',maxLength:80},source:{type:'string',minLength:2,maxLength:160},source_url:{type:'string',format:'uri',maxLength:1000},observed_at:{type:'string',format:'date-time'},source_verified:{type:'boolean',const:true},fit_score:{type:'integer',minimum:0,maximum:100},notes:{type:'string',maxLength:1500}},required:['organization','company_name','source','source_url','observed_at','source_verified'],additionalProperties:false}}
];
async function call(name,args){
 if(name==='bco_list_verified_leads'){
  if(!READ_TOKEN)throw new Error('HERMES_BCO_READ_TOKEN_NOT_SET');
  const q=new URLSearchParams({organization:args.organization||'ne-e-m',limit:String(args.limit||50)});
  const r=await fetch(BASE+'/api/internal/hermes/leads?'+q,{headers:{authorization:'Bearer '+READ_TOKEN}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'BCO_READ_FAILED_'+r.status);
  return data;
 }
 if(name==='bco_ingest_verified_prospect'){
  if(!WRITE_TOKEN)throw new Error('HERMES_BCO_WRITE_TOKEN_NOT_SET');
  const r=await fetch(BASE+'/api/internal/hermes/prospects',{method:'POST',headers:{authorization:'Bearer '+WRITE_TOKEN,'content-type':'application/json'},body:JSON.stringify(args)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'BCO_INGEST_FAILED_'+r.status);
  return data;
 }
 throw new Error('UNKNOWN_TOOL');
}
let buffer='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
 buffer+=chunk;
 for(;;){
  const i=buffer.indexOf('\n');if(i<0)break;
  const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);
  if(!line)continue;
  let msg;try{msg=JSON.parse(line)}catch{continue;}
  if(msg.method==='initialize')send(msg.id,{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'bco-hermes-bridge',version:'0.1.0'}});
  else if(msg.method==='notifications/initialized'){}
  else if(msg.method==='tools/list')send(msg.id,{tools});
  else if(msg.method==='tools/call'){
   const name=msg.params?.name,args=msg.params?.arguments||{};
   call(name,args).then(data=>send(msg.id,{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false})).catch(e=>send(msg.id,{content:[{type:'text',text:String(e.message||e)}],isError:true}));
  }else if(msg.id!==undefined)error(msg.id,-32601,'Method not found');
 }
});
process.stdin.on('end',()=>process.exit(0));
