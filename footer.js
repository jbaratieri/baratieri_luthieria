// FILE: js/footer.js
(function () {
  'use strict';

  // Declarações locais para as funções de modal
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Evita rolagem do corpo
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restaura a rolagem do corpo

    // Remove modal temporário, como o manual
    if (id === 'manualModal') {
      modal.remove();
    }
  }

  // Manipulação de Eventos
  function initFooter() {
    const body = document.body;

    // 1. Delegação de eventos para abrir/fechar modais
    body.addEventListener('click', (e) => {
      const target = e.target;

      // Abertura
      const mOpen = target.closest('[data-modal]');
      if (mOpen) {
        e.preventDefault();
        openModal(mOpen.getAttribute('data-modal'));
        return;
      }

      // Fechamento
      const mClose = target.closest('[data-modal-close]');
      if (mClose) {
        e.preventDefault();
        closeModal(mClose.getAttribute('data-modal-close'));
        return;
      }
    });

    // 2. Fechar modal ao clicar fora
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (ev) => {
        if (ev.target === m) {
          closeModal(m.id);
        }
      });
    });

    // 3. Fechar modal com a tecla ESC
    body.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal[aria-hidden="false"]');
        if (visibleModal) {
          closeModal(visibleModal.id);
        }
      }
    });

    // 4. Lógica de Manual (se existir um botão com id 'btnManual')
    const btnManual = document.getElementById('btnManual');
    if (btnManual) {
      btnManual.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const res = await fetch(btnManual.href);
          const html = await res.text();

          let m = document.getElementById('manualModal');
          if (!m) {
            m = document.createElement('div');
            m.id = 'manualModal';
            m.className = 'modal';
            // Estilos mínimos para modal dinâmico - Idealmente no CSS
            m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:99999;padding:12px';
            body.appendChild(m);
          }

          // Cria a estrutura interna
          const contentHTML = `
            <div class="modal-dialog" style="width:100%;max-width:900px;height:90%;overflow:auto;background:#fff;border-radius:10px;padding:12px;">
              <button class="btn-close" data-modal-close="manualModal" style="position:sticky;top:8px;float:right">Fechar</button>
              ${html}
            </div>
          `;

          m.innerHTML = contentHTML;
          openModal('manualModal');

        } catch (err) {
          console.error('Erro ao carregar manual:', err);
          window.open(btnManual.href, '_blank'); // Abre em nova aba em caso de falha
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initFooter);
})();
