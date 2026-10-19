import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('extension/whatsapp-dom.js','utf8');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
let passed=0;
try {
 const page=await browser.newPage();
 const image='data:image/png;base64,'+(await readFile('extension/icons/128.png')).toString('base64');
 for (const shape of ['legacy','main-footer','canvas','background','textarea','revealed-editor']) {
  await page.setContent('<main id="main"><header>+5511999999999</header><div class="message-out"><img width="128" height="128"><span>Old caption</span></div><footer id="old"><div contenteditable="true">Existing draft</div><button aria-label="Enviar">Send old</button></footer></main>');
  await page.addScriptTag({content:source});
  await page.evaluate(shape=>{if(shape==='revealed-editor'){const e=document.createElement('textarea');e.id='reused';e.style.display='none';document.body.append(e);}window.baseline=ContatoWhatsAppDOM.snapshot();},shape);
  await page.evaluate(({shape,image})=>{
   const root=document.createElement('section');root.id='media';root.setAttribute('role','dialog');
   const visual=shape==='canvas'?'<canvas width="180" height="160"></canvas>':shape==='background'?`<div style="width:180px;height:160px;background-image:url(${image})"></div>`:`<img width="180" height="160" src="${image}">`;
   const editor=shape==='textarea'?'<textarea aria-label="Adicionar legenda"></textarea>':'<div contenteditable="true" data-lexical-editor="true" role="textbox" style="min-height:30px"></div>';
   const send=shape==='legacy'?'<button><span data-icon="send">Enviar</span></button>':shape==='canvas'?'<div role="button" aria-label="Enviar"><span data-icon="wds-ic-send-filled"></span></div>':'<button aria-label="Send">Send</button>';
   root.innerHTML=visual+(shape==='revealed-editor'?'':editor)+send;
   if(shape==='revealed-editor'){const e=document.querySelector('#reused');e.style.display='block';root.append(e);}
   if(shape==='main-footer')document.querySelector('#main footer').append(root);else document.body.append(root);
  },{shape,image});
  await page.waitForFunction(()=>!!ContatoWhatsAppDOM.preview(window.baseline));
  const caption='🚨 Oferta de hoje\nDe R$ 22,48 por R$ 17,32\nhttps://example.com/item?a=1&b=2';
  await page.evaluate(async caption=>{const p=ContatoWhatsAppDOM.preview(window.baseline);await ContatoWhatsAppDOM.setCaption(p.caption,caption);},caption);
  assert.equal(await page.evaluate(()=>ContatoWhatsAppDOM.text(ContatoWhatsAppDOM.preview(window.baseline).caption)),caption);
  assert.equal(await page.locator('#old > [contenteditable]').innerText(),'Existing draft');
  passed++;console.log('PASS detector + caption:',shape);
 }
 // Existing media/chat send buttons and a second competing preview must not be selected.
 await page.evaluate(({image})=>{const r=document.createElement('section');r.innerHTML=`<img width="180" height="160" src="${image}"><div contenteditable="true" style="height:30px"></div><button aria-label="Enviar">Send</button>`;document.body.append(r);},{image});
 await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>ContatoWhatsAppDOM.preview(window.baseline)),null);passed++;console.log('PASS ambiguity is rejected');
 // WhatsApp emoji images mixed with browser-generated editable line blocks.
 for(const [html,expected] of [
  ['<img alt="🚨"> Oferta<div>Preço R$ 17,32</div><div><br></div><div><a href="https://example.com">https://example.com</a></div>','🚨 Oferta\nPreço R$ 17,32\n\nhttps://example.com'],
  ['<p><img alt="✨"> Luz<br>Segunda linha</p><p>Fim</p>','✨ Luz\nSegunda linha\nFim'],
  ['<div><span><img alt="🛒"> Compre</span></div><div><span>agora</span></div>','🛒 Compre\nagora'],
 ]){
  await page.setContent('<div id="caption" contenteditable="true"></div>');
  await page.addScriptTag({content:source});
  await page.locator('#caption').evaluate((e,html)=>e.innerHTML=html,html);
  assert.equal(await page.evaluate(()=>ContatoWhatsAppDOM.text(document.querySelector('#caption'))),expected);
  passed++;console.log('PASS emoji images + structural line breaks');
 }
 // Requested policy accepts different nonempty content; empty captions are blocked.
 await page.setContent('<div id="caption" contenteditable="true"></div><div id="action" data-testid="send"><span data-icon="send">Enviar</span></div>');
 await page.addScriptTag({content:source});
 assert.deepEqual(await page.evaluate(()=>ContatoWhatsAppDOM.sendButtons().map(e=>e.id)),['action']);passed++;console.log('PASS data-testid send without a role wrapper');
 await page.locator('#caption').fill('☀ Oferta 👩‍💻\nhttps://example.com/item');
 assert.equal(await page.evaluate(()=>ContatoWhatsAppDOM.captionReady(document.querySelector('#caption'),'☀️ Oferta 👩‍💻\nhttps://example.com/item')),true);
 for(const wrong of ['☀ Oferta 👩💻\nhttps://example.com/item','☀ Oferta 👩‍💻\nhttps://example.com/other','☀ Oferta','☀ Oferta 👩‍💻 https://example.com/item'])assert.equal(await page.evaluate(wrong=>ContatoWhatsAppDOM.captionReady(document.querySelector('#caption'),wrong),wrong),true);
 passed++;console.log('PASS nonempty caption accepted even when content or length differs');
 await page.locator('#caption').fill('   ');
 assert.equal(await page.evaluate(()=>ContatoWhatsAppDOM.captionReady(document.querySelector('#caption'),'Mensagem')),false);
 assert.equal(await page.evaluate(()=>ContatoWhatsAppDOM.captionReady(document.querySelector('#caption'),'')),true);
 // Simulate a framework discarding the text and replacing the editor after input.
 await page.locator('#caption').fill('');
 const rejected=await page.evaluate(async()=>{
  const editor=document.querySelector('#caption');editor.addEventListener('input',()=>editor.replaceWith(editor.cloneNode(false)),{once:true});
  try{await ContatoWhatsAppDOM.setCaption(editor,'Mensagem completa',()=>document.querySelector('#caption'));return false;}catch(e){return e.code==='CAPTION_EMPTY';}
 });assert.equal(rejected,true);passed++;console.log('PASS discarded caption blocks sending despite detached editor retaining text');
 // Exercise the fallback input notification without emitting a duplicate native event.
 const fallback=await page.evaluate(async()=>{
  const editor=document.querySelector('#caption');let events=0;editor.addEventListener('input',()=>events++);
  const original=document.execCommand;document.execCommand=(_,__,value)=>{editor.textContent=value;return true;};
  try{await ContatoWhatsAppDOM.setCaption(editor,'Texto sem HTML <b>literal</b>');return {events,text:editor.textContent,html:!!editor.querySelector('b')};}finally{document.execCommand=original;}
 });assert.deepEqual(fallback,{events:1,text:'Texto sem HTML <b>literal</b>',html:false});passed++;console.log('PASS fallback input event and literal text');
 console.log(`${passed} regressões de DOM passaram.`);
}finally{await browser.close();}
