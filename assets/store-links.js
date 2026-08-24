// Detects the visitor's platform and points the primary download button
// (and icon/label) at the matching store, and the small secondary link
// at the other one.
//
// Markup contract (HTML defaults to the iOS/App Store variant so the page
// is correct with no JS at all):
//   <a data-store-primary [data-store-short] href="<app store url>">
//     <span data-store-icon>...apple svg...</span>
//     <span data-store-label>Download on the App Store</span>
//   </a>
//   <a data-store-secondary href="<play store url>">Other platforms</a>
//
// data-store-short marks a button whose label never changes with platform
// (e.g. a compact header "Download" button) — only its href/icon update.
(function () {
  var APP_STORE_URL = 'https://apps.apple.com/us/app/rep-the-workout-app/id6765540272';
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reptheworkout.app&hl=en_US';
  var ANDROID_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814 13.792 12 3.609 22.186a1.5 1.5 0 0 1-.609-1.207V3.021a1.5 1.5 0 0 1 .609-1.207zm10.831 10.83 2.36-2.36 4.28 2.44a1.5 1.5 0 0 1 0 2.552l-4.28 2.44-2.36-2.36-1.828-1.826zm-1.06-1.061L5.316 3.516l9.649 5.507-1.86 1.86zm0 1.968 1.86 1.86-9.649 5.507 7.789-8.157v-.03z"/></svg>';

  function detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) && !window.MSStream) return 'ios';
    // No mobile UA: guess from desktop OS. Apple hardware owners skew
    // iPhone; everyone else skews Android.
    if (/Macintosh|Mac OS X/i.test(ua)) return 'ios';
    return 'android';
  }

  function apply() {
    if (detectPlatform() === 'ios') return; // markup already defaults to this

    document.querySelectorAll('[data-store-primary]').forEach(function (el) {
      el.href = PLAY_STORE_URL;
      var icon = el.querySelector('[data-store-icon]');
      if (icon) icon.innerHTML = ANDROID_ICON;
      if (!el.hasAttribute('data-store-short')) {
        var label = el.querySelector('[data-store-label]');
        if (label) label.textContent = 'Get it on Google Play';
      }
    });

    document.querySelectorAll('[data-store-secondary]').forEach(function (el) {
      el.href = APP_STORE_URL;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
