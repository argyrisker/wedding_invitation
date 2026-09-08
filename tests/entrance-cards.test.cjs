const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function setup(){
 const sheets={};let sends=[],pdfs=0,quota=100,attending=true,failSend=false;
 class Sheet{
  constructor(name){this.name=name;this.rows=[];}
  getLastRow(){return this.rows.length;}
  appendRow(r){this.rows.push([...r]);return this;}
  setFrozenRows(){return this;}
  getDataRange(){return {getValues:()=>this.rows.map(r=>[...r])};}
  getRange(r,c,n=1,m=1){const sheet=this;return {
   getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sheet.rows[r-1+i]?.[c-1+j]??''));},
   setValues(values){values.forEach((line,i)=>{sheet.rows[r-1+i]??=[];line.forEach((v,j)=>sheet.rows[r-1+i][c-1+j]=v);});return this;},
   setValue(v){return this.setValues([[v]]);}
  };}
 }
 const ss={getSheetByName:n=>sheets[n],insertSheet:n=>(sheets[n]=new Sheet(n))};
 const context={console:{error(){}},SpreadsheetApp:{openById:()=>ss,flush(){}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock(){},releaseLock(){}})},
  MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{sends.push(m);if(failSend)throw Error('ambiguous network failure');}},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}
 };
 vm.createContext(context);
 for(const file of ['Code.gs','EntranceCards.gs'])vm.runInContext(fs.readFileSync(path.join(root,'google-apps-script',file),'utf8'),context,{filename:file});
 context.entrancePdf=()=>{pdfs++;return {name:'Swedish-card.pdf'};};
 context.isStillAttending=()=>attending;
 return {c:context,sheets,sends,pdfs:()=>pdfs,setQuota:v=>quota=v,setAttending:v=>attending=v,setFail:v=>failSend=v};
}
const guest=(change={})=>({firstName:'Maria',lastName:'Guest',email:'maria@example.invalid',language:'el',attending:'Yes',venueVariant:'skansen',...change});
test('main-site replies never enroll guests for Skansen email',()=>{const {c,sheets}=setup();assert.equal(c.queueEntranceCard(guest({venueVariant:undefined})),'not_requested');assert.deepEqual(sheets,{});});
test('repeat Skansen replies share one queue entry and keep latest language',()=>{const {c,sheets}=setup();c.queueEntranceCard(guest());c.queueEntranceCard(guest({email:'MARIA@example.invalid',language:'hr'}));assert.equal(sheets['Entrance cards'].rows.length,2);assert.equal(sheets['Entrance cards'].rows[1][3],'hr');});
test('no email or PDF before venue and time are confirmed',()=>{const a=setup();a.c.queueEntranceCard(guest());a.c.processEntranceCards();assert.equal(a.pdfs(),0);a.c.ENTRANCE_CARD.enabled=true;a.c.processEntranceCards();assert.equal(a.pdfs(),0);assert.equal(a.sends.length,0);});
test('reject placeholder and impossible ceremony times',()=>{const {c}=setup();c.ENTRANCE_CARD.enabled=true;for(const value of ['TBD','25:00','14:90','']){c.ENTRANCE_CARD.ceremonyTime=value;assert.equal(c.cardReady(),false);}c.ENTRANCE_CARD.ceremonyTime='14:30';assert.equal(c.cardReady(),true);});
test('confirmed attendance sends one localized message with a Swedish PDF and deduplicates',()=>{const a=setup();a.c.ENTRANCE_CARD.enabled=true;a.c.ENTRANCE_CARD.ceremonyTime='14:00';a.c.queueEntranceCard(guest());a.c.processEntranceCards();a.c.queueEntranceCard(guest());a.c.processEntranceCards();assert.equal(a.sends.length,1);assert.match(a.sends[0].subject,/Skansen/);assert.match(a.sends[0].body,/Χαιρόμαστε/);assert.equal(a.sends[0].attachments[0].name,'Swedish-card.pdf');assert.equal(a.sheets['Entrance cards'].rows[1][4],'sent');});
test('changed attendance cancels pending delivery',()=>{const a=setup();a.c.ENTRANCE_CARD.enabled=true;a.c.ENTRANCE_CARD.ceremonyTime='14:00';a.c.queueEntranceCard(guest());a.setAttending(false);a.c.processEntranceCards();assert.equal(a.sends.length,0);assert.equal(a.sheets['Entrance cards'].rows[1][4],'cancelled');});
test('explicit decline does not create a sendable card',()=>{const a=setup();a.c.queueEntranceCard(guest({attending:'No'}));assert.equal(a.sheets['Entrance cards'].rows[1][4],'cancelled');});
test('an ambiguous mail failure is visible and is not retried automatically',()=>{const a=setup();a.c.ENTRANCE_CARD.enabled=true;a.c.ENTRANCE_CARD.ceremonyTime='14:00';a.c.queueEntranceCard(guest());a.setFail(true);a.c.processEntranceCards();a.c.processEntranceCards();assert.equal(a.sends.length,1);assert.equal(a.sheets['Entrance cards'].rows[1][4],'uncertain');assert.match(a.sheets['Entrance cards'].rows[1][7],/Check delivery/);});
test('quota exhaustion keeps the card pending without generating a PDF',()=>{const a=setup();a.c.ENTRANCE_CARD.enabled=true;a.c.ENTRANCE_CARD.ceremonyTime='14:00';a.c.queueEntranceCard(guest());a.setQuota(0);a.c.processEntranceCards();assert.equal(a.pdfs(),0);assert.equal(a.sheets['Entrance cards'].rows[1][4],'pending');});
test('a confirmed time change sends an updated card once',()=>{const a=setup();a.c.ENTRANCE_CARD.enabled=true;a.c.ENTRANCE_CARD.ceremonyTime='14:00';a.c.queueEntranceCard(guest());a.c.processEntranceCards();a.c.ENTRANCE_CARD.ceremonyTime='14:30';a.c.processEntranceCards();a.c.processEntranceCards();assert.equal(a.sends.length,2);});
for(const language of ['en','sv','el','hr'])test(language+': email explains printed invitation, venue and Swedish card',()=>{const {c}=setup();const m=c.entranceMail(guest({language}));assert.ok(m.body.includes('Swedenborgs lusthus'));assert.ok(m.body.includes('Maria'));assert.ok(m.subject.length>20);});
test('unsupported or inherited dictionary languages use English safely',()=>{const {c}=setup();for(const language of ['xx','constructor','__proto__'])assert.equal(c.cardLanguage(language),'en');});
test('email queue and owner notification failures never turn a saved RSVP into failure',()=>{const {c}=setup();let saved=0;c.save=()=>{saved++;return {row:2,updated:false};};c.queueEntranceCard=()=>{throw Error('queue unavailable');};c.notify=()=>{throw Error('mail unavailable');};const r=c.doPost({parameter:guest()});assert.equal(saved,1);assert.equal(r.ok,true);assert.equal(r.cardDelivery,'unavailable');});
test('invalid attendance and multi-recipient addresses are rejected before saving',()=>{const {c}=setup();let saved=0;c.save=()=>{saved++;};for(const data of [guest({attending:'Maybe'}),guest({email:'a@b.com,c@d.com'})])assert.equal(c.doPost({parameter:data}).ok,false);assert.equal(saved,0);});
