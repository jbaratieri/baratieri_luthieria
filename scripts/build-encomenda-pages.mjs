/**
 * Gera páginas de encomenda (índice + um HTML por modelo) e atualiza sitemap.xml.
 * Execute: npm run build (após ou junto com build-instrument-pages)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'modelos_encomenda.json');
const INSTRUMENTS_PATH = path.join(ROOT, 'data', 'baratieri_instruments.json');
const OUT_DIR = path.join(ROOT, 'encomenda');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const BASE_URL = 'https://loja.luthieriabaratieri.com.br';
const WHATSAPP = '5545920028659';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function whatsappHref(msg) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

function cssHref(depth) {
  return depth === 0 ? '../vitrine.css' : '../../vitrine.css';
}

function assetPrefix(depth) {
  return depth === 0 ? '../' : '../../';
}

function siteHeader(depth) {
  const p = assetPrefix(depth);
  const encomendaSelf = depth === 0 ? './' : '../';
  return `
  <header class="app-header ficha-header">
    <div class="brand ficha-brand">
      <a href="${p}" class="ficha-brand-link"><img src="${p}logos/logotipo.png" alt="Luthieria Baratieri" class="logo-header ficha-logo" /></a>
      <p class="ficha-tagline">Artesanato e excelência em cada instrumento.</p>
    </div>
    <nav class="ficha-nav" aria-label="Navegação da loja">
      <a href="${p}">Início</a>
      <a href="${p}#vitrine">Vitrine</a>
      <a href="${encomendaSelf}" class="ficha-nav-active">Sob encomenda</a>
      <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a>
    </nav>
  </header>`;
}

function siteFooter() {
  return `
  <footer class="footer ficha-footer-min">
    <p class="footer-copy">&copy; 2026 Luthieria Baratieri</p>
  </footer>`;
}

function jsonLdWebPage(name, description, url) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name,
        description,
        url,
        inLanguage: 'pt-BR',
        isPartOf: { '@type': 'WebSite', name: 'Baratieri Luthieria', url: `${BASE_URL}/` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Sob encomenda', item: `${BASE_URL}/encomenda/` },
          ...(name !== 'Sob encomenda'
            ? [{ '@type': 'ListItem', position: 3, name, item: url }]
            : []),
        ],
      },
    ],
  }).replace(/</g, '\\u003c');
}

function generateIndexPage(index, modelos) {
  const pageUrl = `${BASE_URL}/encomenda/`;
  const title = escapeHtml(index.title);
  const metaDesc = escapeHtml(index.metaDescription);
  const cards = modelos
    .map(
      (m) => `
      <a class="modelo-card" href="./${escapeHtml(m.slug)}/">
        <span class="modelo-card-tagline">${escapeHtml(m.tagline)}</span>
        <h2 class="modelo-card-title">${escapeHtml(m.nome)}</h2>
        <p class="modelo-card-teaser">${escapeHtml(m.intro.slice(0, 140))}…</p>
        <span class="modelo-card-link">Ver formato e especificações →</span>
      </a>`
    )
    .join('');

  const pillars = index.pillars
    .map(
      (p) => `
      <div class="encomenda-pillar">
        <h3>${escapeHtml(p.titulo)}</h3>
        <p>${escapeHtml(p.texto)}</p>
      </div>`
    )
    .join('');

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
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="pt_BR" />
  <link rel="icon" href="/logos/favicon.png" />
  <link rel="stylesheet" href="${cssHref(0)}" />
  <script type="application/ld+json">${jsonLdWebPage('Sob encomenda', index.metaDescription, pageUrl)}</script>
</head>
<body class="instrument-page encomenda-page">
${siteHeader(0)}
  <main class="wrap ficha-main">
    <nav class="ficha-breadcrumb" aria-label="Navegação">
      <a href="../">Início</a>
      <span class="ficha-bc-sep" aria-hidden="true">/</span>
      <span class="ficha-breadcrumb-current">Sob encomenda</span>
    </nav>
    <article>
      <h1 class="ficha-title">${escapeHtml(index.heroTitle)}</h1>
      <p class="encomenda-lead">${escapeHtml(index.heroLead)}</p>
      <div class="encomenda-pillars">${pillars}</div>
      <h2 class="encomenda-section-title">Formatos disponíveis</h2>
      <p class="catalog-intro">Escolha o tipo de instrumento para entender características, madeiras típicas e como solicitar orçamento.</p>
      <div class="encomenda-modelos-grid">${cards}</div>
      <p class="encomenda-cta-wrap">
        <a class="btn-whatsapp" href="${escapeHtml(whatsappHref('Olá, gostaria de informações sobre instrumentos sob encomenda na Baratieri Luthieria.'))}" target="_blank" rel="noopener">Falar sobre encomenda no WhatsApp</a>
      </p>
      <p class="ficha-back"><a href="../#vitrine">Ver instrumentos prontos na vitrine</a></p>
    </article>
  </main>
${siteFooter()}
</body>
</html>`;
}

function generateModeloPage(m) {
  const pageUrl = `${BASE_URL}/encomenda/${m.slug}/`;
  const title = `${m.nome} sob encomenda — Baratieri Luthieria`;
  const metaDesc = escapeHtml(m.metaDescription);
  const h1 = escapeHtml(m.nome);

  const destaques = m.destaques.map((d) => `<li>${escapeHtml(d)}</li>`).join('');
  const specs = m.especificacoes
    .map(
      (s) => `
      <div class="encomenda-spec-item">
        <h3>${escapeHtml(s.titulo)}</h3>
        <p>${escapeHtml(s.texto)}</p>
      </div>`
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="pt_BR" />
  <link rel="icon" href="/logos/favicon.png" />
  <link rel="stylesheet" href="${cssHref(1)}" />
  <script type="application/ld+json">${jsonLdWebPage(m.nome, m.metaDescription, pageUrl)}</script>
</head>
<body class="instrument-page encomenda-page">
${siteHeader(1)}
  <main class="wrap ficha-main">
    <nav class="ficha-breadcrumb" aria-label="Navegação">
      <a href="../../">Início</a>
      <span class="ficha-bc-sep" aria-hidden="true">/</span>
      <a href="../">Sob encomenda</a>
      <span class="ficha-bc-sep" aria-hidden="true">/</span>
      <span class="ficha-breadcrumb-current">${h1}</span>
    </nav>
    <article>
      <p class="encomenda-tagline">${escapeHtml(m.tagline)}</p>
      <h1 class="ficha-title">${h1}</h1>
      <p class="encomenda-lead">${escapeHtml(m.intro)}</p>
      <ul class="encomenda-destaques">${destaques}</ul>
      <div class="ficha-body instrument-prose encomenda-block">
        <p><strong>Madeiras típicas:</strong> ${escapeHtml(m.madeirasTipicas)}</p>
        <p><strong>Linhas de construção:</strong> ${escapeHtml(m.linhas)}</p>
        <p><strong>Prazo:</strong> ${escapeHtml(m.prazo)}</p>
      </div>
      <h2 class="encomenda-section-title">Especificações do formato</h2>
      <div class="encomenda-specs">${specs}</div>
      <p class="encomenda-cta-wrap">
        <a class="btn-whatsapp" href="${escapeHtml(whatsappHref(m.whatsappMsg))}" target="_blank" rel="noopener">Solicitar orçamento no WhatsApp</a>
      </p>
      <p class="ficha-back"><a href="../">← Todos os formatos sob encomenda</a> · <a href="../../#vitrine">Vitrine (prontos)</a></p>
    </article>
  </main>
${siteFooter()}
</body>
</html>`;
}

function writeSitemap(urls) {
  const lines = urls
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u === `${BASE_URL}/` ? '1.0' : u.includes('/encomenda/') ? '0.85' : '0.8'}</priority>
  </url>`
    )
    .join('\n\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Gerado por scripts/build-encomenda-pages.mjs + instrumentos -->

${lines}

</urlset>
`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}

function collectSitemapUrls(modelos) {
  const urls = [`${BASE_URL}/`, `${BASE_URL}/encomenda/`];
  for (const m of modelos) {
    urls.push(`${BASE_URL}/encomenda/${encodeURIComponent(m.slug)}/`);
  }
  if (fs.existsSync(INSTRUMENTS_PATH)) {
    try {
      const instruments = JSON.parse(fs.readFileSync(INSTRUMENTS_PATH, 'utf8'));
      if (Array.isArray(instruments)) {
        for (const it of instruments) {
          if (it?.id) urls.push(`${BASE_URL}/instrumento/${encodeURIComponent(it.id)}/`);
        }
      }
    } catch (e) {
      console.warn('Aviso: não foi possível ler instrumentos para o sitemap:', e.message);
    }
  }
  return urls;
}

function main() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  const { index, modelos } = data;
  if (!index || !Array.isArray(modelos)) {
    console.error('modelos_encomenda.json precisa de "index" e "modelos"[]');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugSet = new Set(modelos.map((m) => m.slug));

  for (const name of fs.readdirSync(OUT_DIR)) {
    const full = path.join(OUT_DIR, name);
    if (fs.statSync(full).isDirectory() && name !== 'index.html' && !slugSet.has(name)) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log('Removido:', name);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), generateIndexPage(index, modelos), 'utf8');
  console.log('OK encomenda/index.html');

  for (const m of modelos) {
    if (!m.slug) continue;
    const dir = path.join(OUT_DIR, m.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), generateModeloPage(m), 'utf8');
    console.log('OK encomenda/' + m.slug);
  }

  const urls = collectSitemapUrls(modelos);
  writeSitemap(urls);
  console.log('Sitemap:', urls.length, 'URLs');
}

main();
