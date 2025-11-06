// Demo sem backend (GitHub Pages). Guarda saldos por conta no localStorage.
const LS_KEY = "contabancaria_demo_saldos";

function getStore() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function setStore(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

const el  = (id) => document.getElementById(id);
const fmt = (n)  => typeof n === "number" ? n.toFixed(2) : "-";
const now = ()   => new Date().toLocaleString("pt-PT");

// histórico simples só para a demo
let historico = [];

function renderHistorico() {
  const tbody = document.querySelector("#tabelaHistorico tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  historico.forEach(op => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${op.data}</td>
      <td>${op.conta}</td>
      <td><span class="tag ${op.tipo==='DEPOSITO'?'dep':op.tipo==='LEVANTAMENTO'?'lev':'saldo'}">
            ${op.tipo==='DEPOSITO'?'Depósito':op.tipo==='LEVANTAMENTO'?'Levantamento':'Consulta'}
          </span></td>
      <td class="right">${op.tipo==='SALDO' ? '-' : fmt(op.valor)}</td>
      <td class="right">${fmt(op.saldoApos)}</td>`;
    tbody.appendChild(tr);
  });
}

function depositar() {
  const conta = el("conta")?.value.trim();
  const valor = parseFloat(el("valor")?.value);
  const r = el("resultado");
  if (!conta || isNaN(valor) || valor <= 0) { r.textContent = "⚠️ Informe conta e valor válido."; return; }

  const store = getStore();
  store[conta] = (store[conta] || 0) + valor;
  setStore(store);

  r.innerHTML = `💰 Depósito realizado. Saldo: <strong>${fmt(store[conta])} €</strong>`;
  historico.unshift({ data:now(), conta, tipo:"DEPOSITO", valor, saldoApos:store[conta] });
  renderHistorico();
}

function levantar() {
  const conta = el("conta")?.value.trim();
  const valor = parseFloat(el("valor")?.value);
  const r = el("resultado");
  if (!conta || isNaN(valor) || valor <= 0) { r.textContent = "⚠️ Informe conta e valor válido."; return; }

  const store = getStore();
  const atual = store[conta] || 0;
  if (valor > atual) { r.textContent = "⚠️ Saldo insuficiente."; return; }

  store[conta] = atual - valor;
  setStore(store);

  r.innerHTML = `💸 Levantamento efetuado. Saldo: <strong>${fmt(store[conta])} €</strong>`;
  historico.unshift({ data:now(), conta, tipo:"LEVANTAMENTO", valor, saldoApos:store[conta] });
  renderHistorico();
}

function consultar() {
  const conta = el("conta")?.value.trim();
  const r = el("resultado");
  if (!conta) { r.textContent = "⚠️ Informe o número da conta."; return; }

  const store = getStore();
  if (store[conta] == null) { r.textContent = "⚠️ Conta não encontrada."; return; }

  r.innerHTML = `📊 Saldo disponível: <strong>${fmt(store[conta])} €</strong>`;
  historico.unshift({ data:now(), conta, tipo:"SALDO", valor:null, saldoApos:store[conta] });
  renderHistorico();
}

function limparHistorico() {
  historico = [];
  renderHistorico();
  const r = el("resultado"); if (r) r.textContent = "🧹 Histórico limpo (demo).";
}

// inicializa tabela vazia ao carregar a página
document.addEventListener("DOMContentLoaded", renderHistorico);
