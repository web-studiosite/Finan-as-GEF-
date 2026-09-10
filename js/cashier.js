/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Controle de Caixa – Turnos, Abertura, Fechamento e Sangria (js/cashier.js)
 * Conexão direta com Supabase para fechamento cego e conciliação financeira
 */

import { getSupabase, formatErrorMessage, getCurrentStoreId } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { renderIcons } from './icons.js';

/**
 * Consulta a sessão de caixa ativa do operador atual
 */
export async function getActiveCashierSession() {
  const client = getSupabase();
  const user = getCurrentUser();
  if (!client || !user) return null;

  const storeId = getCurrentStoreId();

  try {
    let query = client
      .from('cashier_sessions')
      .select('*')
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1);

    if (storeId && storeId !== 'ALL') {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;
    return data[0];
  } catch (err) {
    console.error('Erro ao verificar caixa:', err);
    return null;
  }
}

/**
 * Abre uma nova sessão de caixa
 */
export async function openCashierSession(initialAmount, notes) {
  const client = getSupabase();
  const user = getCurrentUser();
  if (!client) throw new Error('Supabase não conectado.');

  const storeId = getCurrentStoreId();
  const numInitial = Number(initialAmount) || 0;

  const { data, error } = await client
    .from('cashier_sessions')
    .insert({
      store_id: storeId,
      user_id: user?.id || null,
      operator_name: user?.fullName || 'Operador',
      initial_amount: numInitial,
      status: 'OPEN',
      notes: notes || 'Abertura de turno normal'
    })
    .select()
    .single();

  if (error) throw new Error(formatErrorMessage(error));

  await client.from('audit_logs').insert({
    store_id: storeId,
    user_id: user?.id || null,
    operator_name: user?.fullName || 'GEF',
    action: 'ABERTURA_CAIXA',
    entity: 'cashier_sessions',
    record_id: data.id,
    details: { fundo_troco: numInitial }
  });

  return data;
}

/**
 * Registra Sangria (retirada) ou Suprimento (aporte) no caixa
 */
export async function registerCashMovement(sessionId, type, amount, reason) {
  const client = getSupabase();
  const user = getCurrentUser();
  if (!client) throw new Error('Supabase não conectado.');

  const storeId = getCurrentStoreId();
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Informe um valor válido.');
  }

  await client.from('cash_movements').insert({
    session_id: sessionId,
    store_id: storeId,
    movement_type: type, // 'SANGRIA' ou 'SUPRIMENTO'
    amount: numAmount,
    reason: reason || (type === 'SANGRIA' ? 'Sangria de segurança' : 'Suprimento de troco'),
    operator_name: user?.fullName || 'GEF'
  });

  await client.from('audit_logs').insert({
    store_id: storeId,
    user_id: user?.id || null,
    operator_name: user?.fullName || 'GEF',
    action: type === 'SANGRIA' ? 'SANGRIA_CAIXA' : 'SUPRIMENTO_CAIXA',
    entity: 'cashier_sessions',
    record_id: sessionId,
    details: { tipo: type, valor: numAmount, motivo: reason }
  });

  return true;
}

/**
 * Fecha a sessão de caixa ativa
 */
export async function closeCashierSession(sessionId, countedAmount, notes) {
  const client = getSupabase();
  const user = getCurrentUser();
  if (!client) throw new Error('Supabase não conectado.');

  const storeId = getCurrentStoreId();
  const numCounted = Number(countedAmount) || 0;

  // Atualizar sessão
  const { data, error } = await client
    .from('cashier_sessions')
    .update({
      closing_amount: numCounted,
      closed_at: new Date().toISOString(),
      closed_by: user?.fullName || 'GEF',
      status: 'CLOSED',
      closing_notes: notes || 'Fechamento de turno'
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(formatErrorMessage(error));

  await client.from('audit_logs').insert({
    store_id: storeId,
    user_id: user?.id || null,
    operator_name: user?.fullName || 'GEF',
    action: 'FECHAMENTO_CAIXA',
    entity: 'cashier_sessions',
    record_id: sessionId,
    details: { valor_apurado: numCounted }
  });

  return data;
}

/**
 * Renderiza a view de Caixa
 */
export async function renderCashierView(container) {
  const user = getCurrentUser();

  container.innerHTML = `
    <div class="space-y-5">
      <!-- Topo -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 class="text-xl font-extrabold text-white flex items-center gap-2">
            <i data-lucide="wallet" class="w-5 h-5 text-orange-400"></i>
            Controle de Caixa & Turnos Operacionais
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">
            Abertura de turno, fundo de troco, sangria de segurança, reforço de numerário e conciliação cega.
          </p>
        </div>
        <button id="btnRefreshCashier" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Atualizar</span>
        </button>
      </div>

      <!-- Estado do Caixa -->
      <div id="cashierStatusContainer" class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div class="py-8 text-center text-slate-500 text-xs">
          <i data-lucide="refresh-cw" class="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2"></i>
          Verificando status da sessão de caixa...
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const statusContainer = container.querySelector('#cashierStatusContainer');
  const refreshBtn = container.querySelector('#btnRefreshCashier');

  const updateView = async () => {
    const session = await getActiveCashierSession();

    if (!session) {
      // Caixa Fechado
      statusContainer.innerHTML = `
        <div class="max-w-md mx-auto text-center space-y-4 py-6">
          <div class="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <i data-lucide="lock" class="w-8 h-8"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-white">O Caixa Encontra-se Fechado</h3>
            <p class="text-xs text-slate-400 mt-1">
              Inicie um novo turno informando o fundo de troco inicial em dinheiro na gaveta.
            </p>
          </div>
          <div class="pt-2">
            <button id="btnOpenSession" class="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-950/40 cursor-pointer transition active:scale-95">
              Abrir Novo Turno de Caixa
            </button>
          </div>
        </div>
      `;
      renderIcons(statusContainer);

      statusContainer.querySelector('#btnOpenSession').addEventListener('click', () => {
        const val = prompt('Informe o valor do Fundo de Troco Inicial (MT):', '1000.00');
        if (val !== null) {
          openCashierSession(val).then(updateView).catch(err => alert(err.message));
        }
      });
      return;
    }

    // Caixa Aberto
    const openedAtStr = new Date(session.opened_at).toLocaleString('pt-PT');
    statusContainer.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <i data-lucide="check" class="w-6 h-6"></i>
            </div>
            <div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                TURNO EM ANDAMENTO
              </span>
              <h3 class="text-base font-bold text-white mt-1">Operador: ${session.operator_name || user?.fullName}</h3>
              <span class="text-xs text-slate-400">Aberto em: ${openedAtStr}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnSangria" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition cursor-pointer">
              Sangria (Retirada)
            </button>
            <button id="btnSuprimento" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition cursor-pointer">
              Suprimento (Aporte)
            </button>
            <button id="btnCloseSession" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-sm cursor-pointer">
              Fechar Caixa
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Fundo de Troco Inicial</span>
            <span class="text-xl font-mono font-extrabold text-white block mt-1">
              ${Number(session.initial_amount || 0).toFixed(2)} MT
            </span>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Segurança Operacional</span>
            <span class="text-xs text-slate-300 block mt-1">
              Realize sangrias sempre que o valor em dinheiro na gaveta exceder os limites estipulados.
            </span>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Trilha de Auditoria</span>
            <span class="text-xs text-slate-300 block mt-1">
              Todos os movimentos de caixa são gravados imutavelmente com carimbo de data/hora.
            </span>
          </div>
        </div>
      </div>
    `;
    renderIcons(statusContainer);

    statusContainer.querySelector('#btnSangria').addEventListener('click', () => {
      const val = prompt('Informe o valor da SANGRIA (retirada) em MT:');
      if (val) {
        const reason = prompt('Motivo da sangria (ex: Depósito bancário / cofre):');
        registerCashMovement(session.id, 'SANGRIA', val, reason).then(updateView).catch(e => alert(e.message));
      }
    });

    statusContainer.querySelector('#btnSuprimento').addEventListener('click', () => {
      const val = prompt('Informe o valor do SUPRIMENTO (aporte) em MT:');
      if (val) {
        const reason = prompt('Motivo do suprimento (ex: Troco em notas miúdas):');
        registerCashMovement(session.id, 'SUPRIMENTO', val, reason).then(updateView).catch(e => alert(e.message));
      }
    });

    statusContainer.querySelector('#btnCloseSession').addEventListener('click', () => {
      const counted = prompt('CONCILIAÇÃO CEGA:\n\nInforme o valor total em dinheiro contado na gaveta física (MT):');
      if (counted !== null) {
        const notes = prompt('Observações finais do fechamento:');
        closeCashierSession(session.id, counted, notes).then(updateView).catch(e => alert(e.message));
      }
    });
  };

  refreshBtn.addEventListener('click', updateView);
  await updateView();
}
