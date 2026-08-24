// Detects visitor platform and promotes the matching store button.
// Usage: wrap a pair of store links in an element with [data-store-group],
// tag the links [data-store="ios"] / [data-store="android"].
// Optional: [data-reorder="false"] on the group to keep DOM order (e.g. an
// "X or Y" layout); [data-deemphasis-class="..."] on a link to control the
// class applied when it loses emphasis (defaults to "btn-outline").
(function () {
  function detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) && !window.MSStream) return 'ios';
    return null;
  }

  function preferStore() {
    var platform = detectPlatform();
    if (!platform) return;

    document.querySelectorAll('[data-store-group]').forEach(function (group) {
      var ios = group.querySelector('[data-store="ios"]');
      var android = group.querySelector('[data-store="android"]');
      if (!ios || !android) return;

      var preferred = platform === 'ios' ? ios : android;
      var other = platform === 'ios' ? android : ios;
      var deemphasisClass = other.dataset.deemphasisClass || 'btn-outline';

      preferred.classList.remove('btn-outline', 'btn-secondary');
      preferred.classList.add('btn-primary');
      other.classList.remove('btn-primary');
      other.classList.add(deemphasisClass);

      if (group.dataset.reorder !== 'false') {
        group.insertBefore(preferred, group.firstChild);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preferStore);
  } else {
    preferStore();
  }
})();
