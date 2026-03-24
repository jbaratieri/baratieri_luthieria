/* =========================
   CONFIGURAÇÃO DO BANCO
   ========================= */

const OS_DB_NAME = "baratieri_os_v1";
const OS_STORE = "ordens";

/* =========================
   INDEXED DB
   ========================= */

function openOsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OS_DB_NAME, 1);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OS_STORE)) {
        db.createObjectStore(OS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* =========================
   MODELO BASE DA OS
   ========================= */

function createEmptyOS() {
  const now = new Date().toISOString();

  return {
    id: `OS-${Date.now()}`,
    createdAt: now,
    updatedAt: null,
    status: "recebido",

    cliente: { nome: "", telefone: "", email: "" },

    instrumento: {
      tipo: "",
      marca: "",
      modelo: "",
      numeroSerie: "",
      observacoes: ""
    },

    diagnostico: {
      relatoCliente: "",
      analiseTecnica: "",
      riscos: ""
    },

    servicos: [],

    valores: {
      orcado: 0,
      aprovado: 0,
      final: 0
    },

    prazoDias: 0,
    observacoesGerais: ""
  };
}

/* =========================
   ESTADO ATUAL
   ========================= */

let currentOS = null;

/* =========================
   FORM → OBJETO OS
   ========================= */

function readOsFromForm(existingOS = null) {
  const os = existingOS || createEmptyOS();

  os.updatedAt = new Date().toISOString();

  os.cliente.nome = document.getElementById("cliente-nome").value;
  os.cliente.telefone = document.getElementById("cliente-telefone").value;
  os.cliente.email = document.getElementById("cliente-email").value;

  os.instrumento.tipo = document.getElementById("inst-tipo").value;
  os.instrumento.marca = document.getElementById("inst-marca").value;
  os.instrumento.modelo = document.getElementById("inst-modelo").value;
  os.instrumento.numeroSerie = document.getElementById("inst-serie").value;
  os.instrumento.observacoes = document.getElementById("inst-observacoes").value;

  os.diagnostico.relatoCliente = document.getElementById("diag-relato").value;
  os.diagnostico.analiseTecnica = document.getElementById("diag-analise").value;
  os.diagnostico.riscos = document.getElementById("diag-riscos").value;

  os.valores.aprovado = Number(document.getElementById("valor-aprovado").value || 0);
  os.valores.final = Number(document.getElementById("valor-final").value || 0);

  os.prazoDias = Number(document.getElementById("prazo-dias").value || 0);
  os.observacoesGerais = document.getElementById("os-observacoes").value;

  return os;
}

/* =========================
   SALVAR / CARREGAR
   ========================= */

async function saveOS(os) {
  const db = await openOsDb();
  const tx = db.transaction(OS_STORE, "readwrite");
  tx.objectStore(OS_STORE).put(os);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(os);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadOS(osId) {
  const db = await openOsDb();
  const tx = db.transaction(OS_STORE, "readonly");
  const request = tx.objectStore(OS_STORE).get(osId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* =========================
   PREENCHER FORMULÁRIO
   ========================= */

function fillFormWithOS(os) {
  document.querySelector(".os-id").textContent = os.id;

  document.getElementById("cliente-nome").value = os.cliente.nome;
  document.getElementById("cliente-telefone").value = os.cliente.telefone;
  document.getElementById("cliente-email").value = os.cliente.email;

  document.getElementById("inst-tipo").value = os.instrumento.tipo;
  document.getElementById("inst-marca").value = os.instrumento.marca;
  document.getElementById("inst-modelo").value = os.instrumento.modelo;
  document.getElementById("inst-serie").value = os.instrumento.numeroSerie;
  document.getElementById("inst-observacoes").value = os.instrumento.observacoes;

  document.getElementById("diag-relato").value = os.diagnostico.relatoCliente;
  document.getElementById("diag-analise").value = os.diagnostico.analiseTecnica;
  document.getElementById("diag-riscos").value = os.diagnostico.riscos;

  document.getElementById("valor-aprovado").value = os.valores.aprovado;
  document.getElementById("valor-final").value = os.valores.final;

  document.getElementById("prazo-dias").value = os.prazoDias;
  document.getElementById("os-observacoes").value = os.observacoesGerais;

  renderServicos();
}

/* =========================
   SERVIÇOS
   ========================= */

function renderServicos() {
  const tbody = document.getElementById("lista-servicos");
  tbody.innerHTML = "";

  let total = 0;

  currentOS.servicos.forEach((srv, index) => {
    total += Number(srv.valor || 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="text" class="srv-desc" data-index="${index}" value="${srv.descricao}">
      </td>
      <td>
        <input type="number" step="0.01" class="srv-valor" data-index="${index}" value="${srv.valor}">
      </td>
      <td>
        <button type="button" class="btn-remove" data-index="${index}">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  currentOS.valores.orcado = total;
  document.getElementById("valor-orcado").value = total.toFixed(2);
}

function addServico(descricao = "Novo serviço", valor = 0) {
  currentOS.servicos.push({ descricao, valor });
  renderServicos();
}

/* =========================
   EVENTOS SERVIÇOS
   ========================= */

document.querySelector(".servicos-add .btn").addEventListener("click", () => {
  addServico();
});

document.getElementById("lista-servicos").addEventListener("input", e => {
  const index = e.target.dataset.index;
  if (index === undefined) return;

  if (e.target.classList.contains("srv-desc")) {
    currentOS.servicos[index].descricao = e.target.value;
  }

  if (e.target.classList.contains("srv-valor")) {
    currentOS.servicos[index].valor = Number(e.target.value || 0);
  }

  renderServicos();
});

document.getElementById("lista-servicos").addEventListener("click", e => {
  if (!e.target.classList.contains("btn-remove")) return;

  const index = e.target.dataset.index;
  currentOS.servicos.splice(index, 1);
  renderServicos();
});

/* =========================
   BOTÕES SALVAR
   ========================= */

document.querySelector(".btn.primary").addEventListener("click", async () => {
  currentOS = readOsFromForm(currentOS);
  await saveOS(currentOS);
  alert("Ordem de Serviço salva com sucesso.");
});

document.querySelector(".btn.secondary").addEventListener("click", async () => {
  currentOS = readOsFromForm(currentOS);
  await saveOS(currentOS);
  alert("Rascunho salvo.");
});

/* =========================
   INIT
   ========================= */

(async function initOS() {
  const params = new URLSearchParams(window.location.search);
  const osId = params.get("id");

  if (osId) {
    currentOS = await loadOS(osId);
    if (currentOS) fillFormWithOS(currentOS);
  } else {
    currentOS = createEmptyOS();
    document.querySelector(".os-id").textContent = currentOS.id;
    renderServicos();
  }
})();