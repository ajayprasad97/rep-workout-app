// Toggles the mobile nav dropdown for the simple info-page header
// (#menu-btn / #site-nav). No-op if either element is missing.
(function () {
  var btn = document.getElementById('menu-btn');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(!nav.classList.contains('open'));
  });

  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target)) {
      setOpen(false);
    }
  });

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });
})();
