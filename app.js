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
