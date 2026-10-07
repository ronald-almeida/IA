import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPayload,signTransaction,verifyTransaction,validDocument,blackcat } from './payment.mjs';
import handler from './server.mjs';
const buyer={name:'Cliente Teste',email:'teste@example.com',confirmEmail:'teste@example.com',phone:'11999999999',document:'52998224725'};
test('Entrada Vercel exporta função e aceita JSON já interpretado',async()=>{
 assert.equal(typeof handler,'function');
 const api=process.env.BLACKCAT_API_KEY,secret=process.env.CHECKOUT_TOKEN_SECRET;
 process.env.BLACKCAT_API_KEY='test-only';process.env.CHECKOUT_TOKEN_SECRET='test-secret'.repeat(5);
 const req={url:'/api/pix',method:'POST',headers:{'content-type':'application/json'},socket:{remoteAddress:'vercel-test'},body:{...buyer,document:'123'}};
 let status,result;const res={setHeader(){},writeHead(code){status=code;},end(value){result=JSON.parse(value);}};
 try{await handler(req,res);assert.equal(status,400);assert.match(result.error,/CPF/);}finally{if(api===undefined)delete process.env.BLACKCAT_API_KEY;else process.env.BLACKCAT_API_KEY=api;if(secret===undefined)delete process.env.CHECKOUT_TOKEN_SECRET;else process.env.CHECKOUT_TOKEN_SECRET=secret;}
});
test('Preço e produto são fixados no servidor',()=>{const p=createPayload({...buyer,amount:1});assert.equal(p.amount,19700);assert.equal(p.items[0].unitPrice,19700);assert.equal(p.items[0].tangible,false);});
test('CPF/CNPJ, confirmação do email e telefone são validados',()=>{assert.ok(validDocument(buyer.document));assert.ok(validDocument('11222333000181'));for(const document of ['11111111111','52998224726','123'])assert.throws(()=>createPayload({...buyer,document}));assert.throws(()=>createPayload({...buyer,confirmEmail:'diferente@example.com'}));assert.throws(()=>createPayload({...buyer,phone:'123'}));});
test('Token não permite consultar transações adulteradas ou expiradas',()=>{const secret='teste'.repeat(10),token=signTransaction('TXN-TEST',secret,1000);assert.equal(verifyTransaction(token,secret,2000),'TXN-TEST');assert.equal(verifyTransaction(token+'x',secret,2000),null);assert.equal(verifyTransaction(token,'outro',2000),null);assert.equal(verifyTransaction(token,secret,90000000),null);});
test('Contrato da API usa X-API-Key e falha sem expor respostas internas',async()=>{await blackcat('/sales/create-sale','test-only',createPayload(buyer),async(url,options)=>{assert.equal(url,'https://api.blackcatoficial.com/api/sales/create-sale');assert.equal(options.headers['X-API-Key'],'test-only');return {ok:true,json:async()=>({success:true,data:{status:'PENDING'}})};});await assert.rejects(()=>blackcat('/sales/x/status','test-only',null,async()=>({ok:false,json:async()=>({error:'secret-detail'})})),/Não foi possível/);});
test('Fluxo HTTP de criação e confirmação com provedor simulado, sem cobrança real',async()=>{
 const original=globalThis.fetch,api=process.env.BLACKCAT_API_KEY,secret=process.env.CHECKOUT_TOKEN_SECRET;process.env.BLACKCAT_API_KEY='only-test';process.env.CHECKOUT_TOKEN_SECRET='test-secret'.repeat(5);
 globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://api.blackcatoficial.com'))return {ok:true,json:async()=>({success:true,data:options.method==='POST'?{transactionId:'TXN-TEST',amount:19700,paymentData:{copyPaste:'000201TEST-ONLY',expiresAt:'2026-10-08T10:00:00Z'}}:{status:'PAID',amount:19700}})};return original(url,options);};
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const post=(path,data,cookie)=>original(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});const denied=await post('/api/status',{});assert.equal(denied.status,401);const invalid=await post('/api/pix',{...buyer,document:'123'});assert.equal(invalid.status,400);const created=await post('/api/pix',buyer);assert.equal(created.status,201);assert.equal((await created.json()).code,'000201TEST-ONLY');const cookie=created.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);const status=await post('/api/status',{},cookie.split(';')[0]);assert.deepEqual(await status.json(),{status:'PAID'});delete process.env.BLACKCAT_API_KEY;assert.equal((await post('/api/pix',buyer)).status,503);}finally{globalThis.fetch=original;if(api===undefined)delete process.env.BLACKCAT_API_KEY;else process.env.BLACKCAT_API_KEY=api;if(secret===undefined)delete process.env.CHECKOUT_TOKEN_SECRET;else process.env.CHECKOUT_TOKEN_SECRET=secret;await new Promise(r=>server.close(r));}
});
