(function () {
  'use strict';

  const LS_KEY = 'baratieri_instruments_v1';
  const DATA_URL = '../data/baratieri_instruments.json';

  const CERT_SPECS = [
    ['Tampo', 'tampo'],
    ['Fundo e laterais', 'fundoLaterais'],
    ['Braço', 'braco'],
    ['Escala', 'escala'],
    ['Cavalete', 'cavalete'],
    ['Tarraxas', 'tarraxas'],
    ['Filetes', 'filetes'],
    ['Acabamento', 'acabamento'],
    ['Trastes', 'trastes'],
    ['Nut', 'nut'],
    ['Rastilho', 'rastilho'],
    ['Headstock', 'headstock'],
    ['Bitola máxima', 'bitolaMax'],
    ['Captação', 'captacao'],
  ];

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function val(it, key) {
    const v = it[key];
    if (v == null) return '';
    return String(v).trim();
  }

  function migrateLegacyHardware(it) {
    const hasSplit = ['nut', 'rastilho', 'trastes', 'headstock'].some((k) => val(it, k));
    if (hasSplit) return it;
    const hw = val(it, 'hardware');
    if (!hw) return it;
    const out = Object.assign({}, it);
    if (/osso/i.test(hw)) {
      if (!val(out, 'nut')) out.nut = 'Osso legítimo';
      if (!val(out, 'rastilho')) out.rastilho = 'Osso legítimo';
    }
    if (/trastes?\s+dourados/i.test(hw) && !val(out, 'trastes')) out.trastes = 'Dourados';
    if (/headstock/i.test(hw) && !val(out, 'headstock')) {
      const m = hw.match(/headstock\s+([^,.]+)/i);
      if (m) out.headstock = m[1].trim();
    }
    return out;
  }

  function tipoInstrumento(modelo) {
    const m = (modelo || '').toLowerCase();
    if (m.includes('viola')) return { artigo: 'esta', nome: 'viola' };
    if (m.includes('cavaquinho')) return { artigo: 'este', nome: 'cavaquinho' };
    if (m.includes('ukulele')) return { artigo: 'este', nome: 'ukulele' };
    return { artigo: 'este', nome: 'violão' };
  }

  function isShellacFinish(acabamento) {
    return /goma\s*laca|french\s*polish|polimento\s*franc/i.test(acabamento || '');
  }

  function specPairs(it) {
    const pairs = CERT_SPECS
      .map(([label, key]) => ({ label, value: val(it, key) }))
      .filter((p) => p.value);
    if (!pairs.some((p) => ['Trastes', 'Nut', 'Rastilho', 'Headstock'].includes(p.label)) && val(it, 'hardware')) {
      pairs.push({ label: 'Hardware', value: val(it, 'hardware') });
    }
    return pairs;
  }

  function loadFromStorage(id) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.find((i) => i && i.id === id) : null;
    } catch (e) {
      return null;
    }
  }

  async function loadFromJson(id) {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('Falha ao ler o JSON dos instrumentos');
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('JSON inválido');
    return list.find((i) => i && i.id === id) || null;
  }

  function renderCertificate(it) {
    const serie = val(it, 'serie') || val(it, 'id');
    const ano = val(it, 'ano') || '2026';
    const nome = val(it, 'nome');
    const modelo = val(it, 'modelo');
    const linha = val(it, 'linha');
    const comprador = val(it, 'comprador');
    const tipo = tipoInstrumento(modelo);
    const acabamento = val(it, 'acabamento');
    const bitola = val(it, 'bitolaMax');
    const pairs = specPairs(it);

    const kindLine = modelo
      ? (linha ? `${modelo} Baratieri — Linha ${linha}` : `${modelo} Baratieri`)
      : (linha ? `Linha ${linha}` : 'Instrumento artesanal Baratieri');

    let attestation = `Certifico que o instrumento acima, identificado pela série ${serie}, foi integralmente projetado e construído à mão por mim, em minha oficina em Terra Roxa, Paraná, no ano de ${ano}, utilizando técnicas tradicionais de lutheria e madeiras selecionadas individualmente.`;
    if (comprador) {
      attestation += ` ${tipo.artigo.charAt(0).toUpperCase() + tipo.artigo.slice(1)} ${tipo.nome} foi batizado em homenagem ao seu proprietário, ${comprador}, para quem foi feito sob medida.`;
    }

    const specsHtml = pairs.map((p) => (
      `<div class="spec"><span class="spec-label">${escapeHtml(p.label)}:</span><span class="spec-value">${escapeHtml(p.value)}</span></div>`
    )).join('');

    let careHtml = `<p><strong>Limpeza:</strong> use apenas um pano seco, macio e limpo (flanela ou microfibra) para remover poeira e o suor deixado pelas mãos após tocar. Passe o pano sempre na direção do veio da madeira, sem pressionar.</p>`;

    if (isShellacFinish(acabamento)) {
      careHtml += `<p>Nunca use álcool ou produtos à base de álcool: o acabamento deste ${tipo.nome} é feito em polimento francês, uma técnica artesanal com goma-laca aplicada em finas camadas. O álcool dissolve a goma-laca e danifica permanentemente o acabamento, manchando ou removendo o brilho da madeira. Evite também outros solventes, produtos de limpeza multiuso e panos umedecidos com produtos químicos.</p>
      <p>Evite também silicone, ceras automotivas e polidores comerciais para móveis — não são formulados para acabamentos em goma-laca e podem opacar ou craquelar a superfície com o tempo. Se precisar de um cuidado mais aprofundado no acabamento, procure a Luthieria Baratieri.</p>`;
    } else if (acabamento) {
      careHtml += `<p>Nunca use álcool, solventes, produtos de limpeza multiuso nem polidores comerciais para móveis. Esses produtos podem manchar ou opacar o acabamento (${escapeHtml(acabamento)}). Se precisar de um cuidado mais aprofundado, procure a Luthieria Baratieri.</p>`;
    }

    careHtml += `<p><strong>Armazenamento:</strong> guarde o instrumento no estojo/case quando não estiver em uso, em ambiente com temperatura estável, longe de luz solar direta, fontes de calor e variações bruscas de umidade — fatores que afetam tanto a madeira quanto o acabamento.</p>`;

    if (bitola) {
      careHtml += `<p><strong>Encordoamento recomendado:</strong> para preservar a estrutura do braço e a resposta sonora para a qual este instrumento foi construído, utilize preferencialmente cordas com bitola até ${escapeHtml(bitola)}. Bitolas mais grossas aumentam a tensão sobre o tampo e o braço além do previsto no projeto original, podendo comprometer a afinação, a ação das cordas e, a longo prazo, a própria estrutura do instrumento.</p>`;
    }

    const sheet = $('sheet');
    sheet.hidden = false;
    sheet.innerHTML = `
      <article class="cert">
        <p class="ornament">✦ ◆ ✦</p>
        <div class="logo-wrap"><img src="../logos/logotipo.png" alt="Luthieria Baratieri" /></div>
        <p class="brand-line">Luthieria Baratieri</p>
        <p class="tagline">Terra Roxa, Paraná, Brasil — Instrumentos artesanais feitos à mão</p>
        <h1 class="title">Certificado de Autenticidade</h1>
        <p class="subtitle">Instrumento artesanal feito à mão, peça única</p>
        <h2 class="inst-name">“${escapeHtml(nome)}”</h2>
        <p class="inst-kind">${escapeHtml(kindLine)}</p>
        <p class="attestation">${escapeHtml(attestation)}</p>
        <h3 class="section-title">Especificações do Instrumento</h3>
        <div class="specs">${specsHtml}</div>
        <h3 class="section-title">Cuidados e Manutenção</h3>
        <div class="care">${careHtml}</div>
        <div class="sign">
          <p class="sign-name">Jacir Paulo Baratieri</p>
          <p class="sign-role">Luthier responsável pela construção</p>
          <p class="foot">Série ${escapeHtml(serie)} • Ano ${escapeHtml(ano)} • Terra Roxa, Paraná, Brasil</p>
        </div>
      </article>
    `;

    document.title = `Certificado_${nome.replace(/\s+/g, '_')}_${serie}`;
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const id = (params.get('id') || '').trim();
    const status = $('toolbar-status');
    const error = $('error');
    const btn = $('btnPrint');

    if (btn) btn.addEventListener('click', () => window.print());

    if (!id) {
      error.hidden = false;
      error.textContent = 'Abra o certificado pelo botão no admin, ou use ?id=BL-XXXX na URL.';
      return;
    }

    let it = loadFromStorage(id);
    let source = 'admin (navegador)';
    if (!it) {
      try {
        it = await loadFromJson(id);
        source = 'JSON da loja';
      } catch (e) {
        error.hidden = false;
        error.textContent = 'Não foi possível carregar o instrumento: ' + (e.message || e);
        return;
      }
    }

    if (!it) {
      error.hidden = false;
      error.textContent = 'Instrumento ' + id + ' não encontrado no admin nem no JSON da loja.';
      return;
    }

    it = migrateLegacyHardware(it);
    renderCertificate(it);
    if (status) status.textContent = source;
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((e) => {
      const error = $('error');
      if (error) {
        error.hidden = false;
        error.textContent = 'Erro ao gerar o certificado: ' + (e && e.message ? e.message : e);
      }
    });
  });
})();
