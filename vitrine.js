// vitrine.js - Versão 2.0 (Com Modal de Galeria e WhatsApp)

document.addEventListener('DOMContentLoaded', () => {
    const instrumentsList = document.getElementById('instrumentos-list');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');

    // Elementos do Modal
    const imageModal = document.getElementById('image-modal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const galleryContainer = document.getElementById('modal-image-gallery');
    const detailsContainer = document.getElementById('modal-instrument-details');

    // CONFIGURAÇÕES
    const DATA_URL = './data/baratieri_instruments.json';
    const IMAGES_BASE_PATH = './images/instrumentos/';
    const WHATSAPP_NUMBER = '+5545920028659'; // Seu número de contato
    const MAX_IMAGES = 10; // Número máximo de imagens para procurar (1.png, 2.png, ..., 10.png)

    let instrumentsData = []; // Armazena os dados carregados

    // --- Helpers ---

    function sanitizeStatus(status) {
        if (!status) return 'disponivel';
        return status.toLowerCase().trim().replace(/ã/g, 'a').replace(/é/g, 'e').replace(/\s/g, '');
    }

    function createWhatsappLink(instrumento) {
        const message = encodeURIComponent(`Olá, gostaria de solicitar um orçamento para o instrumento "${instrumento.nome} ${instrumento.modelo}" (Série: ${instrumento.serie || instrumento.id}).`);
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    }

    // --- Modal Logic ---

    function closeGalleryModal() {
        if (imageModal) imageModal.style.display = 'none';
        if (galleryContainer) galleryContainer.innerHTML = '';
        if (detailsContainer) detailsContainer.innerHTML = '';
    }

    // vitrine.js - Refinamento da Galeria (Função openGalleryModal)

    function openGalleryModal(instrumento) {
        if (!imageModal || !galleryContainer || !detailsContainer) return;

        // Limpa conteúdo anterior
        galleryContainer.innerHTML = '';
        detailsContainer.innerHTML = '';

        // 1. Geração da estrutura de Imagem Principal e Miniaturas
        const mainImageDiv = document.createElement('div');
        mainImageDiv.className = 'main-image-view';
        mainImageDiv.innerHTML = `<img src="" alt="${instrumento.nome} - Foto Principal" id="main-modal-img" />`;

        const thumbsDiv = document.createElement('div');
        thumbsDiv.className = 'thumbnails-list';

        // Adiciona a imagem principal e a lista de miniaturas ao container da galeria
        galleryContainer.appendChild(mainImageDiv);
        galleryContainer.appendChild(thumbsDiv);


        let firstImageLoaded = false;
        let imagesFound = 0;

        // Assumimos que as imagens são 1.png, 2.png, 3.png, etc.
        for (let i = 1; i <= MAX_IMAGES; i++) {
            const imagePath = `${IMAGES_BASE_PATH}${instrumento.id}/${i}.png`;
            const testImg = new Image();

            testImg.onload = () => {
                imagesFound++;

                // Define a primeira imagem carregada como a imagem principal do modal
                if (!firstImageLoaded) {
                    document.getElementById('main-modal-img').src = imagePath;
                    firstImageLoaded = true;
                }

                // Cria o thumbnail
                const thumb = document.createElement('img');
                thumb.className = 'thumb';
                thumb.src = imagePath;
                thumb.alt = `Miniatura ${i}`;
                thumb.dataset.src = imagePath;

                // Evento de clique da miniatura: troca a imagem principal
                thumb.onclick = (e) => {
                    document.getElementById('main-modal-img').src = e.target.dataset.src;
                    // Atualiza o estado ativo
                    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                };

                // Marca o primeiro thumbnail como ativo
                if (i === 1) thumb.classList.add('active');

                thumbsDiv.appendChild(thumb);
            };

            testImg.onerror = () => {
                // Se a imagem não carregar (404), o loop para de procurar mais imagens
                if (i === 1 && !firstImageLoaded) {
                    mainImageDiv.innerHTML = `<div class="loading" style="text-align: center; color: var(--muted);">Imagem de capa indisponível.</div>`;
                }
            };
            testImg.src = imagePath; // Inicia o carregamento
        }

        // 2. Geração dos detalhes e botão de contato (O mesmo bloco anterior)
        const whatsappLink = createWhatsappLink(instrumento);
        detailsContainer.innerHTML = `
        <h3>${instrumento.nome} ${instrumento.modelo || ''}</h3>
        <p><strong>Série:</strong> ${instrumento.serie || instrumento.id}</p>
        <p><strong>Linha:</strong> ${instrumento.linha || 'Não especificado'}</p>
        <p><strong>Status:</strong> <span class="status-tag ${sanitizeStatus(instrumento.status)}">${instrumento.status || 'Disponível'}</span></p>
        ${instrumento.obs ? `<p><strong>Observações:</strong> ${instrumento.obs}</p>` : ''}
        
        <a href="${whatsappLink}" target="_blank" class="btn-whatsapp">
            Solicitar Orçamento/Fale Conosco
        </a>
        <p class="small" style="margin-top:10px;">O preço será negociado diretamente via WhatsApp. Clique para iniciar a conversa.</p>
    `;

        imageModal.style.display = 'flex';
    }


    // --- Renderização e Eventos ---

    function renderCard(instrumento) {
        const statusClean = sanitizeStatus(instrumento.status);
        const imagePath = `${IMAGES_BASE_PATH}${instrumento.id}/1.png`; // Capa principal

        const card = document.createElement('div');
        card.className = 'instrument-card';
        card.dataset.id = instrumento.id; // Para identificar o clique

        card.innerHTML = `
            <div class="image-container">
                <img src="${imagePath}" alt="${instrumento.nome} ${instrumento.modelo}" onerror="this.onerror=null; this.src='placeholder-image.svg';" />
            </div>
            <div class="details">
                <span class="status-tag ${statusClean}">${instrumento.status || 'Disponível'}</span>
                <h3>${instrumento.nome}</h3>
                <p>Modelo: ${instrumento.modelo || 'Custom'}</p>
                ${instrumento.linha ? `<span class="linha">Linha: ${instrumento.linha}</span>` : ''}
            </div>
        `;

        // Adiciona o evento de clique para abrir o modal
        card.addEventListener('click', () => openGalleryModal(instrumento));

        instrumentsList.appendChild(card);
    }

    async function loadInstruments() {
        if (!instrumentsList) return;
        loadingState.style.display = 'block';
        errorState.style.display = 'none';
        instrumentsList.innerHTML = '';
        instrumentsList.appendChild(loadingState);

        try {
            const response = await fetch(DATA_URL);

            if (!response.ok) {
                throw new Error(`[${response.status}] Arquivo JSON não encontrado. Verifique a estrutura de pastas.`);
            }

            instrumentsData = await response.json();

            loadingState.style.display = 'none';
            instrumentsList.innerHTML = '';

            if (instrumentsData.length === 0) {
                instrumentsList.innerHTML = '<p class="loading">Nenhum instrumento disponível no momento.</p>';
            } else {
                // Renderiza os cards do mais novo para o mais antigo
                instrumentsData.slice().reverse().forEach(renderCard);
            }

        } catch (error) {
            console.error('Falha ao carregar vitrine:', error);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            errorState.innerHTML = `<div class="error-content">Falha ao carregar a vitrine. ${error.message}</div>`;
            instrumentsList.innerHTML = '';
            instrumentsList.appendChild(errorState);
        }
    }

    // --- Inicialização ---

    // Fechar modal
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeGalleryModal);
    if (imageModal) imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) closeGalleryModal();
    });

    loadInstruments();
});