import { createHmac, timingSafeEqual } from 'node:crypto';
export const AMOUNT = 19700;
export const TITLE = 'Formação Completa Simplifica Treinamentos 5.0';
const digits = value => String(value ?? '').replace(/\D/g, '');
export function validDocument(value) {
  const n = digits(value);
  if (!/^(\d{11}|\d{14})$/.test(n) || /^(\d)\1+$/.test(n)) return false;
  const calc = (part, weights) => { const rest = [...part].reduce((sum, d, i) => sum + Number(d) * weights[i], 0) % 11; return rest < 2 ? 0 : 11 - rest; };
  if (n.length === 11) return calc(n.slice(0,9),[10,9,8,7,6,5,4,3,2]) === +n[9] && calc(n.slice(0,10),[11,10,9,8,7,6,5,4,3,2]) === +n[10];
  return calc(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]) === +n[12] && calc(n.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2]) === +n[13];
}
export function createPayload(input) {
  const name = String(input.name ?? '').trim(), email = String(input.email ?? '').trim().toLowerCase();
  const phone = digits(input.phone), document = digits(input.document);
  if (name.length < 3 || name.length > 120 || !name.includes(' ')) throw new Error('Informe seu nome completo.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email !== String(input.confirmEmail ?? '').trim().toLowerCase()) throw new Error('Confira os dois campos de email.');
  if (!validDocument(document)) throw new Error('Informe um CPF ou CNPJ válido.');
  if (!/^[1-9]\d{9,10}$/.test(phone)) throw new Error('Informe um celular válido com DDD.');
  return { amount: AMOUNT, currency:'BRL', paymentMethod:'pix', items:[{title:TITLE,unitPrice:AMOUNT,quantity:1,tangible:false}],customer:{name,email,phone,document:{number:document,type:document.length===11?'cpf':'cnpj'}},pix:{expiresInDays:1} };
}
export function signTransaction(id, secret, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({id,expires:now + 86400000})).toString('base64url');
  return value + '.' + createHmac('sha256',secret).update(value).digest('base64url');
}
export function verifyTransaction(token, secret, now = Date.now()) {
  try {const [value,sig] = String(token).split('.'); const expected = createHmac('sha256',secret).update(value).digest();const given = Buffer.from(sig,'base64url');if(given.length!==expected.length || !timingSafeEqual(given,expected)) return null;const data=JSON.parse(Buffer.from(value,'base64url'));return data.expires>now && typeof data.id==='string' ? data.id : null;}catch{return null;}
}
export async function blackcat(path, apiKey, body, fetcher=fetch) {
  const response=await fetcher('https://api.blackcatoficial.com/api'+path,{method:body?'POST':'GET',headers:{'X-API-Key':apiKey,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
  const result=await response.json();
  if(!response.ok || !result.success || !result.data) throw new Error('Não foi possível consultar o pagamento. Tente novamente em instantes.');
  return result.data;
}
