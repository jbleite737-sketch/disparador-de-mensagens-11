import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState} from '../extension/core.js';
async function harness(){
 let data=emptyState(),msg,alarm,startup,removed;const alarms=new Map();let navigations=0;
 const listeners=[];
 globalThis.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>msg=f},onStartup:{addListener:f=>startup=f}},storage:{local:{get:async()=>({campaign:structuredClone(data)}),set:async v=>{data=structuredClone(v.campaign);listeners.forEach(f=>f());}}},action:{onClicked:{addListener:()=>{}}},alarms:{create:async(n,v)=>alarms.set(n,v),clear:async n=>alarms.delete(n),onAlarm:{addListener:f=>alarm=f}},tabs:{get:async id=>({id}),create:async()=>({id:7}),update:async()=>{navigations++;},onRemoved:{addListener:f=>removed=f}}};
 await import('../extension/background.js?test='+Math.random());
 const send=(m,sender={id:'test',url:'chrome-extension://test/app.html'})=>new Promise(resolve=>msg(m,sender,resolve));
 return {send,read:()=>structuredClone(data),alarms,nav:()=>navigations,fire:n=>alarm({name:n}),startup:()=>startup(),removed:id=>removed(id),settle:async()=>{for(let i=0;i<15;i++)await new Promise(r=>setTimeout(r,2));},content:()=>({id:'test',url:'https://web.whatsapp.com/send?phone=5511999999999',tab:{id:7}})};
}
async function prepare(h){const contacts=['5511999999999','5521999999999'].map((p,i)=>({phone:p,name:'Contato '+i,fields:{}}));assert.equal((await h.send({type:'SAVE',contacts,template:'Olá {{nome}}',consent:true,settings:{min:30,max:30,batch:10,rest:30,windowEnabled:false}})).ok,true);assert.equal((await h.send({type:'START'})).ok,true);await new Promise(r=>setTimeout(r,510));h.fire('queue');await h.settle();}
test('fila persiste antes do envio; duplicação e aba incorreta são rejeitadas',async()=>{const h=await harness();await prepare(h);const s=h.read();assert.equal(s.contacts[0].status,'preparing');assert.equal(h.nav(),1);h.fire('queue');await h.settle();assert.equal(h.nav(),1);const job=(await h.send({type:'JOB'},h.content())).data;assert.ok(job.token);assert.equal((await h.send({type:'READY',token:job.token},{...h.content(),tab:{id:8}})).ok,false);assert.equal((await h.send({type:'READY',token:job.token},h.content())).ok,true);assert.equal((await h.send({type:'READY',token:job.token},h.content())).ok,false);await h.send({type:'RESULT',token:job.token,status:'submitted',detail:'observada'},h.content());assert.equal(h.read().contacts[0].status,'submitted');assert.equal(h.nav(),2);assert.equal(h.read().contacts[1].status,'preparing');assert.ok(h.read().job.notBefore>Date.now());assert.equal((await h.send({type:'RESULT',token:job.token,status:'submitted'},h.content())).ok,false);});
test('pausa na preparação invalida autorização sem perder o contato',async()=>{const h=await harness();await prepare(h);const job=h.read().job;await h.send({type:'PAUSE'});assert.equal(h.read().contacts[0].status,'pending');assert.equal(h.read().job,null);assert.equal((await h.send({type:'READY',token:job.token},h.content())).ok,false);});
test('timeout após autorização exige revisão e não reenvia',async()=>{const h=await harness();await prepare(h);await h.send({type:'READY',token:h.read().job.token},h.content());h.fire('watchdog');await h.settle();assert.equal(h.read().status,'paused');assert.equal(h.read().contacts[0].status,'uncertain');assert.equal((await h.send({type:'START'})).ok,false);await h.send({type:'REVIEW'});assert.equal(h.read().contacts[0].status,'reviewed');assert.equal((await h.send({type:'START'})).ok,true);});
test('reinício interrompe um envio sem repetir; fechamento de aba pausa',async()=>{const h=await harness();await prepare(h);await h.send({type:'READY',token:h.read().job.token},h.content());h.startup();await h.settle();assert.equal(h.read().contacts[0].status,'uncertain');assert.equal(h.read().status,'paused');const j=await harness();await prepare(j);j.removed(7);await j.settle();assert.equal(j.read().contacts[0].status,'pending');assert.equal(j.read().status,'paused');});
test('origem externa não pode iniciar nem alterar a fila',async()=>{const h=await harness();assert.equal((await h.send({type:'START'},{id:'test',url:'https://evil.example'})).ok,false);assert.equal(h.read().status,'draft');});

test('falhas confirmadas antes do clique têm backoff e limite; depois seguem para o próximo contato',async()=>{
 const h=await harness();await prepare(h);const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
 try{
  for(let attempt=1;attempt<=3;attempt++){
   const token=h.read().job.token;
   assert.equal((await h.send({type:'RESULT',token,status:'error',code:'MEDIA_PREVIEW_TIMEOUT',clicked:false,detail:'preview not ready'},h.content())).ok,true);
   const state=h.read();assert.equal(state.status,'running');if(attempt<3)assert.equal(state.job,null);else assert.equal(state.job.id,state.contacts[1].id);
   assert.ok(state.nextAt>=clock+30000);
   assert.equal(state.contacts[0].preparationFailures,attempt);
   assert.equal(state.contacts[0].status,attempt<3?'pending':'error');
   if(attempt===2)assert.ok(state.nextAt>=clock+60000);
   clock=state.nextAt+1;h.fire('queue');await h.settle();
  }
  assert.equal(h.read().job.id,h.read().contacts[1].id);
 }finally{Date.now=realNow;}
});
test('erro depois da autorização nunca entra em recuperação automática',async()=>{
 const h=await harness();await prepare(h);const token=h.read().job.token;
 await h.send({type:'READY',token},h.content());
 await h.send({type:'RESULT',token,status:'uncertain',code:'MEDIA_PREVIEW_TIMEOUT',clicked:true,detail:'unknown outcome'},h.content());
 assert.equal(h.read().status,'paused');assert.equal(h.read().contacts[0].status,'uncertain');assert.equal(h.alarms.has('queue'),false);
});

test('abre próximo contato imediatamente, bloqueia envio antecipado e autoriza após delay',async()=>{
 const h=await harness();await prepare(h);let token=h.read().job.token;
 await h.send({type:'READY',token},h.content());
 await h.send({type:'RESULT',token,status:'submitted'},h.content());
 const s=h.read();token=s.job.token;
 assert.equal(h.nav(),2);assert.equal(s.contacts[1].status,'preparing');
 assert.equal((await h.send({type:'READY',token},h.content())).data,false);
 assert.equal((await h.send({type:'VERIFY',token},h.content())).data,false);
 const now=Date.now;Date.now=()=>s.job.notBefore;
 try{assert.equal((await h.send({type:'READY',token},h.content())).data,true);assert.equal((await h.send({type:'VERIFY',token},h.content())).data,true);}finally{Date.now=now;}
});
test('pausar durante delay na próxima conversa impede envio e mantém contato pendente',async()=>{
 const h=await harness();await prepare(h);let token=h.read().job.token;
 await h.send({type:'READY',token},h.content());await h.send({type:'RESULT',token,status:'submitted'},h.content());
 token=h.read().job.token;await h.send({type:'PAUSE'});
 assert.equal(h.read().contacts[1].status,'pending');assert.equal(h.read().job,null);
 assert.equal((await h.send({type:'READY',token},h.content())).ok,false);
});

test('janela agenda abertura, bloqueia na virada do horário e retoma sem novo início',async()=>{
 const realNow=Date.now;let clock=new Date(2026,9,24,7,0).getTime();Date.now=()=>clock;
 try{
  const h=await harness();
  await h.send({type:'SAVE',contacts:[{phone:'5511999999999',name:'Teste',fields:{}}],template:'Olá',consent:true,settings:{windowEnabled:true,windowStart:'08:00',windowEnd:'18:00'}});
  await h.send({type:'START'});assert.equal(h.read().nextAt,new Date(2026,9,24,8,0).getTime());
  h.fire('queue');await h.settle();assert.equal(h.nav(),0);
  clock=h.read().nextAt;h.fire('queue');await h.settle();assert.equal(h.nav(),1);
  const token=h.read().job.token;assert.equal((await h.send({type:'READY',token},h.content())).data,true);
  clock=new Date(2026,9,24,18,0).getTime();assert.equal((await h.send({type:'VERIFY',token},h.content())).data,false);
  assert.equal(h.read().status,'running');assert.equal(h.read().contacts[0].status,'preparing');
  assert.equal(h.read().job.notBefore,new Date(2026,9,25,8,0).getTime());
  assert.equal((await h.send({type:'READY',token},h.content())).data,false);
  clock=h.read().job.notBefore;assert.equal((await h.send({type:'READY',token},h.content())).data,true);
  assert.equal((await h.send({type:'VERIFY',token},h.content())).data,true);
 }finally{Date.now=realNow;}
});
test('pausa manual cancela retomada agendada fora da janela',async()=>{
 const realNow=Date.now;Date.now=()=>new Date(2026,9,24,20,0).getTime();
 try{
  const h=await harness();await h.send({type:'SAVE',contacts:[{phone:'5511999999999',fields:{}}],template:'Olá',consent:true,settings:{}});await h.send({type:'START'});
  await h.send({type:'PAUSE'});assert.equal(h.alarms.has('queue'),false);h.fire('queue');await h.settle();assert.equal(h.nav(),0);
 }finally{Date.now=realNow;}
});

test('botão ausente antes do clique registra erro e segue sem marcar como enviada',async()=>{
 const h=await harness();await prepare(h);const token=h.read().job.token;
 await h.send({type:'RESULT',token,status:'error',clicked:false,code:'SEND_BUTTON_NOT_FOUND',detail:'ausente'},h.content());
 assert.equal(h.read().contacts[0].status,'error');assert.equal(h.read().contacts[1].status,'preparing');assert.equal(h.nav(),2);assert.equal(h.read().status,'running');
});
