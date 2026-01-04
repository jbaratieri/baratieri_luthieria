// app.js — versão completa com exclusão individual de fotos no IndexedDB
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    try {
      const log = (...a) => console.log('[baratieri]', ...a);
      const warn = (...a) => console.warn('[baratieri]', ...a);
      const error = (...a) => console.error('[baratieri]', ...a);

      // helper safe getter
      const $id = id => document.getElementById(id) || null;
      const controlsEl = document.querySelector('.controls') || null;

      // expected ids
      const EXPECTED = ['search', 'filterStatus', 'filterLinha', 'tbl', 'tbody', 'form', 'count', 'fotos', 'modal', 'modalContent', 'btnNew', 'btnExport', 'btnImport', 'fileImport', 'save', 'reset', 'closeModal'];
      const missing = EXPECTED.filter(id => !$id(id));
      if (missing.length) warn('Elementos faltando (não-crítico):', missing);

      // constants
      const LS_KEY = 'baratieri_instruments_v1';
      const IMG_DB = 'baratieri_images_v1';
      const IMG_STORE = 'images';
      const sampleLines = ['Araucária', 'Cedro', 'Pau-ferro', 'Manacá', 'Raiz'];

      // elements
      const tbody = $id('tbody');
      const emptyBox = $id('empty');
      const form = $id('form');
      const inputs = ['nome', 'ano', 'modelo', 'status', 'madeira', 'linha', 'serie', 'obs', 'comprador', 'telefone'];
      const countEl = $id('count');
      const searchEl = $id('search');
      const filterStatusEl = $id('filterStatus');
      const filterLinhaEl = $id('filterLinha');
      const btnNew = $id('btnNew');
      const btnExport = $id('btnExport');
      const btnImport = $id('btnImport');
      const fileImport = $id('fileImport');
      const fotosInput = $id('fotos');
      const modal = $id('modal');
      const modalContent = $id('modalContent');
      const closeModal = $id('closeModal');

      // --- IndexedDB helpers ---

      function openDb() {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open(IMG_DB, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IMG_STORE)) {
              const store = db.createObjectStore(IMG_STORE, { keyPath: 'id' });
              store.createIndex('byInstrument', 'instrumentId', { unique: false });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }

      function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });
      }

      function blobToArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(r.error);
          r.readAsArrayBuffer(blob);
        });
      }

      async function saveImageToDb(instrumentId, file) {
        const buffer = await readFileAsArrayBuffer(file);
        const db = await openDb();
        const origBlob = new Blob([buffer], { type: file.type });

        let thumbBuffer = null;
        let thumbType = file.type;
        try {
          const url = URL.createObjectURL(origBlob);
          const img = new Image();
          img.src = url;
          await new Promise((res, rej) => {
            img.onload = () => res();
            img.onerror = rej;
          });
          const max = 400;
          const w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(1, max / Math.max(w, h));
          const cw = Math.max(1, Math.round(w * scale));
          const ch = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          const blobThumb = await new Promise(r => canvas.toBlob(r, file.type || 'image/jpeg', 0.75));
          if (blobThumb) thumbBuffer = await blobToArrayBuffer(blobThumb);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn('thumb generation failed', e);
        }

        return new Promise((res, rej) => {
          const tx = db.transaction(IMG_STORE, 'readwrite');
          const store = tx.objectStore(IMG_STORE);
          const id = instrumentId + '_' + Date.now().toString(36);
          const obj = { id, instrumentId, name: file.name, type: file.type, createdAt: new Date().toISOString(), blob: buffer, thumb: thumbBuffer, thumbType };
          const req = store.add(obj);
          req.onsuccess = () => res(obj);
          req.onerror = () => rej(req.error);
        });
      }

      async function getImagesByInstrument(instrumentId) {
        const db = await openDb();
        return new Promise((res, rej) => {
          const tx = db.transaction(IMG_STORE, 'readonly');
          const store = tx.objectStore(IMG_STORE);
          const idx = store.index('byInstrument');
          const req = idx.getAll(IDBKeyRange.only(instrumentId));
          req.onsuccess = () => {
            const rows = req.result || [];
            const mapped = rows.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, blob: r.blob, type: r.type, thumb: r.thumb, thumbType: r.thumbType }));
            res(mapped);
          };
          req.onerror = () => rej(req.error);
        });
      }

      // NOVO: Excluir uma única foto
      async function deleteSingleImage(imageId) {
        const db = await openDb();
        return new Promise((res, rej) => {
          const tx = db.transaction(IMG_STORE, 'readwrite');
          const store = tx.objectStore(IMG_STORE);
          const req = store.delete(imageId);
          req.onsuccess = () => res(true);
          req.onerror = () => rej(req.error);
        });
      }

      async function deleteImagesByInstrument(instrumentId) {
        const db = await openDb();
        return new Promise((res, rej) => {
          const tx = db.transaction(IMG_STORE, 'readwrite');
          const store = tx.objectStore(IMG_STORE);
          const idx = store.index('byInstrument');
          const req = idx.openCursor(IDBKeyRange.only(instrumentId));
          req.onsuccess = e => {
            const cur = e.target.result;
            if (!cur) { res(true); return; }
            cur.delete();
            cur.continue();
          };
          req.onerror = () => rej(req.error);
        });
      }

      // --- Utils & Storage ---

      function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      }

      function load() { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : [] } catch (e) { warn(e); return [] } }
      function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(instruments)); render(); } catch (e) { error(e); } }

      const DRAFT_KEY = 'baratieri_form_draft_v1';
      function saveDraft() { try { const obj = {}; inputs.forEach(k => { const el = $id(k); obj[k] = el && el.value ? el.value : ''; }); localStorage.setItem(DRAFT_KEY, JSON.stringify(obj)); } catch (e) { warn(e); } }
      function loadDraft() { try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return; const obj = JSON.parse(raw); inputs.forEach(k => { const el = $id(k); if (el && obj[k] !== undefined) el.value = obj[k]; }); } catch (e) { warn(e); } }
      function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { } }

      function sanitizeInstrument(it) {
        const out = Object.assign({}, it);
        ['id', 'serie', 'nome', 'modelo', 'madeira', 'linha', 'ano', 'status', 'comprador', 'telefone', 'obs', 'createdAt'].forEach(k => {
          if (out[k] === null || out[k] === undefined) out[k] = '';
          else if (typeof out[k] !== 'string') out[k] = String(out[k]);
        });
        return out;
      }

      // state
      let instruments = (load() || []).map(sanitizeInstrument);

      inputs.forEach(k => { const el = $id(k); if (el) el.addEventListener('input', saveDraft); });
      loadDraft();

      function uid() { return 'BL-' + Date.now().toString(36).toUpperCase().slice(-6); }

      // --- Render ---

      async function render() {
        if (!tbody) return;
        tbody.innerHTML = '';

        const q = ((searchEl && searchEl.value) ? searchEl.value.toLowerCase().trim() : '');
        const statusF = (filterStatusEl && filterStatusEl.value) ? filterStatusEl.value : '';
        const linhaF = (filterLinhaEl && filterLinhaEl.value) ? filterLinhaEl.value : '';

        const filtered = instruments.filter(i => {
          if (statusF && i.status !== statusF) return false;
          if (linhaF && (i.linha || '') !== linhaF) return false;
          if (!q) return true;
          const hay = (i.nome + ' ' + (i.modelo || '') + ' ' + (i.linha || '') + ' ' + (i.comprador || '') + ' ' + (i.obs || '')).toLowerCase();
          return hay.indexOf(q) !== -1;
        });

        if (filtered.length === 0) { if (emptyBox) emptyBox.style.display = 'block' } else { if (emptyBox) emptyBox.style.display = 'none' }

        for (const i of filtered.slice().reverse()) {
          const tr = document.createElement('tr');
          const tdImg = document.createElement('td');
          tdImg.innerHTML = '<div class="small muted">—</div>';

          try {
            const imgs = await getImagesByInstrument(i.id);
            if (imgs && imgs.length > 0) {
              const d = imgs[0];
              let blobData;
              if (d.thumb) { blobData = new Blob([d.thumb], { type: d.thumbType || d.type || 'image/jpeg' }) } else { blobData = new Blob([d.blob], { type: d.type || 'image/jpeg' }) }
              const url = URL.createObjectURL(blobData);
              tdImg.innerHTML = `<img class="thumb" src="${url}" alt="${escapeHtml(i.nome)}" />`;
            }
          } catch (err) { console.warn('erro ao ler imagens', err); }

          const tdEtiqueta = document.createElement('td');
          tdEtiqueta.innerHTML = `<div class="small">${escapeHtml(i.serie || i.id)}</div><div>${escapeHtml(i.nome)}</div>`;

          const tdModelo = document.createElement('td'); tdModelo.textContent = i.modelo || '';
          const tdMadeira = document.createElement('td'); tdMadeira.textContent = i.madeira || '';
          const tdLinha = document.createElement('td'); tdLinha.textContent = i.linha || '';

          const tdStatus = document.createElement('td');
          const stClass = i.status && i.status.toLowerCase() === 'vendido' ? 'vendido' : (i.status && i.status.toLowerCase() === 'reservado' ? 'reservado' : 'disponivel');
          tdStatus.innerHTML = `<span class="status ${stClass}">${escapeHtml(i.status || '')}</span>`;

          const tdCompr = document.createElement('td'); tdCompr.className = 'small muted'; tdCompr.textContent = i.comprador || '—';

          const tdActions = document.createElement('td'); tdActions.className = 'actions small';
          tdActions.innerHTML = `
            <button class="btn ghost" data-id="${i.id}" data-action="view">Fotos</button>
            <button class="btn ghost" data-id="${i.id}" data-action="edit">Editar</button>
            <button class="btn ghost" data-id="${i.id}" data-action="delete">Excluir</button>
          `;

          tr.append(tdImg, tdEtiqueta, tdModelo, tdMadeira, tdLinha, tdStatus, tdCompr, tdActions);
          tbody.appendChild(tr);
        }

        if (countEl) countEl.textContent = instruments.length;
        populateLinhaSelect();
      }

      function populateLinhaSelect() {
        try {
          const raw = sampleLines.concat(instruments.map(i => i.linha).filter(Boolean));
          const normalized = raw.map(v => String(v)).filter(Boolean);
          const set = new Set(normalized);
          if (!filterLinhaEl) return;
          filterLinhaEl.innerHTML = '<option value="">Filtrar por linha</option>' + [...set].map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
        } catch (e) { console.warn(e); }
      }

      function getFormData() {
        const obj = {};
        inputs.forEach(k => { const el = $id(k); obj[k] = el && el.value ? el.value.trim() : ''; });
        return obj;
      }
      function setFormData(obj) {
        inputs.forEach(k => { const el = $id(k); if (el) el.value = obj[k] || ''; });
      }
      function clearForm() {
        setFormData({});
        if (fotosInput) fotosInput.value = '';
        editingId = null;
        clearDraft();
      }

      // --- Events ---
      let editingId = null;

      if (form) form.addEventListener('submit', async e => {
        e.preventDefault();
        const data = getFormData();
        if (!data.nome) { alert('Preencha o nome do instrumento'); return; }

        if (editingId) {
          const idx = instruments.findIndex(it => it.id === editingId);
          if (idx > -1) instruments[idx] = Object.assign({}, instruments[idx], data);
          if (fotosInput && fotosInput.files && fotosInput.files.length > 0) {
            for (const f of fotosInput.files) { try { await saveImageToDb(editingId, f) } catch (err) { console.warn(err) } }
          }
        } else {
          const item = Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data);
          instruments.push(item);
          if (fotosInput && fotosInput.files && fotosInput.files.length > 0) {
            for (const f of fotosInput.files) { try { await saveImageToDb(item.id, f) } catch (err) { console.warn(err) } }
          }
        }
        clearDraft(); save(); clearForm();
      });

      if (btnNew) btnNew.addEventListener('click', () => { clearForm(); const n = $id('nome'); if (n) n.focus(); });
      const resetBtn = $id('reset'); if (resetBtn) resetBtn.addEventListener('click', () => clearForm());

      if (tbody) tbody.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'view') {
          if (modalContent) modalContent.innerHTML = '<div class="small muted">Carregando...</div>';
          if (modal) modal.style.display = 'flex';
          try {
            const imgs = await getImagesByInstrument(id);
            if (!imgs || imgs.length === 0) {
              if (modalContent) modalContent.innerHTML = '<div class="small muted">Sem imagens para este instrumento.</div>';
              return;
            }
            const out = document.createElement('div');
            out.className = 'gallery';
            // Grid simples para galeria
            out.style.display = 'grid';
            out.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            out.style.gap = '10px';

            imgs.forEach(r => {
              const container = document.createElement('div');
              container.style.position = 'relative';

              const blob = r.thumb ? new Blob([r.thumb], { type: r.thumbType || r.type || 'image/jpeg' }) : new Blob([r.blob], { type: r.type || 'image/jpeg' });
              const url = URL.createObjectURL(blob);

              const img = document.createElement('img');
              img.src = url;
              img.style.width = '100%';
              img.style.borderRadius = '8px';
              img.alt = r.name;

              // Botão de excluir individual
              const delBtn = document.createElement('button');
              delBtn.innerHTML = '&times;';
              delBtn.title = 'Excluir foto';
              delBtn.style.cssText = 'position:absolute; top:4px; right:4px; background:rgba(220,53,69,0.9); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-weight:bold; line-height:1;';

              delBtn.onclick = async () => {
                if (confirm('Deseja excluir esta foto permanentemente?')) {
                  try {
                    await deleteSingleImage(r.id);
                    container.remove();
                    render(); // Re-renderiza a tabela principal para atualizar a thumb se necessário
                  } catch (err) { alert('Erro ao excluir: ' + err); }
                }
              };

              container.appendChild(img);
              container.appendChild(delBtn);
              out.appendChild(container);
            });
            if (modalContent) { modalContent.innerHTML = ''; modalContent.appendChild(out); }
          } catch (e) { if (modalContent) modalContent.innerHTML = '<div class="small muted">Erro ao carregar imagens.</div>'; console.warn(e); }
        }

        if (action === 'edit') {
          const it = instruments.find(x => x.id === id);
          if (!it) return;
          editingId = id;
          setFormData(it);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (action === 'delete') {
          if (!confirm('Excluir instrumento? Esta ação não pode ser desfeita. As imagens relacionadas também serão removidas.')) return;
          instruments = instruments.filter(x => x.id !== id);
          try { await deleteImagesByInstrument(id) } catch (err) { console.warn(err) }
          save();
        }
      });

      if (closeModal) closeModal.addEventListener('click', () => { if (modal) modal.style.display = 'none'; if (modalContent) modalContent.innerHTML = ''; });
      if (modal) modal.addEventListener('click', e => { if (e.target === modal) { modal.style.display = 'none'; if (modalContent) modalContent.innerHTML = ''; } });

      [searchEl, filterStatusEl, filterLinhaEl].forEach(el => { if (el) el.addEventListener('input', render); });

      // --- Export/Import ---

      if (btnExport) btnExport.addEventListener('click', () => {
        if (instruments.length === 0) { alert('Nenhum instrumento para exportar.'); return; }
        const dataToExport = instruments.map(sanitizeInstrument);
        const raw = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([raw], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'baratieri_instruments.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      });

      if (btnImport && fileImport) btnImport.addEventListener('click', () => fileImport.click());
      if (fileImport) fileImport.addEventListener('change', () => {
        const f = fileImport.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data)) { alert('Arquivo inválido: JSON deve ser um array'); return; }
            const existingIds = new Set(instruments.map(i => i.id));
            let added = 0;
            data.map(sanitizeInstrument).forEach(it => {
              if (!it.id) it.id = uid();
              if (!existingIds.has(it.id)) { instruments.push(it); added++; }
            });
            save(); alert('Importado: ' + added + ' instrumentos');
          } catch (err) { alert('Erro ao ler arquivo: ' + err.message); }
        };
        reader.readAsText(f);
      });

      // --- ZIP Export ---
      async function ensureJSZip() {
        if (window.JSZip) return window.JSZip;
        return new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
          s.onload = () => res(window.JSZip);
          s.onerror = () => rej(new Error('Falha ao carregar JSZip'));
          document.head.appendChild(s);
        });
      }

      async function exportAllImagesZip() {
        try {
          const JSZipLib = await ensureJSZip();
          const db = await openDb();
          const tx = db.transaction(IMG_STORE, 'readonly');
          const store = tx.objectStore(IMG_STORE);
          const req = store.getAll();
          const rows = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
          if (!rows || rows.length === 0) { alert('Nenhuma imagem encontrada.'); return; }
          const zip = new JSZipLib();
          rows.forEach(r => {
            const filename = `${r.instrumentId}/${r.name || r.id}`;
            const arr = r.blob || r.thumb;
            if (arr) zip.file(filename, arr);
          });
          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a'); a.href = url; a.download = `baratieri_images_${Date.now().toString(36)}.zip`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch (err) { console.error(err); alert('Erro ao exportar imagens.'); }
      }

      if (controlsEl) {
        const zipBtn = document.createElement('button');
        zipBtn.className = 'btn ghost'; zipBtn.textContent = 'Exportar Imagens (ZIP)'; zipBtn.style.marginLeft = '6px';
        zipBtn.addEventListener('click', exportAllImagesZip);
        controlsEl.appendChild(zipBtn);
      }

      // Initial render
      render().then(() => log('render complete')).catch(e => console.warn('render failed', e));

      // Shortcut 'N'
      document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'n' && (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) { e.preventDefault(); const n = $id('nome'); if (n) n.focus(); } });

      window.__baratieri = {
        getAll: () => instruments,
        save,
        load,
        openDb,
        deleteImagesByInstrument,
        saveImageToDb,
        render
      };

    } catch (ex) {
      console.error('Fatal error', ex);
      alert('Erro ao iniciar o admin: ' + (ex && ex.message ? ex.message : ex));
    }
  });
  /* =========================================================
   IMPORTAÇÃO DE IMAGENS (ZIP → IndexedDB)
   ========================================================= */

  const btnImportImages = document.getElementById('btnImportImages');
  const fileImportImages = document.getElementById('fileImportImages');

  if (btnImportImages && fileImportImages) {
    btnImportImages.addEventListener('click', () => {
      fileImportImages.click();
    });

    fileImportImages.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        await importImagesFromZip(file);
      } catch (err) {
        alert('Erro ao importar imagens.\nVeja o console.');
        console.error(err);
      } finally {
        fileImportImages.value = '';
      }
    });
  }

  // FIX: removed duplicated deleteImagesByInstrument (was using openImagesDB undefined)



  async function importImagesFromZip(zipFile) {
  const JSZipLib = window.JSZip || await ensureJSZip();
  const zip = await JSZipLib.loadAsync(zipFile);

  let restored = 0;
  let ignored = 0;

  // Mapeia: instrumentId -> arquivos
  const foldersMap = {};

  // 1️⃣ Percorre TODOS os arquivos do zip (não pastas)
  for (const fullPath in zip.files) {
    const entry = zip.files[fullPath];
    if (entry.dir) continue;

    // pega somente o primeiro nível: BL-XXXXXX/arquivo.png
    const parts = fullPath.split('/');
    if (parts.length < 2) continue;

    const instrumentId = parts[0].trim();
    const fileName = parts.slice(1).join('/');

    if (!/\.(png|jpg|jpeg|webp)$/i.test(fileName)) continue;

    if (!foldersMap[instrumentId]) {
      foldersMap[instrumentId] = [];
    }

    foldersMap[instrumentId].push({
      name: fileName,
      entry
    });
  }

  // 2️⃣ Para cada instrumento encontrado no ZIP
  for (const instrumentId of Object.keys(foldersMap)) {

    // valida se o instrumento existe no app
    const exists = window.__baratieri
      .getAll()
      .some(i => String(i.id) === String(instrumentId));

    if (!exists) {
      ignored++;
      continue;
    }

    // remove imagens antigas
    await window.__baratieri.deleteImagesByInstrument(instrumentId);

    // ordena arquivos (1.png, 2.png, etc)
    const files = foldersMap[instrumentId].sort((a, b) => {
      const na = parseInt(a.name.match(/(\d+)/)?.[1] || 0);
      const nb = parseInt(b.name.match(/(\d+)/)?.[1] || 0);
      return na - nb;
    });

    // salva cada imagem no instrumento correto
    for (const f of files) {
      const blob = await f.entry.async('blob');
      const file = new File(
        [blob],
        f.name.split('/').pop(),
        { type: blob.type || 'image/webp' }
      );

      await window.__baratieri.saveImageToDb(instrumentId, file);
    }

    restored++;
  }

  alert(
    `Importação concluída.\n\n` +
    `✔️ Instrumentos restaurados: ${restored}\n` +
    `⚠️ Pastas ignoradas: ${ignored}`
  );

  window.__baratieri.render();
}




})();