/* Static site: publish only guest-facing files, never development dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const context = { window: {} };
vm.createContext(context);
for (const name of ['config.js', 'i18n.js', 'editorial-i18n.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', name), 'utf8'), context);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const lang of ['sv', 'el', 'en', 'hr']) {
  for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) {
    if (typeof context.window.I18N[lang][match[1]] !== 'string') throw new Error(`Missing ${lang} translation: ${match[1]}`);
  }
  for (const match of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of match[1].split('|')) {
      if (typeof context.window.I18N[lang][pair.split(':')[1]] !== 'string') throw new Error(`Missing ${lang} attribute: ${pair}`);
    }
  }
}
for (const match of html.matchAll(/(?:src|href|srcset)="(assets\/[^"#]+)"/g)) {
  if (!fs.existsSync(path.join(root, match[1]))) throw new Error(`Missing asset: ${match[1]}`);
}
for (const file of fs.readdirSync(path.join(root, 'assets/js'))) {
  if (file.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), { filename: file });
}
const backend = {};
for (const file of ['Code.gs','EntranceCards.gs']) vm.runInNewContext(fs.readFileSync(path.join(root,'google-apps-script',file),'utf8'), backend, {filename:file});
const ceremonyTime = context.window.RSVP_CONFIG.ceremonyTime;
if (ceremonyTime !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(ceremonyTime)) throw new Error('Ceremony time must be empty or Stockholm HH:mm.');
if (ceremonyTime !== backend.ENTRANCE_CARD.ceremonyTime) throw new Error('Website and email card ceremony times must match.');
const card = fs.readFileSync(path.join(root,'assets/entrance-card.html'),'utf8');
for (const match of card.matchAll(/src="([^"#:]+)"/g)) if (!fs.existsSync(path.join(root,'assets',match[1]))) throw new Error('Missing card asset: '+match[1]);
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', '.nojekyll']) fs.copyFileSync(path.join(root, file), path.join(output, file));
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
console.log('Static site built; scripts, asset paths, and all four translation dictionaries validated.');
