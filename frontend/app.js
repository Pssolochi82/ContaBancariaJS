// armazenamento em memória no cliente (podes trocar por API/BD depois)
let historico = [];

// helpers
const el = (id) => document.getElementById(id);
const fmt = (n) => typeof n === "number" ? n.toFixed(2) : "-";
const agora = () => new Date().toLocaleString("pt-PT");

// render do histórico
function renderHistorico(lista = historico) {
  const tbody = document.querySelector("#tabelaHistorico tbody");
  tbody.innerHTML = "";

  lista.forEach(op => {
    const tr = document.createElement("tr");

    const tdData = document.createElement("td");
    tdData.textContent = op.data;

    const tdConta = document.createElement("td");
    tdConta.textContent = op.conta;

    const tdTipo = document.createElement("td");
    const span = document.createElement("span");
    span.className = "tag " + (op.tipo === "DEPOSITO" ? "dep" : op.tipo === "LEVANTAMENTO" ? "lev" : "saldo");
    span.textContent = op.tipo === "DEPOSITO" ? "Depósito" : op.tipo === "LEVANTAMENTO" ? "Levantamento" : "Consulta";
    tdTipo.appendChild(span);

    const tdValor = document.createElement("td");
    tdValor.className = "right";
    tdValor.textContent = op.tipo === "SALDO" ? "-" : fmt(op.valor);

    const tdSaldo = document.createElement("td");
    tdSaldo.className = "right";
    tdSaldo.textContent = fmt(op.saldoApos);

    tr.append(tdData, tdConta, tdTipo, tdValor, tdSaldo);
    tbody.appendChild(tr);
  });
}

// filtros
function aplicarFiltros() {
  const conta = el("filtroConta").value.trim();
  const tipo = el("filtroTipo").value;

  const filtrado = historico.filter(op => {
    const okConta = !conta || String(op.conta).includes(conta);
    const okTipo = !tipo || op.tipo === tipo;
    return okConta && okTipo;
  });

  renderHistorico(filtrado);
}
function limparFiltros() {
  el("filtroConta").value = "";
  el("filtroTipo").value = "";
  renderHistorico();
}

// operações (integração com backend)
async function depositar() {
  const conta = el("conta").value.trim();
  const valor = parseFloat(el("valor").value);
  const r = el("resultado");

  if (!conta || isNaN(valor) || valor <= 0) {
    r.textContent = "⚠️ Informe conta e valor válido para depósito.";
    return;
  }

  const res = await fetch(`/depositar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conta, valor }),
  });
  const data = await res.json();

  if (data.erro) {
    r.textContent = `⚠️ ${data.erro}`;
    return;
  }

  r.innerHTML = `💰 Depósito realizado. Saldo atual: <strong>${fmt(data.saldo)} €</strong>`;
  historico.unshift({ data: agora(), conta, tipo: "DEPOSITO", valor, saldoApos: data.saldo });
  renderHistorico();
}

async function levantar() {
  const conta = el("conta").value.trim();
  const valor = parseFloat(el("valor").value);
  const r = el("resultado");

  if (!conta || isNaN(valor) || valor <= 0) {
    r.textContent = "⚠️ Informe conta e valor válido para levantamento.";
    return;
  }

  const res = await fetch(`/levantar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conta, valor }),
  });
  const data = await res.json();

  if (data.erro) {
    r.textContent = `⚠️ ${data.erro}`;
    return;
  }

  r.innerHTML = `💸 Levantamento efetuado. Saldo atual: <strong>${fmt(data.saldo)} €</strong>`;
  historico.unshift({ data: agora(), conta, tipo: "LEVANTAMENTO", valor, saldoApos: data.saldo });
  renderHistorico();
}

async function consultar() {
  const conta = el("conta").value.trim();
  const r = el("resultado");

  if (!conta) {
    r.textContent = "⚠️ Informe o número da conta para consultar saldo.";
    return;
  }

  const res = await fetch(`/saldo/${encodeURIComponent(conta)}`);
  const data = await res.json();

  if (data.erro) {
    r.textContent = `⚠️ ${data.erro}`;
    return;
  }

  r.innerHTML = `📊 Saldo disponível: <strong>${fmt(data.saldo)} €</strong>`;
  historico.unshift({ data: agora(), conta, tipo: "SALDO", valor: null, saldoApos: data.saldo });
  renderHistorico();
}

function limparHistorico() {
  historico = [];
  renderHistorico();
  el("resultado").textContent = "🧹 Histórico limpo.";
}

// render inicial
renderHistorico();