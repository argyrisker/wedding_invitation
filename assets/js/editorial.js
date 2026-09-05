/* Small enhancements to the invitation; no external libraries required. */
(function () {
  'use strict';
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
