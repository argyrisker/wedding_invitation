const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve, 10));

function load(query = '?lang=en', options = {}) {
  const dom = new JSDOM(source, { url: 'https://argyrisker.github.io/invite_new/' + query, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.fetch = options.fetch || (() => { throw new Error('Unexpected network call'); });
  if (options.store) Object.entries(options.store).forEach(([k, v]) => w.localStorage.setItem(k, v));
  if (options.noStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  for (const name of ['config.js', 'i18n.js', 'editorial-i18n.js']) w.eval(fs.readFileSync(path.join(root, 'assets/js', name), 'utf8'));
  if (options.config) Object.assign(w.RSVP_CONFIG, options.config);
  w.eval(fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'assets/js/editorial.js'), 'utf8'));
  return dom;
}
function fill(dom, attending = 'Yes') {
  const w = dom.window, form = w.document.getElementById('rsvpForm');
  for (const [name, value] of Object.entries({ firstName: 'Test', lastName: 'Guest', email: 'test@example.invalid', allergies: 'Sesame', message: 'Congratulations' })) form.elements[name].value = value;
  const radio = form.querySelector('[name=attending][value=' + attending + ']');
  radio.checked = true;
  radio.dispatchEvent(new w.Event('change', { bubbles: true }));
  form.querySelector('[name=diet][value=Vegetarian]').checked = true;
  return form;
}
function submit(dom, form) {
  if (!dom.window.document.getElementById('replyDetails').hidden) dom.window.document.getElementById('reviewReply').click();
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

for (const lang of ['sv', 'el', 'en', 'hr']) {
  test(`${lang}: all visible copy and attributes are translated`, () => {
    const dom = load('?lang=' + lang);
    try {
      const { document: d, I18N } = dom.window;
      assert.equal(d.documentElement.lang, lang);
      for (const el of d.querySelectorAll('[data-i18n]')) {
        assert.equal(typeof I18N[lang][el.dataset.i18n], 'string', el.dataset.i18n);
        assert.equal(el.textContent, I18N[lang][el.dataset.i18n], el.dataset.i18n);
      }
      for (const el of d.querySelectorAll('[data-i18n-attr]')) for (const pair of el.dataset.i18nAttr.split('|')) {
        const [attr, key] = pair.split(':');
        assert.equal(el.getAttribute(attr), I18N[lang][key]);
      }
    } finally { dom.window.close(); }
  });
}
for (const lang of ['el', 'hr']) for (const gender of ['f', 'm', 'fp', '']) {
  test(`${lang}: personalized ${gender || 'mixed'} greeting and ceremony access`, () => {
    const dom = load(`?lang=${lang}&to=Maria&g=${gender}&inv=ceremony`);
    try {
      const w = dom.window, key = { f: 'F', m: 'M', fp: 'FP' }[gender] || '';
      assert.equal(w.document.getElementById('greeting').textContent, w.I18N[lang]['invite.titleTo' + key].replace('{name}', 'Maria'));
      assert.equal(w.document.querySelector('[data-i18n="ceremony.noteCeremony"]').textContent, w.I18N[lang]['ceremony.noteCeremony']);
    } finally { dom.window.close(); }
  });
}
test('custom greeting remains literal, and changing language preserves every guest parameter', () => {
  const greeting = '<img src=x onerror=alert(1)> Hello';
  const dom = load('?lang=el&to=Maria&g=f&inv=ceremony&greet=' + encodeURIComponent(greeting));
  try {
    const w = dom.window;
    w.document.querySelector('[data-lang=hr]').click();
    assert.equal(w.document.getElementById('greeting').textContent, greeting);
    assert.equal(w.document.getElementById('greeting').children.length, 0);
    const q = new URL(w.location.href).searchParams;
    assert.equal(q.get('lang'), 'hr'); assert.equal(q.get('to'), 'Maria'); assert.equal(q.get('g'), 'f'); assert.equal(q.get('inv'), 'ceremony'); assert.equal(q.get('greet'), greeting);
  } finally { dom.window.close(); }
});
test('invalid language falls back and all guest links welcome guests to Skansen', () => {
  const dom = load('?lang=xx');
  try {
    assert.equal(dom.window.document.documentElement.lang, 'en');
    assert.equal(dom.window.document.querySelector('[data-i18n="ceremony.noteCeremony"]').textContent, dom.window.I18N.en['ceremony.note']);
  } finally { dom.window.close(); }
});
test('required fields block submission, keep focus on the error and expose its description', () => {
  let calls = 0;
  const dom = load('?lang=en', { fetch: () => { calls++; } });
  try {
    const form = dom.window.document.getElementById('rsvpForm');
    submit(dom, form);
    assert.equal(calls, 0);
    assert.equal(form.elements.firstName.getAttribute('aria-invalid'), 'true');
    assert.ok(form.elements.firstName.getAttribute('aria-describedby'));
    assert.equal(dom.window.document.activeElement, form.elements.firstName);
    fill(dom); form.elements.email.value = 'not-an-email'; submit(dom, form);
    assert.equal(calls, 0); assert.equal(form.elements.email.getAttribute('aria-invalid'), 'true');
  } finally { dom.window.close(); }
});
test('confirmed yes posts the Sheets fields plus the Skansen delivery marker exactly once and can be edited', async () => {
  const requests = [];
  const dom = load('?lang=hr&to=Maria', { fetch: async (url, opts) => { requests.push({ url, opts }); return { ok: true, json: async () => ({ ok: true, row: 2 }) }; } });
  try {
    const form = fill(dom); submit(dom, form); submit(dom, form); await flush();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, dom.window.RSVP_CONFIG.appsScriptUrl);
    const data = Object.fromEntries(new URLSearchParams(requests[0].opts.body));
    assert.deepEqual(Object.keys(data).sort(), ['firstName','lastName','attending','diet','allergies','email','message','language','submittedAt','venueVariant'].sort());
    assert.equal(data.language, 'hr'); assert.equal(data.diet, 'Vegetarian'); assert.equal(data.attending, 'Yes');
    assert.equal(form.hidden, true); assert.equal(dom.window.document.getElementById('thanks').hidden, false);
    dom.window.document.getElementById('editAgain').click();
    assert.equal(form.hidden, false); assert.equal(form.elements.email.value, 'test@example.invalid');
    assert.equal(dom.window.document.getElementById('attendingOnly').hidden, false);
  } finally { dom.window.close(); }
});
test('declining removes dietary details from the submission', async () => {
  let data;
  const dom = load('?lang=en', { fetch: async (_, opts) => { data = Object.fromEntries(new URLSearchParams(opts.body)); return { ok: true, json: async () => ({ ok: true }) }; } });
  try {
    const form = fill(dom, 'No'); submit(dom, form); await flush();
    assert.equal(data.attending, 'No'); assert.equal(data.diet, ''); assert.equal(data.allergies, '');
    assert.equal(dom.window.document.getElementById('thanksTitle').textContent, dom.window.I18N.en['thanks.noTitle']);
  } finally { dom.window.close(); }
});
for (const kind of ['network', 'malformed', 'refused']) {
  test(`${kind} failure never claims success or retries a POST silently`, async () => {
    let calls = 0;
    const dom = load('?lang=en', { fetch: async () => {
      calls++;
      if (kind === 'network') throw new Error('Network unavailable');
      return { ok: true, json: async () => kind === 'refused' ? { ok: false, error: 'rejected' } : { unexpected: true } };
    } });
    try {
      const form = fill(dom); submit(dom, form); await flush();
      assert.equal(calls, 1); assert.equal(form.hidden, false);
      assert.equal(dom.window.document.getElementById('thanks').hidden, true);
      assert.equal(dom.window.document.getElementById('submitBtn').disabled, false);
      const status = dom.window.document.getElementById('formStatus');
      assert.ok(status.classList.contains(kind === 'refused' ? 'is-error' : 'is-unconfirmed'));
      assert.ok(status.querySelector('a').href.startsWith('mailto:'));
      dom.window.document.querySelector('[data-lang=sv]').click();
      assert.ok(status.textContent.startsWith(dom.window.I18N.sv[kind === 'refused' ? 'form.error' : 'new.unconfirmed']));
    } finally { dom.window.close(); }
  });
}
test('confirmed success still works with browser storage disabled', async () => {
  const dom = load('?lang=en', { noStorage: true, fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }) });
  try { const form = fill(dom); submit(dom, form); await flush(); assert.equal(form.hidden, true); }
  finally { dom.window.close(); }
});
test('stored answers are isolated per guest and edit restores every form field after reload', () => {
  const answer = { firstName:'Maria', lastName:'Guest', email:'maria@example.invalid', attending:'Yes', diet:'Vegan, Nut allergy', allergies:'Sesame', message:'Lovely', language:'el' };
  const store = { 'invite_new.skansen.answer:Maria': JSON.stringify(answer), 'rsvp.answer': JSON.stringify(answer) };
  let dom = load('?lang=en&to=Other', { store });
  try { assert.equal(dom.window.document.getElementById('rsvpForm').hidden, false); } finally { dom.window.close(); }
  dom = load('?lang=en&to=Maria', { store });
  try {
    const d=dom.window.document, form=d.getElementById('rsvpForm'); assert.equal(form.hidden,true);
    d.getElementById('editAgain').click(); assert.equal(form.elements.firstName.value,'Maria'); assert.equal(form.elements.allergies.value,'Sesame');
    assert.equal(form.querySelector('[value=Vegan]').checked,true); assert.equal(form.querySelector('[value="Nut allergy"]').checked,true);
  } finally { dom.window.close(); }
});
test('reduced-motion envelope opens by keyboard, unlocks the page and can replay', async () => {
  const dom = load('?lang=el&to=Maria');
  try {
    const w=dom.window, d=w.document;
    w.eval(fs.readFileSync(path.join(root,'assets/js/envelope.js'),'utf8'));
    d.dispatchEvent(new w.Event('DOMContentLoaded'));
    const env=d.getElementById('envelope');
    assert.equal(env.hidden,false); assert.equal(d.getElementById('pageContent').inert,true);
    env.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await flush();
    assert.equal(env.hidden,true); assert.equal(d.getElementById('pageContent').inert,false);
    d.getElementById('replayEnvelope').click(); assert.equal(env.hidden,false);
    env.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await flush(); assert.equal(env.hidden,true);
  } finally { dom.window.close(); }
});

test('story chapters support next, previous and arrow keys without changing the greeting', () => {
  const dom=load('?lang=el&to=Maria&g=f');
  try {
    const d=dom.window.document, greeting=d.getElementById('greeting').textContent;
    assert.equal(d.getElementById('chapter1').hidden,false);
    d.getElementById('chapterNext').click();
    assert.equal(d.getElementById('chapter1').hidden,true); assert.equal(d.getElementById('chapter2').hidden,false);
    d.getElementById('chapterTab2').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    assert.equal(d.getElementById('chapter3').hidden,false); assert.equal(d.getElementById('chapterNext').disabled,true);
    assert.equal(d.activeElement.id,'chapterTab3');
    d.getElementById('chapterPrevious').click(); assert.equal(d.getElementById('chapter2').hidden,false);
    d.querySelector('[data-lang=hr]').click();
    assert.equal(d.getElementById('chapter2').hidden,false); assert.equal(d.getElementById('chapterPosition').textContent,'02 / 03');
    assert.ok(greeting.includes('Maria')); assert.ok(d.getElementById('greeting').textContent.includes('Maria'));
  } finally { dom.window.close(); }
});
test('a horizontal swipe turns a chapter while vertical movement does not', () => {
  const dom=load();
  try {
    const d=dom.window.document,pages=d.getElementById('chapterPages');
    function pointer(type,x,y){const e=new dom.window.Event(type,{bubbles:true});Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:y});pages.dispatchEvent(e);}
    pointer('pointerdown',200,100);pointer('pointerup',100,105);assert.equal(d.getElementById('chapter2').hidden,false);
    pointer('pointerdown',200,100);pointer('pointerup',180,220);assert.equal(d.getElementById('chapter2').hidden,false);
  } finally { dom.window.close(); }
});
test('the selectable schedule preserves ceremony eligibility and translates in place', () => {
  const dom=load('?lang=en', {config:{ceremonyTime:'14:00'}});
  try {
    const d=dom.window.document;d.getElementById('dayTab1').click();
    assert.equal(d.getElementById('dayPanel0').hidden,true);assert.equal(d.getElementById('dayPanel1').hidden,false);
    d.querySelector('[data-lang=el]').click();assert.equal(d.getElementById('dayPanel1').hidden,false);
    d.getElementById('dayTab0').click();assert.equal(d.getElementById('dayPanel0').hidden,false);
    assert.equal(d.querySelector('[data-i18n="ceremony.noteCeremony"]').textContent,dom.window.I18N.el['ceremony.noteCeremony']);
  } finally { dom.window.close(); }
});
test('the first Enter opens review without submitting; changes and final confirmation work', async () => {
  let calls=0;
  const dom=load('?lang=en',{fetch:async()=>{calls++;return {ok:true,json:async()=>({ok:true})};}});
  try {
    const d=dom.window.document,form=fill(dom);
    assert.equal(d.getElementById('reviewReply').hidden,false);
    assert.equal(d.getElementById('submitBtn').parentElement,d.getElementById('replyReview'));
    form.elements.message.value='<script>not markup</script>';
    form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();
    assert.equal(calls,0);assert.equal(d.getElementById('replyReview').hidden,false);
    assert.ok(d.getElementById('replySummary').textContent.includes('<script>not markup</script>'));
    assert.equal(d.getElementById('replySummary').querySelector('script'),null);
    d.getElementById('backToReply').click();assert.equal(d.getElementById('replyDetails').hidden,false);
    form.elements.firstName.value='Updated'; d.getElementById('reviewReply').click();
    assert.ok(d.getElementById('replySummary').textContent.includes('Updated'));
    d.querySelector('[data-lang=el]').click();assert.ok(d.getElementById('replySummary').textContent.includes(dom.window.I18N.el['form.yes']));
    form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(calls,1);
    d.getElementById('editAgain').click();assert.equal(d.getElementById('replyDetails').hidden,false);assert.equal(d.getElementById('replyReview').hidden,true);
  } finally { dom.window.close(); }
});
for(const lang of ['en','el','sv','hr'])test(`${lang}: calendar export has correct dates, escaped text and no guest identifiers`,()=>{
  const dom=load('?lang='+lang+'&to=PrivateGuest');
  try {
    const text=dom.window.InvitationExperience.calendarText();
    assert.ok(text.includes('DTSTART;VALUE=DATE:20270605\r\n'));
    assert.ok(text.includes('DTEND;VALUE=DATE:20270606\r\n'));
    assert.ok(!text.includes('PrivateGuest'));assert.ok(!text.includes('15:20'));
    text.split('\r\n').forEach(line=>assert.ok(Buffer.byteLength(line,'utf8')<=75));
    assert.ok(text.replace(/\r\n /g,'').includes(dom.window.I18N[lang]['skansen.time']));
  }finally{dom.window.close();}
});
test('calendar includes a confirmed ceremony time for every guest',()=>{
  const dom=load('?lang=en', {config:{ceremonyTime:'14:00'}});
  try{assert.ok(dom.window.InvitationExperience.calendarText().includes('14:00'));}finally{dom.window.close();}
});
test('two years is present in all four story versions without inventing an anniversary date',()=>{
  const dom=load();
  try{const starts={en:'Two years',el:'Δύο χρόνια',sv:'Två år',hr:'Dvije godine'};for(const [lang,start] of Object.entries(starts))assert.ok(dom.window.I18N[lang]['invite.body'].startsWith(start));}
  finally{dom.window.close();}
});

for(const lang of ['en','el','sv','hr'])test(lang+': queued card delivery is honest and localized',async()=>{
 const dom=load('?lang='+lang,{fetch:async()=>({ok:true,json:async()=>({ok:true,cardDelivery:'queued'})})});
 try{submit(dom,fill(dom));await flush();assert.equal(dom.window.document.getElementById('cardDeliveryStatus').textContent,dom.window.I18N[lang]['skansen.queued']);}
 finally{dom.window.close();}
});
test('old backend saves RSVP without claiming an email is queued',async()=>{
 const dom=load('?lang=en',{fetch:async()=>({ok:true,json:async()=>({ok:true})})});
 try{submit(dom,fill(dom));await flush();assert.equal(dom.window.document.getElementById('cardDeliveryStatus').textContent,dom.window.I18N.en['skansen.unavailable']);}
 finally{dom.window.close();}
});
test('declining never displays a card delivery promise',async()=>{
 const dom=load('?lang=en',{fetch:async()=>({ok:true,json:async()=>({ok:true})})});
 try{submit(dom,fill(dom,'No'));await flush();assert.equal(dom.window.document.getElementById('cardDeliveryStatus').hidden,true);}
 finally{dom.window.close();}
});

for(const [status,key] of Object.entries({waiting_confirmation:'skansen.waiting',sent:'skansen.sent',uncertain:'skansen.uncertain'}))test(status+': delivery status stays accurate across language changes',async()=>{
 const dom=load('?lang=en',{fetch:async()=>({ok:true,json:async()=>({ok:true,cardDelivery:status})})});
 try{submit(dom,fill(dom));await flush();const d=dom.window.document;
 assert.equal(d.getElementById('cardDeliveryStatus').textContent,dom.window.I18N.en[key]);assert.equal(d.getElementById('thanksCardLink').hidden,false);
 d.querySelector('[data-lang=el]').click();assert.equal(d.getElementById('cardDeliveryStatus').textContent,dom.window.I18N.el[key]);
 }finally{dom.window.close();}
});
test('invalid configured time is never shown in the invitation or calendar',()=>{
 const dom=load('?lang=en',{config:{ceremonyTime:'25:99'}});
 try{assert.equal(dom.window.document.querySelector('[data-i18n="skansen.time"]').textContent,dom.window.I18N.en['skansen.time']);assert.ok(!dom.window.InvitationExperience.calendarText().includes('25:99'));}
 finally{dom.window.close();}
});
test('Skansen translations contain no old venue or restricted-ceremony wording',()=>{
 const dom=load();try{const text=JSON.stringify(dom.window.I18N);assert.ok(!/City Hall|stadshus|vijećnic|Δημαρχ|Hantverkargatan|Mälaren/.test(text));}finally{dom.window.close();}
});
