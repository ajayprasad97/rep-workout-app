// Rewrites the site's committed HTML in place. There is no output directory:
// GitHub Pages serves the repo as-is, so run this after editing and commit
// the result.
//
//   npm run build   rewrite files
//   npm run check   exit 1 if any file is out of date (used by CI)
//
// 1. Partials. Everything between
//      <!-- partial:NAME [active=KEY] -->  …  <!-- /partial:NAME -->
//    is replaced with partials/NAME.html. With active=KEY, the element in the
//    partial carrying data-nav="KEY" gets aria-current="page".
//
// 2. Icons. Every <svg … data-icon="NAME"></svg> is filled with the Lucide
//    icon NAME (https://lucide.dev/icons, ISC licence), or with
//    scripts/icons/NAME.svg if that exists (brand marks Lucide doesn't ship).
//    Attributes written on the tag win over the defaults below, so
//    <svg class="icon" data-icon="flame" stroke-width="2.5"></svg> works.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LUCIDE_DIR = join(ROOT, 'node_modules/lucide-static/icons');
const LOCAL_ICON_DIR = join(ROOT, 'scripts/icons');
const CHECK = process.argv.includes('--check');

const ICON_DEFAULTS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.75',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
};

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (['node_modules', 'partials', '.git'].includes(e.name)) return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[m[1]] = m[2] ?? '';
  return attrs;
}

const iconCache = new Map();
function loadIcon(name) {
  if (iconCache.has(name)) return iconCache.get(name);
  const local = join(LOCAL_ICON_DIR, `${name}.svg`);
  const file = existsSync(local) ? local : join(LUCIDE_DIR, `${name}.svg`);
  if (!existsSync(file)) {
    if (!existsSync(LUCIDE_DIR)) throw new Error('lucide-static is missing: run `npm ci` first.');
    throw new Error(`Unknown icon "${name}". Browse names at https://lucide.dev/icons or add scripts/icons/${name}.svg.`);
  }
  const src = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const m = src.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/);
  // Local brand icons may set their own fill/stroke; Lucide's own attrs are
  // the same as ICON_DEFAULTS so they're ignored.
  const own = existsSync(local) ? parseAttrs(m[1]) : {};
  delete own.class; delete own.width; delete own.height; delete own.xmlns;
  const inner = m[2].split('\n').map((l) => l.trim()).filter(Boolean).join('');
  const icon = { attrs: own, inner };
  iconCache.set(name, icon);
  return icon;
}

function renderIcons(html) {
  return html.replace(/<svg\b([^>]*\bdata-icon="([\w-]+)"[^>]*)>[\s\S]*?<\/svg>/g, (_, rawAttrs, name) => {
    const icon = loadIcon(name);
    const written = parseAttrs(rawAttrs);
    const attrs = { ...ICON_DEFAULTS, ...icon.attrs, ...written };
    const order = ['class', 'data-icon', ...Object.keys(attrs).filter((k) => k !== 'class' && k !== 'data-icon')];
    const attrStr = order.filter((k) => k in attrs).map((k) => `${k}="${attrs[k]}"`).join(' ');
    return `<svg ${attrStr}>${icon.inner}</svg>`;
  });
}

function renderPartials(html, file) {
  return html.replace(
    /(<!-- partial:([\w-]+)((?: [\w-]+=[\w-]+)*) -->)[\s\S]*?(<!-- \/partial:\2 -->)/g,
    (_, open, name, params, close) => {
      const path = join(ROOT, 'partials', `${name}.html`);
      if (!existsSync(path)) throw new Error(`${relative(ROOT, file)}: unknown partial "${name}"`);
      let body = readFileSync(path, 'utf8').trimEnd();
      const { active } = Object.fromEntries(params.trim().split(/\s+/).filter(Boolean).map((p) => p.split('=')));
      if (active) {
        const marker = `data-nav="${active}"`;
        if (!body.includes(marker)) throw new Error(`${relative(ROOT, file)}: partial "${name}" has no ${marker}`);
        body = body.replace(marker, `${marker} aria-current="page"`);
      }
      return `${open}\n${body}\n${close}`;
    },
  );
}

let stale = 0;
for (const file of htmlFiles(ROOT)) {
  const before = readFileSync(file, 'utf8');
  const after = renderIcons(renderPartials(before, file));
  if (after === before) continue;
  stale++;
  if (CHECK) console.error(`out of date: ${relative(ROOT, file)}`);
  else { writeFileSync(file, after); console.log(`updated ${relative(ROOT, file)}`); }
}
if (CHECK && stale) {
  console.error(`\n${stale} file(s) out of date. Run \`npm run build\` and commit the result.`);
  process.exit(1);
}
if (CHECK) console.log('All pages up to date.');
