/* Small enhancements to the invitation; no external libraries required. */
(function () {
  'use strict';
  function t(key) { var lang = document.documentElement.lang; return (window.I18N[lang] || window.I18N.en)[key] || window.I18N.en[key] || key; }
  function tabs(buttons, panels, onChange) {
    var active = 0;
    function select(index, focus) {
      active = Math.max(0, Math.min(buttons.length - 1, index));
      buttons.forEach(function (button, i) {
        button.setAttribute('aria-selected', String(i === active));
        button.tabIndex = i === active ? 0 : -1;
        panels[i].hidden = i !== active;
      });
      if (focus) buttons[active].focus({ preventScroll: true });
      if (onChange) onChange(active);
    }
    buttons.forEach(function (button, i) {
      button.addEventListener('click', function () { select(i); });
      button.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (i + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); select(next, true); }
      });
    });
    select(0);
    return { select: select, current: function () { return active; } };
  }
  var reader = document.getElementById('storyReader');
  var chapters = tabs(Array.from(document.querySelectorAll('[data-chapter]')), Array.from(document.querySelectorAll('.chapter')), function (index) {
    document.getElementById('chapterPrevious').disabled = index === 0;
    document.getElementById('chapterNext').disabled = index === 2;
    document.getElementById('chapterPosition').textContent = '0' + (index + 1) + ' / 03';
  });
  reader.classList.add('is-enhanced');
  document.getElementById('chapterPrevious').addEventListener('click', function () { chapters.select(chapters.current() - 1); document.getElementById('chapter' + (chapters.current() + 1)).focus({ preventScroll: true }); });
  document.getElementById('chapterNext').addEventListener('click', function () { chapters.select(chapters.current() + 1); document.getElementById('chapter' + (chapters.current() + 1)).focus({ preventScroll: true }); });
  var pages = document.getElementById('chapterPages'), gesture = null;
  pages.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || event.target.closest('a, button')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (pages.setPointerCapture) pages.setPointerCapture(event.pointerId);
  });
  pages.addEventListener('pointerup', function (event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    var x = event.clientX - gesture.x, y = event.clientY - gesture.y;
    if (Math.abs(x) > 55 && Math.abs(x) > Math.abs(y) * 1.5) chapters.select(chapters.current() + (x < 0 ? 1 : -1));
    gesture = null;
  });
  pages.addEventListener('pointercancel', function () { gesture = null; });
  tabs(Array.from(document.querySelectorAll('[data-day]')), Array.from(document.querySelectorAll('.event')));
  document.querySelector('.events').classList.add('is-enhanced');

  // A date-only calendar event does not invent the gathering time for guests
  // who are invited outside, or an end time for dinner.
  function calendarText() {
    function escape(value) { return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
    function fold(line) {
      var result = '', length = 0;
      Array.from(line).forEach(function (char) {
        var size = unescape(encodeURIComponent(char)).length;
        if (length + size > 73) { result += '\r\n '; length = 1; }
        result += char; length += size;
      });
      return result;
    }
    var time = (window.RSVP_CONFIG || {}).ceremonyTime;
    var ceremonyTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : t('skansen.time');
    var description = ceremonyTime + ' — ' + t('ceremony.venue') + '\n18:00 — ' + t('dinner.title') + '. ' + t('dinner.venue') + '\n' + t('day.timezone');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Argyrios and Tomislav//Wedding invitation//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:argyrios-tomislav-20270605@invite-new', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), 'DTSTART;VALUE=DATE:20270605', 'DTEND;VALUE=DATE:20270606', 'SUMMARY:' + escape('Argyrios & Tomislav — ' + t('hero.eyebrow')), 'LOCATION:' + escape(t('ceremony.venue') + ', ' + t('hero.city')), 'DESCRIPTION:' + escape(description), 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }
  document.getElementById('saveCalendar').addEventListener('click', function () {
    var blob = new Blob([calendarText()], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'Argyrios-Tomislav-5-June-2027.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  });

  var form = document.getElementById('rsvpForm');
  var details = document.getElementById('replyDetails'), review = document.getElementById('replyReview');
  review.appendChild(document.getElementById('submitBtn'));
  document.getElementById('reviewReply').hidden = false;
  var reviewing = false;
  function showDetails() {
    reviewing = false; details.hidden = false; review.hidden = true;
    document.querySelectorAll('[data-step]').forEach(function (step) { step.classList.toggle('is-current', step.dataset.step === '0'); });
  }
  function updateSummary() {
    var data = window.InvitationReply.collect();
    var rows = [[t('reply.name'), data.firstName + ' ' + data.lastName], [t('form.email'), data.email], [t('form.attending'), t(data.attending === 'Yes' ? 'form.yes' : 'form.no')]];
    if (data.attending === 'Yes') {
      var diet = Array.from(form.querySelectorAll('[name=diet]:checked')).map(function (input) { return input.nextElementSibling.textContent; }).join(', ');
      rows.push([t('form.diet'), diet || t('reply.none')], [t('form.allergies'), data.allergies || t('reply.none')]);
    }
    if (data.message) rows.push([t('form.message'), data.message]);
    var summary = document.getElementById('replySummary');
    summary.replaceChildren();
    rows.forEach(function (row) {
      var group = document.createElement('div'), title = document.createElement('dt'), value = document.createElement('dd');
      title.textContent = row[0]; value.textContent = row[1]; group.append(title, value); summary.append(group);
    });
  }
  function startReview() {
    if (!window.InvitationReply.validate()) return false;
    updateSummary(); reviewing = true; details.hidden = true; review.hidden = false;
    document.querySelectorAll('[data-step]').forEach(function (step) { step.classList.toggle('is-current', step.dataset.step === '1'); });
    document.getElementById('reviewHeading').focus({ preventScroll: true });
    review.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  document.getElementById('reviewReply').addEventListener('click', startReview);
  document.getElementById('backToReply').addEventListener('click', function () {
    if (document.getElementById('submitBtn').disabled) return;
    showDetails(); form.elements.firstName.focus({ preventScroll: true });
  });
  // Enter in a details field opens review; only the second step sends a reply.
  form.addEventListener('submit', function (event) {
    if (!reviewing) { event.preventDefault(); event.stopImmediatePropagation(); startReview(); }
  }, true);
  document.addEventListener('invitation:edit', showDetails);
  function attendanceResponse() {
    var checked = form.querySelector('[name=attending]:checked'), message = document.getElementById('attendanceResponse');
    message.hidden = !checked;
    message.textContent = checked ? t(checked.value === 'Yes' ? 'reply.yes' : 'reply.no') : '';
  }
  form.addEventListener('change', attendanceResponse);
  document.addEventListener('invitation:language', function () { attendanceResponse(); if (reviewing) updateSummary(); });
  attendanceResponse();
  window.InvitationExperience = { calendarText: calendarText };

  var links = Array.from(document.querySelectorAll('.section-nav a'));
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          var active = a.hash === '#' + entry.target.id;
          a.classList.toggle('is-current', active);
          if (active) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -55% 0px' });
    links.forEach(function (a) { var target = document.querySelector(a.hash); if (target) observer.observe(target); });
  }
})();
