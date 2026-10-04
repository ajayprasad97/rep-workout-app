# repworkout.app — marketing site

Static HTML served as-is by GitHub Pages (custom domain in `CNAME`, `.nojekyll`).
There is no output directory: `scripts/build.mjs` rewrites the committed HTML
in place, and CI (`.github/workflows/check.yml`) fails if a page is out of date.

```bash
npm ci            # once: installs the Lucide icon set
npm run build     # after any edit: refresh partials + icons in every page
npm run check     # what CI runs
python3 -m http.server 8000   # preview at http://localhost:8000 (links are root-relative,
                              # so opening files directly via file:// won't navigate)
```

## Shared header and footer — edit `partials/`, not the pages

Each page holds marker comments; everything between them is overwritten by the build:

```html
<!-- partial:info-header active=faq --> … <!-- /partial:info-header -->
```

| Partial | Used by |
|---|---|
| `landing-header`, `landing-footer` | `index.html`, `top.html` |
| `info-header`, `info-footer`, `info-chrome-css` | every other page (FAQ, legal, changelog, invite, 404) |

`active=KEY` marks the nav link with `data-nav="KEY"` as the current page
(`features`, `top`, `faq`, `privacy`). All links in partials are root-relative
(`/faq.html`) because `404.html` is served at arbitrary paths.

## Icons

Write `<svg class="icon" data-icon="NAME"></svg>` and run the build; it inlines
the [Lucide](https://lucide.dev/icons) icon NAME (1em square, `currentColor`,
1.75 stroke). Attributes written on the tag override the defaults
(e.g. `width="20" height="20"`). Brand marks Lucide doesn't ship live in
`scripts/icons/` (currently `apple`). Don't reintroduce an icon font.

## Watch-outs

- `404.html` also serves `/invite/<code>` deep links (it redirects to
  `/invite/?code=…`), and its `<head>` OG tags are what link previews show for
  shared invites.
- `top.html`'s Top 10 list is refreshed periodically. Use `data-icon` SVGs for
  any new card icons and run `npm run build` before committing.
- The homepage QR code (desktop only) encodes `https://repworkout.app/get`. `get/index.html`
  redirects iPhone/iPad to the App Store and Android to Google Play, and shows both
  buttons to everyone else. Keep that URL stable: printed or screenshotted codes depend on it.
- Store buttons follow the contract in `assets/store-links.js` (`data-store-*`).
