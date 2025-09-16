// ---------- Utilidades ----------
const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const byId = (id) => document.getElementById(id);

// ---------- Estado (mantido com closure + persistência) ----------
function criarContaPersistente(chave = 'conta_bancaria') {
  // tenta carregar do localStorage
  const salvo = JSON.parse(localStorage.getItem(chave) || '{}');
  let saldo = Number.isFinite(salvo.saldo) ? salvo.saldo : 0;
  let historico = Array.isArray(salvo.historico) ? salvo.historico : [];

  function guardar() {
    localStorage.setItem(chave, JSON.stringify({ saldo, historico }));
  }

  return {
    depositar(valor, descricao = '') {
      saldo += valor;
      historico.unshift({
        id: crypto.randomUUID(),
        data: new Date().toISOString(),
        tipo: 'deposito',
        valor,
        descricao: descricao?.trim() || ''
      });
      guardar();
      return saldo;
    },
    levantar(valor, descricao = '') {
      if (valor > saldo) throw new Error('Saldo insuficiente.');
      saldo -= valor;
      historico.unshift({
        id: crypto.randomUUID(),
        data: new Date().toISOString(),
        tipo: 'levantamento',
        valor,
        descricao: descricao?.trim() || ''
      });
      guardar();
      return saldo;
    },
    verSaldo() { return saldo; },
    historico() { return [...historico]; },
    limpar() { saldo = 0; historico = []; guardar(); }
  };
}

// ---------- Inicialização ----------
const conta = criarContaPersistente();
const elSaldo = byId('saldo');
const elMsg = byId('msg');
const elTipo = byId('tipo');
const elValor = byId('valor');
const elDescricao = byId('descricao');
const elTbody = byId('tbodyTransacoes');
const elFiltroTexto = byId('filtroTexto');
const elFiltroTipo = byId('filtroTipo');
const btnReset = byId('btnReset');
const btnExport = byId('btnExport');

atualizarSaldo();
renderHistorico();

// ---------- Eventos ----------
document.getElementById('formOperacao').addEventListener('submit', (e) => {
  e.preventDefault();
  limparMsg();

  const tipo = elTipo.value;
  const valor = Number(elValor.value.replace(',', '.'));
  const descricao = elDescricao.value;

  if (!Number.isFinite(valor) || valor <= 0) {
    return mostrarMsg('Insere um valor válido maior que zero.', true);
  }

  try {
    if (tipo === 'deposito') {
      conta.depositar(valor, descricao);
      mostrarMsg('Depósito realizado com sucesso.');
    } else {
      conta.levantar(valor, descricao);
      mostrarMsg('Levantamento realizado com sucesso.');
    }
    elValor.value = '';
    elDescricao.value = '';
    atualizarSaldo();
    renderHistorico();
  } catch (err) {
    mostrarMsg(err.message, true);
  }
});

btnReset.addEventListener('click', () => {
  if (confirm('Tens a certeza que queres reiniciar o saldo e limpar o histórico?')) {
    conta.limpar();
    atualizarSaldo();
    renderHistorico();
    mostrarMsg('Conta reiniciada.');
  }
});

btnExport.addEventListener('click', () => {
  const data = {
    saldo: conta.verSaldo(),
    historico: conta.historico()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conta_bancaria.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

elFiltroTexto.addEventListener('input', renderHistorico);
elFiltroTipo.addEventListener('change', renderHistorico);

// ---------- Funções de UI ----------
function atualizarSaldo() {
  elSaldo.textContent = fmt.format(conta.verSaldo());
}

function mostrarMsg(texto, isErro = false) {
  elMsg.textContent = texto;
  elMsg.className = 'msg ' + (isErro ? 'error' : 'success');
}

function limparMsg() {
  elMsg.textContent = '';
  elMsg.className = 'msg';
}

function renderHistorico() {
  const termo = elFiltroTexto.value.toLowerCase().trim();
  const tipoFiltro = elFiltroTipo.value;

  const linhas = conta.historico()
    .filter(tx => {
      const okTipo = tipoFiltro === 'todos' ? true : tx.tipo === tipoFiltro;
      const okTexto = termo ? (tx.descricao?.toLowerCase().includes(termo)) : true;
      return okTipo && okTexto;
    })
    .map(tx => {
      const tr = document.createElement('tr');
      const dataPt = new Date(tx.data).toLocaleString('pt-PT');
      tr.innerHTML = `
        <td>${dataPt}</td>
        <td>${tx.tipo === 'deposito' ? 'Depósito' : 'Levantamento'}</td>
        <td>${fmt.format(tx.valor)}</td>
        <td>${escapeHtml(tx.descricao || '')}</td>
      `;
      return tr;
    });

  elTbody.innerHTML = '';
  if (linhas.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="color:#94a3b8">Sem transações.</td>`;
    elTbody.appendChild(tr);
  } else {
    linhas.forEach(tr => elTbody.appendChild(tr));
  }
}

// evitar injetar HTML acidental na descrição
function escapeHtml(str) {
  return str.replaceAll(/&/g, '&amp;')
            .replaceAll(/</g, '&lt;')
            .replaceAll(/>/g, '&gt;')
            .replaceAll(/"/g, '&quot;')
            .replaceAll(/'/g, '&#039;');
}

function exportarCSV(transacoes) {
  const linhas = ["Data,Tipo,Valor,Descrição"];
  transacoes.forEach(t => {
    linhas.push(`${t.created_at},${t.type},${t.amount},${t.description || ""}`);
  });
  const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico.csv";
  a.click();
}

let cacheTransacoes = []; // guardar transações na memória

async function carregarHistorico() {
  const resp = await fetch(`${API_URL}/transactions`);
  const transacoes = await resp.json();
  cacheTransacoes = transacoes; // atualizar cache
  const lista = document.getElementById("historico");
  lista.innerHTML = "";
  transacoes.forEach(tx => {
    const li = document.createElement("li");
    li.textContent = `${tx.created_at} - ${tx.type} - €${tx.amount} (${tx.description})`;
    lista.appendChild(li);
  });
}

// Evento do botão exportar
document.getElementById("btnExportar").addEventListener("click", () => {
  exportarCSV(cacheTransacoes);
});
// utilidades
const fmtValor = (n) => new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const fmtData  = (iso) => new Date(iso).toLocaleString('pt-PT');

// gera um PDF de extrato com jsPDF + autoTable
async function exportarPDF(transacoes, saldoAtual) {
  // @ts-ignore (para VS Code não chatear)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" }); // A4 em pontos

  // cabeçalho
  const titulo = "Extrato da Conta";
  const sub    = `Gerado em ${new Date().toLocaleString('pt-PT')}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(titulo, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(sub, 40, 58);

  // saldo atual (banner)
  doc.setFontSize(12);
  doc.text(`Saldo atual: ${fmtValor(saldoAtual)}`, 40, 80);

  // preparar linhas para a tabela
  const rows = transacoes.map(tx => ([
    fmtData(tx.created_at),
    tx.type === "deposit" ? "Depósito" : "Levantamento",
    fmtValor(tx.amount),
    tx.description || ""
  ]));

  // tabela
  doc.autoTable({
    startY: 100,
    head: [["Data", "Tipo", "Valor", "Descrição"]],
    body: rows,
    styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
    headStyles: { fillColor: [34, 197, 94] }, // verde (podes remover para padrão)
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 110 },
      2: { cellWidth: 100, halign: 'right' },
      3: { cellWidth: 'auto' }
    },
    didDrawPage: (data) => {
      // footer com paginação
      const pageSize = doc.internal.pageSize;
      const page = doc.getNumberOfPages();
      doc.setFontSize(9);
      doc.text(`Página ${page}`, pageSize.getWidth() - 60, pageSize.getHeight() - 20);
    }
  });

  // guardar
  doc.save("extrato_conta.pdf");
}

// ligar o botão PDF (reutiliza as transações que já carregaste)
document.getElementById("btnExportarPDF")?.addEventListener("click", async () => {
  // se já tens cacheTransacoes e uma função que lê saldo, usa-as; senão, pede à API:
  const [txResp, saldoResp] = await Promise.all([
    fetch(`${API_URL}/transactions`),
    fetch(`${API_URL}/balance`)
  ]);
  const transacoes = await txResp.json();
  const saldoObj = await saldoResp.json();
  await exportarPDF(transacoes, saldoObj.balance);
});
// Função para exportar histórico em PDF
async function exportarPDF() {
  try {
    const resp = await fetch(`${API_URL}/transactions`);
    const transacoes = await resp.json();

    if (!transacoes.length) {
      alert("Não há transações para exportar.");
      return;
    }

    const doc = new jspdf.jsPDF();

    doc.setFontSize(18);
    doc.text("Histórico de Transações", 14, 20);

    // Prepara os dados em tabela
    const colunas = ["Data", "Tipo", "Valor (€)", "Descrição"];
    const linhas = transacoes.map(t => [
      t.created_at,
      t.type,
      t.amount.toFixed(2),
      t.description || ""
    ]);

    // Gera tabela
    doc.autoTable({
      startY: 30,
      head: [colunas],
      body: linhas,
    });

    // Salvar PDF
    doc.save("historico.pdf");
  } catch (err) {
    console.error("Erro ao exportar:", err);
    alert("Erro ao exportar histórico");
  }
}

// Associar evento ao botão
document.getElementById("btnExportarPDF")
  .addEventListener("click", exportarPDF);

document.getElementById("btnExportarPDF").addEventListener("click", async () => {
  try {
    // 1) Vai buscar transações à API
    const resp = await fetch(`${API_URL}/transactions`);
    const transacoes = await resp.json();

    if (!transacoes.length) {
      alert("Não há transações para exportar.");
      return;
    }

    // 2) Cria documento PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Título
    doc.setFontSize(16);
    doc.text("Histórico de Transações - Conta Bancária", 14, 15);

    // 3) Prepara tabela
    const colunas = ["Data", "Tipo", "Valor (€)", "Descrição"];
    const linhas = transacoes.map(t => [
      t.created_at,
      t.type === "deposit" ? "Depósito" : "Levantamento",
      t.amount.toFixed(2),
      t.description || ""
    ]);

    // 4) Gera tabela no PDF
    doc.autoTable({
      head: [colunas],
      body: linhas,
      startY: 25
    });

    // 5) Faz download
    doc.save("historico-transacoes.pdf");
  } catch (err) {
    console.error("Erro ao exportar PDF:", err);
    alert("Erro ao exportar histórico.");
  }
});
// ---- Exportar CSV ----
document.getElementById("btnExportarCSV").addEventListener("click", async () => {
  try {
    const resp = await fetch(`${API_URL}/transactions`);
    const transacoes = await resp.json();
    if (!transacoes.length) {
      alert("Não há transações para exportar.");
      return;
    }

    // Cabeçalho
    const headers = ["Data", "Tipo", "Valor (€)", "Descrição"];
    const linhas = [headers];

    // Linhas (escapar vírgulas/aspas; usar ; como separador PT-friendly)
    const toCSVCell = (val) => {
      const s = String(val ?? "");
      // troca quebras de linha por espaço; duplica aspas
      const clean = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
      // se contiver ; ou " envolve em aspas
      return /[;""]/.test(clean) ? `"${clean}"` : clean;
    };

    transacoes.forEach(t => {
      const row = [
        t.created_at,
        t.type === "deposit" ? "Depósito" : "Levantamento",
        Number(t.amount).toFixed(2),
        t.description || ""
      ].map(toCSVCell);
      linhas.push(row);
    });

    // Junta tudo com ; e \n
    const csv = linhas.map(r => r.join(";")).join("\n");

    // Gera download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico-transacoes.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Erro ao exportar CSV.");
  }
});
// ===== Exportar PDF do histórico =====
const btnPDF = document.getElementById("btnExportarPDF");
if (btnPDF) {
  btnPDF.addEventListener("click", async () => {
    try {
      // 0) sanity checks
      if (!window.jspdf) {
        console.error("jsPDF não está disponível em window.jspdf");
        alert("Biblioteca jsPDF não carregou. Confere as <script> tags no index.html.");
        return;
      }
      const { jsPDF } = window.jspdf;

      // 1) obter transações da API
      const resp = await fetch(`${API_URL}/transactions`);
      if (!resp.ok) throw new Error(`Falha ao buscar transações: ${resp.status}`);
      const transacoes = await resp.json();
      if (!Array.isArray(transacoes) || transacoes.length === 0) {
        alert("Não há transações para exportar.");
        return;
      }

      // 2) preparar dados
      const cabecalho = ["Data", "Tipo", "Valor (€)", "Descrição"];
      const linhas = transacoes.map(t => [
        t.created_at,
        t.type === "deposit" ? "Depósito" : "Levantamento",
        Number(t.amount).toFixed(2),
        t.description || ""
      ]);

      // 3) gerar PDF
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text("Histórico de Transações - Conta 1", 40, 40);

      // autotable (garante que o plugin carregou)
      if (typeof doc.autoTable !== "function") {
        console.error("autoTable não está disponível. Confere a tag do jspdf-autotable.");
        alert("Plugin jsPDF-Autotable não carregou.");
        return;
      }

      doc.autoTable({
        head: [cabecalho],
        body: linhas,
        startY: 60,
        styles: { fontSize: 10, cellPadding: 6 }
      });

      // 4) download
      doc.save("historico-transacoes.pdf");
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
      alert("Erro ao exportar PDF. Vê a consola (F12) para detalhes.");
    }
  });
} else {
  console.warn('Botão "#btnExportarPDF" não encontrado no DOM.');
}
