/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Relatórios Financeiros, DRE e Curva ABC (js/reports.js)
 * Consolidação e apuração financeira diretamente de dados do Supabase
 */

import { getSupabase, getCurrentStoreId } from './supabase.js';
import { renderIcons } from './icons.js';

/**
 * Consulta e consolida o DRE e Curva ABC de vendas
 */
export async function fetchFinancialReportData(startDate, endDate) {
  const client = getSupabase();
  if (!client) return null;

  const storeId = getCurrentStoreId();

  try {
    let salesQuery = client
      .from('sales')
      .select('*, sale_items(*)')
      .neq('status', 'CANCELADA');

    if (storeId && storeId !== 'ALL') {
      salesQuery = salesQuery.eq('store_id', storeId);
    }
    if (startDate) {
      salesQuery = salesQuery.gte('created_at', startDate);
    }
    if (endDate) {
      salesQuery = salesQuery.lte('created_at', endDate);
    }

    const { data: sales, error } = await salesQuery;
    if (error) throw error;

    let grossRevenue = 0;
    let totalDiscounts = 0;
    let netRevenue = 0;
    let totalCogs = 0;

    const paymentTotals = {};
    const productTotals = {};

    (sales || []).forEach(s => {
      grossRevenue += Number(s.subtotal || s.total_net || 0);
      totalDiscounts += Number(s.discount_amount || 0);
      netRevenue += Number(s.total_net || 0);

      // Pagamentos
      const method = s.payment_method || 'OUTROS';
      paymentTotals[method] = (paymentTotals[method] || 0) + Number(s.total_net || 0);

      // Itens e CMV
      if (Array.isArray(s.sale_items)) {
        s.sale_items.forEach(it => {
          const cogs = Number(it.total_cogs || (it.unit_cogs * it.quantity) || 0);
          totalCogs += cogs;

          const prodKey = it.product_name || 'Item Desconhecido';
          if (!productTotals[prodKey]) {
            productTotals[prodKey] = { name: prodKey, revenue: 0, qty: 0 };
          }
          productTotals[prodKey].revenue += Number(it.total_price || 0);
          productTotals[prodKey].qty += Number(it.quantity || 0);
        });
      }
    });

    const grossProfit = netRevenue - totalCogs;
    const grossMargin = netRevenue > 0 ? ((grossProfit / netRevenue) * 100) : 0;

    // Curva ABC de Produtos
    const sortedProducts = Object.values(productTotals).sort((a, b) => b.revenue - a.revenue);
    let cumulativeRevenue = 0;
    const abcProducts = sortedProducts.map(p => {
      cumulativeRevenue += p.revenue;
      const pct = netRevenue > 0 ? (cumulativeRevenue / netRevenue) * 100 : 0;
      let classification = 'C';
      if (pct <= 80) classification = 'A';
      else if (pct <= 95) classification = 'B';
      return { ...p, cumulativePct: pct, classification };
    });

    return {
      grossRevenue,
      totalDiscounts,
      netRevenue,
      totalCogs,
      grossProfit,
      grossMargin,
      paymentTotals,
      abcProducts
    };
  } catch (err) {
    console.error('Erro ao processar relatório financeiro:', err);
    return null;
  }
}

/**
 * Renderiza a view de Relatórios
 */
export async function renderReportsView(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <!-- Topo -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 class="text-xl font-extrabold text-white flex items-center gap-2">
            <i data-lucide="bar-chart-3" class="w-5 h-5 text-orange-400"></i>
            Demonstrativo Financeiro & Curva ABC
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">
            DRE gerencial (Receita, CMV e Lucro Bruto) e classificação ABC de materiais por faturamento.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btnExportCsv" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Exportar CSV</span>
          </button>
          <button id="btnRefreshReports" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition active:scale-95 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <!-- DRE Sintético -->
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="calculator" class="w-4 h-4 text-emerald-400"></i>
          <span>DRE – Demonstrativo do Resultado do Exercício (Gerencial)</span>
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Receita Bruta</span>
            <span id="repGrossRev" class="text-xl font-mono font-extrabold text-white block mt-1">0.00 MT</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">(-) CMV / Custo de Estoque</span>
            <span id="repCogs" class="text-xl font-mono font-extrabold text-red-400 block mt-1">0.00 MT</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">(=) Lucro Bruto Operacional</span>
            <span id="repGrossProfit" class="text-xl font-mono font-extrabold text-emerald-400 block mt-1">0.00 MT</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Margem Bruta Média</span>
            <span id="repGrossMargin" class="text-xl font-mono font-extrabold text-cyan-400 block mt-1">0.0%</span>
          </div>
        </div>
      </div>

      <!-- Curva ABC de Materiais -->
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="layers" class="w-4 h-4 text-orange-400"></i>
            <span>Curva ABC de Materiais Mais Vendidos</span>
          </h3>
          <span class="text-xs text-slate-400">Classe A: 80% faturamento | B: 15% | C: 5%</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase font-mono border-b border-slate-700">
              <tr>
                <th class="py-2.5 px-3">Classificação</th>
                <th class="py-2.5 px-3">Material</th>
                <th class="py-2.5 px-3 text-right">Qtd Vendida</th>
                <th class="py-2.5 px-3 text-right">Faturamento Total</th>
                <th class="py-2.5 px-3 text-right">% Acumulada</th>
              </tr>
            </thead>
            <tbody id="repAbcTableBody" class="divide-y divide-slate-800/80">
              <tr>
                <td colspan="5" class="py-8 text-center text-slate-500">
                  Carregando apuração ABC...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const grossRevEl = container.querySelector('#repGrossRev');
  const cogsEl = container.querySelector('#repCogs');
  const grossProfitEl = container.querySelector('#repGrossProfit');
  const grossMarginEl = container.querySelector('#repGrossMargin');
  const abcBody = container.querySelector('#repAbcTableBody');
  const refreshBtn = container.querySelector('#btnRefreshReports');
  const exportBtn = container.querySelector('#btnExportCsv');

  let currentData = null;

  const loadReport = async () => {
    currentData = await fetchFinancialReportData();
    if (!currentData) {
      abcBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Nenhum dado financeiro encontrado.</td></tr>`;
      return;
    }

    grossRevEl.textContent = `${currentData.netRevenue.toFixed(2)} MT`;
    cogsEl.textContent = `-${currentData.totalCogs.toFixed(2)} MT`;
    grossProfitEl.textContent = `${currentData.grossProfit.toFixed(2)} MT`;
    grossMarginEl.textContent = `${currentData.grossMargin.toFixed(1)}%`;

    if (currentData.abcProducts.length === 0) {
      abcBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Nenhum item vendido registrado até o momento.</td></tr>`;
      return;
    }

    abcBody.innerHTML = currentData.abcProducts.map(p => {
      const badgeColor = p.classification === 'A' 
        ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30'
        : p.classification === 'B'
        ? 'bg-amber-950 text-amber-400 border-amber-500/30'
        : 'bg-slate-800 text-slate-400 border-slate-700';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}">
              Classe ${p.classification}
            </span>
          </td>
          <td class="py-2.5 px-3 font-semibold text-white">${p.name}</td>
          <td class="py-2.5 px-3 text-right font-mono">${p.qty}</td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-white">${p.revenue.toFixed(2)} MT</td>
          <td class="py-2.5 px-3 text-right font-mono text-slate-400">${p.cumulativePct.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
  };

  exportBtn.addEventListener('click', () => {
    if (!currentData || currentData.abcProducts.length === 0) {
      alert('Sem dados para exportar.');
      return;
    }
    let csv = 'Classificacao,Material,Quantidade,Faturamento_MT,Percentual_Acumulado\n';
    currentData.abcProducts.forEach(p => {
      csv += `"${p.classification}","${p.name}",${p.qty},${p.revenue.toFixed(2)},${p.cumulativePct.toFixed(1)}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `curva_abc_materiais_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  refreshBtn.addEventListener('click', loadReport);
  await loadReport();
}

/**
 * Utilitários de Exportação de Dados
 */
export function convertArrayToCsv(items, headers) {
  if (!items || !items.length) return '';
  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);

  const csvRows = [];
  csvRows.push(headerLabels.map(l => `"${String(l).replace(/"/g, '""')}"`).join(','));

  for (const item of items) {
    const row = headerKeys.map(key => {
      const val = item[key] !== undefined && item[key] !== null ? item[key] : '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  }

  return csvRows.join('\r\n');
}

export function triggerFileDownload(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProductsToCsv(products) {
  const headers = {
    code: 'Codigo',
    name: 'Nome_Material',
    category: 'Categoria',
    base_unit: 'Unidade',
    current_stock_base: 'Estoque_Total',
    cost_price_base: 'Preco_Custo_MT',
    sale_price_base: 'Preco_Venda_MT'
  };
  const csv = convertArrayToCsv(products, headers);
  triggerFileDownload(csv, `catalogo_materiais_${new Date().toISOString().slice(0, 10)}.csv`);
}

