import {put} from '@vercel/blob';
import {auth,noauth,env} from './_lib.js';
export const config={api:{bodyParser:false}};
const MAX_UPLOAD=4*1024*1024;
export default async function handler(req,res){
  if(!auth(req))return noauth(res);if(req.method!=='POST')return res.status(405).end();if(!env('BLOB_READ_WRITE_TOKEN'))return res.status(503).json({error:'BLOB_NOT_CONFIGURED'});
  try{
    const name=String(req.headers['x-file-name']||`media-${Date.now()}.bin`).replace(/[^a-zA-Z0-9._-]/g,'_'),type=String(req.headers['content-type']||'application/octet-stream');
    if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime)|application\/pdf)$/i.test(type))return res.status(415).json({error:'UNSUPPORTED_MEDIA_TYPE'});
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>MAX_UPLOAD)return res.status(413).json({error:'FILE_TOO_LARGE',maxBytes:MAX_UPLOAD});chunks.push(c)}
    const blob=await put(`business-control/${Date.now()}-${name}`,Buffer.concat(chunks),{access:'public',addRandomSuffix:true,contentType:type});res.json(blob);
  }catch(e){res.status(500).json({error:e.message});}
}
