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
function submit(dom, form) { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }

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
test('invalid language falls back and general guest links retain the limited-seats message', () => {
  const dom = load('?lang=xx');
  try {
    assert.equal(dom.window.document.documentElement.lang, 'en');
    assert.equal(dom.window.document.querySelector('[data-i18n="ceremony.note"]').textContent, dom.window.I18N.en['ceremony.note']);
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
test('confirmed yes posts the unchanged Sheets field contract exactly once and can be edited', async () => {
  const requests = [];
  const dom = load('?lang=hr&to=Maria', { fetch: async (url, opts) => { requests.push({ url, opts }); return { ok: true, json: async () => ({ ok: true, row: 2 }) }; } });
  try {
    const form = fill(dom); submit(dom, form); submit(dom, form); await flush();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, dom.window.RSVP_CONFIG.appsScriptUrl);
    const data = Object.fromEntries(new URLSearchParams(requests[0].opts.body));
    assert.deepEqual(Object.keys(data).sort(), ['firstName','lastName','attending','diet','allergies','email','message','language','submittedAt'].sort());
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
  const store = { 'invite_new.answer:Maria': JSON.stringify(answer), 'rsvp.answer': JSON.stringify(answer) };
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
