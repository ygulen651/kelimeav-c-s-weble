// Kelime Avcısı — bağımlılıksız statik site derleyicisi.
// Kullanım: node build.mjs        → dist/ klasörünü üretir
//           node build.mjs --serve → derler ve http://localhost:4321 adresinde sunar
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const read = (p) => readFileSync(join(SRC, p), 'utf8');

const config = JSON.parse(read('config.json'));
const warnings = [];

// ---------- yardımcılar ----------
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const get = (ctx, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const trDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${AYLAR[m - 1]} ${y}`;
};

const siteUrl = config.site.url.replace(/\/$/, '');

// ---------- mağaza butonları ----------
const ICONS = {
  apple: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.58 1.1 8.73.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.3-3.48zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#00A173" d="M4.3 2.6 13.6 12l-9.3 9.4c-.4-.2-.6-.7-.6-1.2V3.8c0-.5.2-1 .6-1.2z"/><path fill="#FFC633" d="m16.8 15.2-3.2-3.2 3.2-3.2 3.7 2.1c1.1.6 1.1 1.6 0 2.2l-3.7 2.1z"/><path fill="#EF4A3E" d="M16.8 15.2 13.6 12l-9.3 9.4c.3.2.8.2 1.3-.1l11.2-6.1z"/><path fill="#3B82F6" d="M16.8 8.8 5.6 2.7c-.5-.3-1-.3-1.3-.1l9.3 9.4 3.2-3.2z"/></svg>',
};

function storeButtons() {
  const items = [
    { key: 'appStore', icon: ICONS.apple, small: "App Store'dan", label: 'İndir', store: 'App Store' },
    { key: 'googlePlay', icon: ICONS.play, small: "Google Play'den", label: 'İndir', store: 'Google Play' },
  ];
  const html = items.map((it) => {
    const url = config.stores[it.key];
    if (url) {
      return `<a class="store" href="${esc(url)}" rel="noopener">${it.icon}<span><small>${it.small}</small><strong>${it.label}</strong></span></a>`;
    }
    return `<span class="store store--soon" role="img" aria-label="${it.store} sürümü yakında">${it.icon}<span><small>${it.store}</small><strong>Yakında</strong></span></span>`;
  }).join('');
  return `<div class="stores">${html}</div>`;
}
const anyStore = Boolean(config.stores.appStore || config.stores.googlePlay);

// ---------- SSS ----------
function faqHtml() {
  return `<div class="faq">${config.faq.map((f, i) => `
    <details class="faq__item"${i === 0 ? ' open' : ''}>
      <summary><span>${esc(f.q)}</span><span class="faq__icon" aria-hidden="true"></span></summary>
      <div class="faq__body"><p>${f.a}</p></div>
    </details>`).join('')}
  </div>`;
}

// ---------- duraklar ----------
function stopsHtml() {
  return config.stops.map((s) => `
    <li class="stop">
      <span class="stop__pin" aria-hidden="true">${s.no}</span>
      <span class="stop__name">${esc(s.name)}</span>
      <span class="stop__meta">Durak ${String(s.no).padStart(2, '0')}</span>
    </li>`).join('') + (config.moreStopsComing ? `
    <li class="stop stop--more">
      <span class="stop__pin" aria-hidden="true">+</span>
      <span class="stop__name">Yeni duraklar</span>
      <span class="stop__meta">Yolda</span>
    </li>` : '');
}

// ---------- geliştirenler ----------
function creditsHtml() {
  return config.credits.map((c) => `<a class="${c.theme.split(' ').map((t) => `credit--${t}`).join(' ')} credit" href="${esc(c.url)}" rel="noopener" aria-label="${esc(c.name)} (yeni sitede açılır)" target="_blank">
      <img src="${esc(c.logo)}" alt="${esc(c.name)}" width="${c.width}" height="${c.height}" loading="lazy">
    </a>`).join('');
}

// ---------- şablon motoru ----------
function render(tpl, ctx, depth = 0) {
  if (depth > 10) throw new Error('Şablon derinliği aşıldı');
  // parçalar: {{> ad}}
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => render(read(`partials/${name}.html`), ctx, depth + 1));
  // koşullar (iç içe olmayan): {{#if a}}…{{else}}…{{/if}}
  let prev;
  do {
    prev = tpl;
    tpl = tpl.replace(/\{\{#if\s+([\w.]+)\s*\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g, (_, key, body) => {
      const [yes, no = ''] = body.split('{{else}}');
      return get(ctx, key) ? yes : no;
    });
  } while (tpl !== prev);
  tpl = tpl.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => {
    const v = get(ctx, k);
    if (v === undefined) throw new Error(`Tanımsız değer: ${k}`);
    return String(v);
  });
  tpl = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = get(ctx, k);
    if (v === undefined) throw new Error(`Tanımsız değer: ${k}`);
    return esc(v);
  });
  return tpl;
}

function parsePage(file) {
  const raw = read(`pages/${file}`);
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m ? raw.slice(m[0].length) : raw };
}

// ---------- derleme ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.jpg']) {
  if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(DIST, f));
}

const baseCtx = {
  ...config,
  year: new Date().getFullYear(),
  lastUpdatedText: trDate(config.site.lastUpdated),
  storeButtons: storeButtons(),
  anyStore,
  faqHtml: faqHtml(),
  creditsHtml: creditsHtml(),
  stopsHtml: stopsHtml(),
  stopsListHtml: config.stops.map((s) => `<li>${esc(s.name)}</li>`).join(''),
  moreStopsComing: Boolean(config.moreStopsComing),
  hasFormEndpoint: Boolean(config.contact.formEndpoint),
  hasDeveloperSite: Boolean(config.developer.website),
};

const pages = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const sitemap = [];
const draftReport = [];

for (const file of pages) {
  const { meta, body } = parsePage(file);
  const path = meta.path;
  const page = {
    ...meta,
    canonical: siteUrl + path,
    fullTitle: path === '/' ? `${config.site.name} — ${config.site.tagline}` : `${meta.title} | ${config.site.name}`,
    isHome: path === '/',
    isLegal: meta.legal === 'true',
    noindex: meta.sitemap === 'false',
  };
  const ctx = { ...baseCtx, page };
  const content = render(body, ctx);
  let html = render(read('layout.html'), { ...ctx, content });

  // menüde etkin sayfa
  html = html.replace(/<a([^>]*?)href="([^"]+)"([^>]*?)data-nav>/g, (all, a, href, b) =>
    `<a${a}href="${href}"${b}${href === path ? ' aria-current="page"' : ''}>`);

  // hukuki metinlerdeki "doğrulanacak" işaretleri raporla
  const marks = [...html.matchAll(/<mark class="dogrula"[^>]*>([\s\S]*?)<\/mark>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  if (marks.length) draftReport.push({ path, marks });

  const outFile = file === 'index.html' ? 'index.html' : file === '404.html' ? '404.html' : join(file.replace('.html', ''), 'index.html');
  mkdirSync(dirname(join(DIST, outFile)), { recursive: true });
  writeFileSync(join(DIST, outFile), html);
  if (meta.sitemap !== 'false') sitemap.push({ loc: siteUrl + path, priority: path === '/' ? '1.0' : '0.6' });
}

writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${config.site.lastUpdated}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`);

writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`);

writeFileSync(join(DIST, 'site.webmanifest'), JSON.stringify({
  name: config.site.name,
  short_name: config.site.name,
  lang: config.site.lang,
  start_url: '/',
  display: 'browser',
  background_color: '#FFFBF2',
  theme_color: config.site.themeColor,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2));

// Netlify / Cloudflare Pages güvenlik başlıkları
const formOrigin = config.contact.formEndpoint ? new URL(config.contact.formEndpoint).origin : '';
writeFileSync(join(DIST, '_headers'), `/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'${formOrigin ? ' ' + formOrigin : ''}; form-action 'self'${formOrigin ? ' ' + formOrigin : ''} mailto:; frame-ancestors 'none'; base-uri 'self'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

// ---------- uyarılar ----------
if (/\.example\b/.test(config.site.url)) warnings.push(`site.url hâlâ örnek değer (${config.site.url}). Gerçek alan adını yazın.`);
if (/\.example\b/.test(config.contact.email)) warnings.push(`contact.email hâlâ örnek değer (${config.contact.email}).`);
if (/^\[/.test(config.developer.name)) warnings.push('developer.name doldurulmamış.');
if (/^\[/.test(config.developer.address)) warnings.push('developer.address doldurulmamış (KVKK aydınlatma için gerekli).');
if (!anyStore) warnings.push('Mağaza bağlantıları boş — butonlar "Yakında" olarak gösteriliyor.');
if (!existsSync(join(SRC, 'og-image.jpg'))) warnings.push('src/og-image.jpg bulunamadı (sosyal paylaşım görseli).');

console.log(`✓ ${pages.length} sayfa derlendi → dist/`);
if (draftReport.length) {
  const total = draftReport.reduce((n, r) => n + r.marks.length, 0);
  console.log(`\n⚠ Yayından önce doğrulanması gereken ${total} işaretli ifade var:`);
  for (const r of draftReport) {
    console.log(`  ${r.path}`);
    for (const m of r.marks) console.log(`    • ${m}`);
  }
}
if (warnings.length) {
  console.log('\n⚠ Yapılandırma uyarıları:');
  for (const w of warnings) console.log(`  • ${w}`);
}

// ---------- yerel önizleme ----------
if (process.argv.includes('--serve')) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(DIST, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!f.startsWith(DIST) || !existsSync(f)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(readFileSync(join(DIST, '404.html')));
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  }).listen(4321, () => console.log('\n→ http://localhost:4321'));
}
