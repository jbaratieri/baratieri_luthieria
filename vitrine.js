// vitrine.js — lista na home; cada card abre a ficha estática (fotos e texto na página do instrumento)

document.addEventListener('DOMContentLoaded', () => {
    const instrumentsList = document.getElementById('instrumentos-list');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');

    const DATA_URL = './data/baratieri_instruments.json';
    const IMAGES_BASE_PATH = './images/instrumentos/';
    const IMAGE_EXTENSIONS = ['webp', 'png'];

    function sanitizeStatus(status) {
        if (!status) return 'disponivel';
        return status.toLowerCase().trim()
            .replace(/ã/g, 'a')
            .replace(/é/g, 'e')
            .replace(/\s/g, '');
    }

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

    function renderCard(instrumento) {
        const fichaHref = `./instrumento/${encodeURIComponent(instrumento.id)}/`;
        const card = document.createElement('a');
        card.className = 'instrument-card';
        card.href = fichaHref;

        if (instrumento.unique === true) {
            card.dataset.unique = 'true';
        }

        if (instrumento.status) {
            card.dataset.status = sanitizeStatus(instrumento.status);
        }

        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        const img = document.createElement('img');
        img.alt = `${instrumento.nome} ${instrumento.modelo || ''}`;

        findImagePath(instrumento.id, 1, path => {
            img.src = path || './images/placeholder.webp';
        });

        imageContainer.appendChild(img);

        const details = document.createElement('div');
        details.className = 'details';

        details.innerHTML = `
        <h3 class="card-heading">${instrumento.nome}</h3>
        ${instrumento.modelo ? `<p class="modelo">${instrumento.modelo}</p>` : ''}
        <p class="linha">${instrumento.linha || ''}</p>
        <span class="status-tag ${sanitizeStatus(instrumento.status)}">
            ${instrumento.status || 'Disponível'}
        </span>
        <p class="card-cta-hint">Ver ficha e galeria de fotos</p>
    `;

        card.appendChild(imageContainer);
        card.appendChild(details);

        instrumentsList.appendChild(card);
    }

    fetch(DATA_URL)
        .then(r => {
            if (!r.ok) throw new Error('Erro ao carregar JSON');
            return r.json();
        })
        .then(data => {
            loadingState.style.display = 'none';

            if (!data.length) {
                errorState.style.display = 'block';
                return;
            }

            data.slice().reverse().forEach(renderCard);
        })
        .catch(err => {
            console.error(err);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
        });
});
