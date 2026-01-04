// vitrine.js — Versão 2.3 (Fullscreen Gallery + Setas + Cursores)

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
    const IMAGE_EXTENSIONS = ['webp', 'png'];
    const WHATSAPP_NUMBER = '5545920028659';
    const MAX_IMAGES = 20;

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

    // --- FULLSCREEN ---

    function openFullscreenGallery(images, startIndex = 0) {
        let currentIndex = startIndex;

        const fs = document.createElement('div');
        fs.className = 'fullscreen-gallery';

        fs.innerHTML = `
            <button class="fs-close">×</button>
            <button class="fs-nav fs-prev">‹</button>
            <button class="fs-nav fs-next">›</button>
            <div class="fs-track"></div>
        `;

        const track = fs.querySelector('.fs-track');
        const btnPrev = fs.querySelector('.fs-prev');
        const btnNext = fs.querySelector('.fs-next');

        images.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            track.appendChild(img);
        });

        // 👉 TRACK STYLE AQUI (JS)
        track.style.display = 'flex';
        track.style.width = '100%';
        track.style.height = '100%';
        track.style.overflowX = 'auto';
        track.style.scrollSnapType = 'x mandatory';
        track.style.cursor = 'grab';

        document.body.appendChild(fs);
        document.body.style.overflow = 'hidden';

        const update = () => {
            track.scrollTo({
                left: currentIndex * window.innerWidth,
                behavior: 'smooth'
            });
        };

        update();

        btnPrev.onclick = () => {
            if (currentIndex > 0) {
                currentIndex--;
                update();
            }
        };

        btnNext.onclick = () => {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                update();
            }
        };

        track.addEventListener('scroll', () => {
            currentIndex = Math.round(track.scrollLeft / window.innerWidth);
        });

        track.addEventListener('mousedown', () => {
            track.style.cursor = 'grabbing';
        });
        track.addEventListener('mouseup', () => {
            track.style.cursor = 'grab';
        });
        track.addEventListener('mouseleave', () => {
            track.style.cursor = 'grab';
        });

        fs.querySelector('.fs-close').onclick = close;
        fs.onclick = e => e.target === fs && close();

        document.addEventListener('keydown', esc);

        function esc(e) {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') btnNext.click();
            if (e.key === 'ArrowLeft') btnPrev.click();
        }

        function close() {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', esc);
            fs.remove();
        }
    }

    // --- MODAL ---

    function closeGalleryModal() {
        imageModal.style.display = 'none';
        galleryContainer.innerHTML = '';
        detailsContainer.innerHTML = '';
    }

    function openGalleryModal(instrumento) {
        galleryContainer.innerHTML = '';
        detailsContainer.innerHTML = '';

        let currentIndex = 0;

        const mainImageDiv = document.createElement('div');
        mainImageDiv.className = 'main-image-view';
        mainImageDiv.style.cursor = 'zoom-in';
        mainImageDiv.innerHTML = `<img id="main-modal-img" alt="${instrumento.nome}" />`;

        const thumbsDiv = document.createElement('div');
        thumbsDiv.className = 'thumbnails-list';

        galleryContainer.appendChild(mainImageDiv);
        galleryContainer.appendChild(thumbsDiv);

        const allImages = [];
        let firstLoaded = false;

        for (let i = 1; i <= MAX_IMAGES; i++) {
            findImagePath(instrumento.id, i, (path) => {
                if (!path) return;

                const index = allImages.length;
                allImages.push(path);

                if (!firstLoaded) {
                    document.getElementById('main-modal-img').src = path;
                    currentIndex = index;
                    firstLoaded = true;
                }

                const thumb = document.createElement('img');
                thumb.className = 'thumb';
                thumb.src = path;

                thumb.onclick = () => {
                    document.getElementById('main-modal-img').src = path;
                    currentIndex = index;

                    document.querySelectorAll('.thumb')
                        .forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                };

                thumbsDiv.appendChild(thumb);
            });
        }

        mainImageDiv.onclick = () => {
            if (allImages.length) {
                openFullscreenGallery(allImages, currentIndex);
            }
        };

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

    // --- RENDER ---

    function renderCard(instrumento) {
        const card = document.createElement('div');
        card.className = 'instrument-card';

        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';

        const img = document.createElement('img');
        img.alt = `${instrumento.nome} ${instrumento.modelo || ''}`;

        findImagePath(instrumento.id, 1, path => {
            img.src = path || './images/placeholder.webp';
        });

        imageContainer.appendChild(img);
        card.appendChild(imageContainer);
        card.appendChild(document.createElement('div')).className = 'details';

        card.onclick = () => openGalleryModal(instrumento);
        instrumentsList.appendChild(card);
    }

    if (closeModalBtn) closeModalBtn.onclick = closeGalleryModal;
    if (imageModal) imageModal.onclick = e => e.target === imageModal && closeGalleryModal();

    fetch(DATA_URL)
        .then(r => r.json())
        .then(data => data.slice().reverse().forEach(renderCard))
        .catch(() => errorState.style.display = 'block');
});
