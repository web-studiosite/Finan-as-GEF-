/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Auditoria & Trilha de Segurança Imutável (js/audit.js)
 * Consulta direta aos logs imutáveis gravados no Supabase
 */

import { getSupabase, getCurrentStoreId } from './supabase.js';
import { renderIcons } from './icons.js';

/**
 * Consulta a trilha de auditoria
 */
export async function fetchAuditLogs(limit = 100) {
  const client = getSupabase();
  if (!client) return [];

  const storeId = getCurrentStoreId();

  try {
    let query = client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (storeId && storeId !== 'ALL') {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar logs de auditoria:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Erro de conexão ao buscar auditoria:', err);
    return [];
  }
}

/**
 * Renderiza a view de Auditoria
 */
export async function renderAuditView(container) {
  container.innerHTML = `
    <div class="space-y-5">
      <!-- Topo -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 class="text-xl font-extrabold text-white flex items-center gap-2">
            <i data-lucide="shield-alert" class="w-5 h-5 text-orange-400"></i>
            Trilha de Auditoria & Segurança Operacional
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">
            Registro imutável de todas as ações sensíveis: vendas, estornos reversos, sangrias e alterações de preço.
          </p>
        </div>
        <button id="btnRefreshAudit" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Atualizar Logs</span>
        </button>
      </div>

      <!-- Filtro de Busca -->
      <div class="relative">
        <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
        <input
          type="text"
          id="auditSearchInput"
          placeholder="Filtrar por ação (ex: ESTORNO_VENDA), operador ou entidade..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-orange-500"
        />
      </div>

      <!-- Tabela de Auditoria -->
      <div class="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-md">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-700">
              <tr>
                <th class="py-3 px-4">Carimbo Data/Hora</th>
                <th class="py-3 px-4">Operador</th>
                <th class="py-3 px-4">Ação Registrada</th>
                <th class="py-3 px-4">Entidade</th>
                <th class="py-3 px-4">Detalhes Técnicos / Payload</th>
              </tr>
            </thead>
            <tbody id="auditTableBody" class="divide-y divide-slate-800/80 font-mono text-[11px]">
              <tr>
                <td colspan="5" class="py-12 text-center text-slate-500">
                  <i data-lucide="refresh-cw" class="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2"></i>
                  Consultando registros de auditoria no Supabase...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const searchInput = container.querySelector('#auditSearchInput');
  const tableBody = container.querySelector('#auditTableBody');
  const refreshBtn = container.querySelector('#btnRefreshAudit');

  let logs = [];

  const updateTable = () => {
    const q = (searchInput.value || '').toLowerCase().trim();
    const filtered = logs.filter(l => {
      if (!q) return true;
      return (
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.operator_name && l.operator_name.toLowerCase().includes(q)) ||
        (l.entity && l.entity.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-500">
            Nenhum registro de auditoria encontrado.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(l => {
      const dateStr = l.created_at ? new Date(l.created_at).toLocaleString('pt-PT') : '-';
      const detailsStr = l.details ? JSON.stringify(l.details) : '-';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 whitespace-nowrap text-slate-400">${dateStr}</td>
          <td class="py-3 px-4 text-white font-bold font-sans">${l.operator_name || 'GEF'}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-orange-400 border border-slate-700">
              ${l.action}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-300 font-sans uppercase text-[10px]">${l.entity}</td>
          <td class="py-3 px-4 text-slate-400 max-w-xs truncate" title="${detailsStr.replace(/"/g, '&quot;')}">
            ${detailsStr}
          </td>
        </tr>
      `;
    }).join('');
  };

  const reloadData = async () => {
    logs = await fetchAuditLogs();
    updateTable();
  };

  searchInput.addEventListener('input', updateTable);
  refreshBtn.addEventListener('click', reloadData);
  await reloadData();
}
