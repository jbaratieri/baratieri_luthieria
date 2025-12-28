// vitrine.js — Versão 2.1 (WebP + PNG fallback)

document.addEventListener('DOMContentLoaded', () => {
    const instrumentsList = document.getElementById('instrumentos-list');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');

    // Modal
    const imageModal = document.getElementById('image-modal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const galleryContainer = document.getElementById('modal-image-gallery');
    const detailsContainer = document.getElementById('modal-instrument-details');

    // CONFIG
    const DATA_URL = './data/baratieri_instruments.json';
    const IMAGES_BASE_PATH = './images/instrumentos/';
    const IMAGE_EXTENSIONS = ['webp', 'png']; // prioridade
    const WHATSAPP_NUMBER = '+5545920028659';
    const MAX_IMAGES = 20;

    let instrumentsData = [];

    // --- Helpers ---

    function sanitizeStatus(status) {
        if (!status) return 'disponivel';
        return status.toLowerCase().trim()
            .replace(/ã/g, 'a')
            .replace(/é/g, 'e')
            .replace(/\s/g, '');
    }

    function createWhatsappLink(instrumento) {
        const msg = encodeURIComponent(
            `Olá, gostaria de solicitar um orçamento para o instrumento "${instrumento.nome} ${instrumento.modelo}" (Série: ${instrumento.serie || instrumento.id}).`
        );
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
    }

    // 🔹 Resolve automaticamente webp → png
    function findImagePath(instrumentId, index, callback) {
        let extIdx = 0;

        function tryNext() {
            if (extIdx >= IMAGE_EXTENSIONS.length) {
                callback(null);
                return;
            }
            const ext = IMAGE_EXTENSIONS[extIdx++];
            const path = `${IMAGES_BASE_PATH}${instrumentId}/${index}.${ext}`;
            const img = new Image();
            img.onload = () => callback(path);
            img.onerror = tryNext;
            img.src = path;
        }

        tryNext();
    }

    // --- Modal ---

    function closeGalleryModal() {
        imageModal.style.display = 'none';
        galleryContainer.innerHTML = '';
        detailsContainer.innerHTML = '';
    }

    function openGalleryModal(instrumento) {
        galleryContainer.innerHTML = '';
        detailsContainer.innerHTML = '';

        const mainImageDiv = document.createElement('div');
        mainImageDiv.className = 'main-image-view';
        mainImageDiv.innerHTML = `<img id="main-modal-img" alt="${instrumento.nome}" />`;

        const thumbsDiv = document.createElement('div');
        thumbsDiv.className = 'thumbnails-list';

        galleryContainer.appendChild(mainImageDiv);
        galleryContainer.appendChild(thumbsDiv);

        let firstLoaded = false;

        for (let i = 1; i <= MAX_IMAGES; i++) {
            findImagePath(instrumento.id, i, (path) => {
                if (!path) return;

                if (!firstLoaded) {
                    document.getElementById('main-modal-img').src = path;
                    firstLoaded = true;
                }

                const thumb = document.createElement('img');
                thumb.className = 'thumb';
                thumb.src = path;
                thumb.dataset.src = path;

                thumb.onclick = (e) => {
                    document.getElementById('main-modal-img').src = e.target.dataset.src;
                    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                };

                thumbsDiv.appendChild(thumb);
            });
        }

        const whatsappLink = createWhatsappLink(instrumento);

        detailsContainer.innerHTML = `
            <h3>${instrumento.nome} ${instrumento.modelo || ''}</h3>
            <p><strong>Série:</strong> ${instrumento.serie || instrumento.id}</p>
            <p><strong>Linha:</strong> ${instrumento.linha || '—'}</p>
            <p><strong>Status:</strong>
                <span class="status-tag ${sanitizeStatus(instrumento.status)}">
                    ${instrumento.status || 'Disponível'}
                </span>
            </p>
            ${instrumento.obs ? `<p><strong>Detalhes:</strong> ${instrumento.obs}</p>` : ''}
            <a href="${whatsappLink}" target="_blank" class="btn-whatsapp">
                Solicitar Orçamento
            </a>
        `;

        imageModal.style.display = 'flex';
    }

    // --- Render ---

    function renderCard(instrumento) {
        const card = document.createElement('div');
        card.className = 'instrument-card';

        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        const img = document.createElement('img');
        img.alt = `${instrumento.nome} ${instrumento.modelo || ''}`;

        findImagePath(instrumento.id, 1, (path) => {
            img.src = path || 'placeholder-image.svg';
        });

        imageContainer.appendChild(img);

        card.appendChild(imageContainer);
        card.innerHTML += `
            <div class="details">
                <span class="status-tag ${sanitizeStatus(instrumento.status)}">
                    ${instrumento.status || 'Disponível'}
                </span>
                <h3>${instrumento.nome}</h3>
                <p>Modelo: ${instrumento.modelo || 'Custom'}</p>
                <p>Madeira: ${instrumento.madeira || 'Custom'}</p>
            </div>
        `;

        card.onclick = () => openGalleryModal(instrumento);
        instrumentsList.appendChild(card);
    }

    async function loadInstruments() {
        loadingState.style.display = 'block';
        errorState.style.display = 'none';

        try {
            const res = await fetch(DATA_URL);
            if (!res.ok) throw new Error('JSON não encontrado');
            instrumentsData = await res.json();

            instrumentsList.innerHTML = '';
            loadingState.style.display = 'none';

            instrumentsData.slice().reverse().forEach(renderCard);

        } catch (e) {
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            errorState.textContent = e.message;
        }
    }

    if (closeModalBtn) closeModalBtn.onclick = closeGalleryModal;
    if (imageModal) imageModal.onclick = e => e.target === imageModal && closeGalleryModal();

    loadInstruments();
});
