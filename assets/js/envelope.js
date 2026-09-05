/* Keep the original envelope, including for guests who prefer less motion. */
(function () {
  'use strict';
  var env = document.getElementById('envelope');
  var root = document.documentElement;
  var key = 'invite_new.opened';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isOpening = false;
  var returnFocus = null;
  var autoOpen;
  var qs = new URLSearchParams(location.search);
  var savedLang;
  try { savedLang = localStorage.getItem('rsvp.lang'); } catch (_) {}
  var candidates = [qs.get('lang'), savedLang].concat((navigator.languages || [navigator.language || 'en']).map(function (l) { return l.slice(0, 2).toLowerCase(); }), [(window.RSVP_CONFIG || {}).defaultLang || 'en']);
  var lang = candidates.find(function (l) { return window.I18N && window.I18N[l]; }) || 'en';
  env.querySelector('[data-i18n="envelope.hint"]').textContent = window.I18N[lang]['envelope.hint'];
  env.querySelector('[data-i18n="new.sealed"]').textContent = window.I18N[lang]['new.sealed'];
  function pageState(sealed) {
    var page = document.getElementById('pageContent');
    if (page) page.inert = sealed;
    root.classList.toggle('is-sealed', sealed);
  }
  function open() {
    if (env.hidden || isOpening) return;
    isOpening = true;
    clearTimeout(autoOpen);
    env.classList.add('is-opening');
    try { localStorage.setItem(key, '1'); } catch (_) {}
    setTimeout(function () {
      env.hidden = true;
      env.classList.remove('is-opening');
      pageState(false);
      isOpening = false;
      if (returnFocus) returnFocus.focus({ preventScroll: true });
      else {
        var heading = document.getElementById('coupleNames');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
    }, reduced ? 0 : 3650);
  }
  function show(trigger) {
    if (isOpening) return;
    returnFocus = trigger || null;
    env.hidden = false;
    pageState(true);
    env.focus({ preventScroll: true });
    autoOpen = setTimeout(open, 18000);
  }
  env.addEventListener('click', open);
  env.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); open(); }
    if (e.key === 'Tab') { e.preventDefault(); env.focus(); }
  });
  var opened = false;
  try { opened = !!localStorage.getItem(key); } catch (_) {}
  if (!opened) show();
  document.addEventListener('DOMContentLoaded', function () {
    pageState(!env.hidden);
    document.getElementById('replayEnvelope').addEventListener('click', function (e) { show(e.currentTarget); });
  });
})();
