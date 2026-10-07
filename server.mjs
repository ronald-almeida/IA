import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { AMOUNT,createPayload,signTransaction,verifyTransaction,blackcat } from './payment.mjs';
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
const attempts=new Map();
setInterval(()=>{for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key)},60000).unref();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){if(req.body!==undefined){const data=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(data)>8192)throw new Error('Dados muito extensos.');return JSON.parse(data);}let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>8192)throw new Error('Dados muito extensos.');}return JSON.parse(data);}
export async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 let path;try{path=new URL(req.url,'http://localhost').pathname;}catch{return json(res,400,{error:'Requisição inválida.'});}
 if(path.startsWith('/api/')){
   if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
   if(!['/api/pix','/api/status'].includes(path))return json(res,404,{error:'Página não encontrada.'});
   if(!String(req.headers['content-type']).startsWith('application/json'))return json(res,415,{error:'Formato inválido.'});
   if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origem inválida.'});}catch{return json(res,403,{error:'Origem inválida.'});}}
   const apiKey=process.env.BLACKCAT_API_KEY, secret=process.env.CHECKOUT_TOKEN_SECRET;
   if(!apiKey || !secret || secret.length<32)return json(res,503,{error:'O pagamento está temporariamente indisponível. Tente novamente mais tarde.'});
   const token=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('checkout='))?.slice(9);
   if(path==='/api/status'){
     const id=verifyTransaction(token,secret);if(!id)return json(res,401,{error:'Sua sessão de pagamento expirou. Atualize a página.'});
     try{const data=await blackcat('/sales/'+encodeURIComponent(id)+'/status',apiKey);if(data.amount!==AMOUNT)return json(res,502,{error:'O valor da transação não confere.'});return json(res,200,{status:data.status});}catch{return json(res,502,{error:'Não foi possível verificar o pagamento agora. Aguarde e tente novamente.'});}
   }
   const ip=req.socket.remoteAddress;const entry=attempts.get(ip)||{count:0,until:Date.now()+60000};if(entry.until<Date.now()){entry.count=0;entry.until=Date.now()+60000;}if(++entry.count>6)return json(res,429,{error:'Aguarde um minuto antes de tentar novamente.'});attempts.set(ip,entry);
   let payload;try{payload=createPayload(await body(req));}catch(error){return json(res,400,{error:error instanceof SyntaxError?'Dados inválidos.':error.message});}
   try{
     const data=await blackcat('/sales/create-sale',apiKey,payload);
     const code=data.paymentData?.copyPaste||data.paymentData?.qrCode;
     if(data.amount!==AMOUNT || !data.transactionId || typeof code!=='string' || !code.startsWith('000201'))throw new Error('Resposta inválida');
     const raw=data.paymentData.qrCodeBase64;const qr=typeof raw==='string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(raw)?raw:null;
     const secure=req.headers['x-forwarded-proto']==='https'||req.socket.encrypted;
     res.setHeader('Set-Cookie',`checkout=${signTransaction(data.transactionId,secret)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400${secure?'; Secure':''}`);
     return json(res,201,{code,qr,expiresAt:data.paymentData.expiresAt});
   }catch{return json(res,502,{error:'Não foi possível obter o Pix. Uma cobrança pode ter sido criada. Aguarde um instante antes de tentar novamente.'});}
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Método não permitido.'});
 try{const file=resolve(publicDir,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(resolve(publicDir)+sep))return json(res,404,{error:'Não encontrado.'});const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:content);}catch{json(res,404,{error:'Não encontrado.'});}
}
export default async function app(req,res){
 try{await handler(req,res);}catch(error){console.error('checkout_request_failed',error.name);if(!res.headersSent)json(res,500,{error:'Erro temporário.'});else res.end();}
}
if(process.env.VERCEL !== '1' && process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))createServer(app).listen(process.env.PORT||3000,process.env.HOST||'127.0.0.1',()=>console.log('Checkout: http://localhost:'+(process.env.PORT||3000)));
