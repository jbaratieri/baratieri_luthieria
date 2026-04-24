/**
 * Gera uma página HTML estática por instrumento + sitemap.xml.
 * Execute na raiz do projeto: npm run build
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'baratieri_instruments.json');
const IMAGES_ROOT = path.join(ROOT, 'images', 'instrumentos');
const OUT_DIR = path.join(ROOT, 'instrumento');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const BASE_URL = 'https://loja.luthieriabaratieri.com.br';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function plainTextFromHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

function sanitizeStatusClass(status) {
  if (!status) return 'disponivel';
  return status
    .toLowerCase()
    .trim()
    .replace(/ã/g, 'a')
    .replace(/é/g, 'e')
    .replace(/\s/g, '');
}

function schemaAvailability(status) {
  const t = (status || '').toLowerCase();
  if (t.includes('vend')) return 'https://schema.org/OutOfStock';
  if (t.includes('reserv')) return 'https://schema.org/LimitedAvailability';
  return 'https://schema.org/InStock';
}

function listImagesForInstrument(instrumentId) {
  const dir = path.join(IMAGES_ROOT, instrumentId);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const out = [];
  for (let i = 1; i <= 20; i++) {
    for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
      const f = path.join(dir, `${i}.${ext}`);
      if (fs.existsSync(f)) {
        out.push(`../../images/instrumentos/${encodeURIComponent(instrumentId)}/${i}.${ext}`);
        break;
      }
    }
  }
  return out;
}

function whatsappUrl(instrumento) {
  const num = '5545920028659';
  const msg = encodeURIComponent(
    `Olá, gostaria de solicitar um orçamento para o instrumento "${instrumento.nome} ${instrumento.modelo || ''}" (Série: ${instrumento.serie || instrumento.id}).`
  );
  return `https://wa.me/${num}?text=${msg}`;
}

function buildJsonLd(it, pageUrl, imageUrlsAbsolute) {
  const name = `${it.nome} ${it.modelo || ''}`.trim();
  const desc = truncate(plainTextFromHtml(it.obs || it.madeira || name), 500);
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: desc,
    sku: it.serie || it.id,
    url: pageUrl,
    brand: { '@type': 'Brand', name: 'Baratieri Luthieria' },
    offers: {
      '@type': 'Offer',
      availability: schemaAvailability(it.status),
      priceCurrency: 'BRL',
      url: pageUrl,
      seller: { '@type': 'Organization', name: 'Baratieri Luthieria' },
    },
  };
  if (imageUrlsAbsolute.length) obj.image = imageUrlsAbsolute;
  return JSON.stringify(obj);
}

function generateInstrumentHtml(it, relImages) {
  const id = it.id;
  const title = escapeHtml(`${it.nome} ${it.modelo || ''}`.trim() + ' — Baratieri Luthieria');
  const h1 = escapeHtml(`${it.nome} ${it.modelo || ''}`.trim());
  const pagePath = `/instrumento/${id}/`;
  const pageUrl = `${BASE_URL}${pagePath}`;
  const descSrc = plainTextFromHtml(it.obs || it.madeira || '');
  const metaDesc = escapeHtml(truncate(descSrc || `${it.nome} — instrumento artesanal Baratieri Luthieria.`, 155));
  const statusClass = sanitizeStatusClass(it.status);
  const statusLabel = escapeHtml(it.status || 'Disponível');
  const absImages = relImages.map((src) => `${BASE_URL}/${src.replace(/^\.\.\/\.\.\//, '')}`);

  const hero = relImages[0]
    ? `<img id="ficha-hero" class="ficha-hero-img" src="${escapeHtml(relImages[0])}" alt="${h1}" width="900" height="600" fetchpriority="high" />`
    : `<div class="ficha-no-photo">Fotos em breve — entre em contato pelo WhatsApp.</div>`;

  const thumbs =
    relImages.length > 1
      ? `<div class="ficha-thumbs" role="list">${relImages
          .map(
            (src, idx) =>
              `<button type="button" class="ficha-thumb${idx === 0 ? ' is-active' : ''}" data-src="${escapeHtml(
                src
              )}" aria-label="Foto ${idx + 1}"><img src="${escapeHtml(src)}" alt="" loading="lazy" width="120" height="120" /></button>`
          )
          .join('')}</div>`
      : '';

  const obsBlock = it.obs
    ? `<div class="ficha-body instrument-prose">${it.obs}</div>`
    : '';

  const jsonLd = buildJsonLd(it, pageUrl, absImages).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="product" />
  <meta property="og:locale" content="pt_BR" />
  ${absImages[0] ? `<meta property="og:image" content="${escapeHtml(absImages[0])}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${metaDesc}" />
  ${absImages[0] ? `<meta name="twitter:image" content="${escapeHtml(absImages[0])}" />` : ''}
  <link rel="icon" href="/logos/favicon.png" />
  <link rel="stylesheet" href="../../vitrine.css" />
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body class="instrument-page">
  <header class="app-header ficha-header">
    <div class="brand ficha-brand">
      <a href="../../" class="ficha-brand-link"><img src="../../logos/logotipo.png" alt="Luthieria Baratieri" class="logo-header ficha-logo" /></a>
      <p class="ficha-tagline">Artesanato e excelência em cada instrumento.</p>
    </div>
    <nav class="ficha-nav" aria-label="Navegação da loja">
      <a href="../../">Início</a>
      <a href="../../#vitrine">Vitrine</a>
      <a href="https://wa.me/5545920028659" target="_blank" rel="noopener">WhatsApp</a>
    </nav>
  </header>

  <main class="wrap ficha-main">
    <nav class="ficha-breadcrumb" aria-label="Navegação">
      <a href="../../">Início</a>
      <span aria-hidden="true"> / </span>
      <a href="../../#vitrine">Instrumentos</a>
      <span aria-hidden="true"> / </span>
      <span>${h1}</span>
    </nav>

    <article>
      <h1 class="ficha-title">${h1}</h1>
      <p class="ficha-meta">
        <span class="status-tag ${escapeHtml(statusClass)}">${statusLabel}</span>
        ${it.serie ? `<span class="ficha-serie">Série: ${escapeHtml(it.serie)}</span>` : ''}
        ${it.linha ? `<span class="ficha-linha">${escapeHtml(it.linha)}</span>` : ''}
        ${it.ano ? `<span class="ficha-ano">${escapeHtml(it.ano)}</span>` : ''}
      </p>

      <div class="ficha-layout">
        <div class="ficha-gallery-block">
          <div class="ficha-hero">${hero}</div>
          ${thumbs}
        </div>
        <div class="ficha-side">
          <dl class="ficha-dl">
            ${it.madeira ? `<dt>Madeiras / materiais</dt><dd>${escapeHtml(it.madeira)}</dd>` : ''}
            <dt>Identificação</dt><dd>${escapeHtml(it.serie || it.id)}</dd>
          </dl>
          <p class="ficha-cta-wrap">
            <a class="btn-whatsapp" href="${escapeHtml(whatsappUrl(it))}" target="_blank" rel="noopener">Solicitar orçamento no WhatsApp</a>
          </p>
        </div>
      </div>

      ${obsBlock}

      <p class="ficha-back"><a href="../../#vitrine">← Voltar à vitrine</a></p>
    </article>
  </main>

  <footer class="footer ficha-footer-min">
    <p class="footer-copy">&copy; 2026 Luthieria Baratieri</p>
  </footer>
  ${
    relImages.length > 1
      ? `<script>
(function(){
  var hero=document.getElementById('ficha-hero');
  if(!hero)return;
  document.querySelectorAll('.ficha-thumb').forEach(function(btn){
    btn.addEventListener('click',function(){
      var src=btn.getAttribute('data-src');
      if(src)hero.src=src;
      document.querySelectorAll('.ficha-thumb').forEach(function(b){b.classList.remove('is-active');});
      btn.classList.add('is-active');
    });
  });
})();
</script>`
      : ''
  }
</body>
</html>
`;
}

function writeSitemap(urls) {
  const lines = urls
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u.endsWith('/') && !u.includes('/instrumento/') ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('\n\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Gerado por scripts/build-instrument-pages.mjs — npm run build -->

${lines}

</urlset>
`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('Arquivo não encontrado:', DATA_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  let instruments;
  try {
    instruments = JSON.parse(raw);
  } catch (e) {
    console.error('JSON inválido em', DATA_PATH, e.message);
    process.exit(1);
  }
  if (!Array.isArray(instruments)) {
    console.error('JSON deve ser um array de instrumentos.');
    process.exit(1);
  }

  const idSet = new Set(instruments.map((i) => i.id).filter(Boolean));

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of fs.readdirSync(OUT_DIR)) {
    const full = path.join(OUT_DIR, name);
    if (fs.statSync(full).isDirectory() && !idSet.has(name)) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log('Removido (não está mais no JSON):', name);
    }
  }

  const sitemapUrls = [`${BASE_URL}/`];

  for (const it of instruments) {
    if (!it || !it.id) continue;
    const dir = path.join(OUT_DIR, it.id);
    fs.mkdirSync(dir, { recursive: true });
    const relImages = listImagesForInstrument(it.id);
    const html = generateInstrumentHtml(it, relImages);
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    sitemapUrls.push(`${BASE_URL}/instrumento/${encodeURIComponent(it.id)}/`);
    console.log('OK', it.id, relImages.length, 'imagens');
  }

  writeSitemap(sitemapUrls);
  console.log('Sitemap:', sitemapUrls.length, 'URLs →', SITEMAP_PATH);
}

main();
