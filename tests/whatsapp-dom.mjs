import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('extension/whatsapp-dom.js','utf8');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
let passed=0;
try {
 const page=await browser.newPage();
 const image='data:image/png;base64,'+(await readFile('extension/icons/128.png')).toString('base64');
 for (const shape of ['legacy','main-footer','canvas','background','textarea']) {
  await page.setContent('<main id="main"><header>+5511999999999</header><div class="message-out"><img width="128" height="128"><span>Old caption</span></div><footer id="old"><div contenteditable="true">Existing draft</div><button aria-label="Enviar">Send old</button></footer></main>');
  await page.addScriptTag({content:source});
  await page.evaluate(()=>{window.baseline=ContatoWhatsAppDOM.snapshot();});
  await page.evaluate(({shape,image})=>{
   const root=document.createElement('section');root.id='media';root.setAttribute('role','dialog');
   const visual=shape==='canvas'?'<canvas width="180" height="160"></canvas>':shape==='background'?`<div style="width:180px;height:160px;background-image:url(${image})"></div>`:`<img width="180" height="160" src="${image}">`;
   const editor=shape==='textarea'?'<textarea aria-label="Adicionar legenda"></textarea>':'<div contenteditable="true" data-lexical-editor="true" role="textbox" style="min-height:30px"></div>';
   const send=shape==='legacy'?'<button><span data-icon="send">Enviar</span></button>':shape==='canvas'?'<div role="button" aria-label="Enviar"><span data-icon="wds-ic-send-filled"></span></div>':'<button aria-label="Send">Send</button>';
   root.innerHTML=visual+editor+send;
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
 console.log(`${passed} regressões de DOM passaram.`);
}finally{await browser.close();}
