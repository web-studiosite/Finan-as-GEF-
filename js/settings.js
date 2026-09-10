/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Configurações do Sistema & Loja (js/settings.js)
 * Parâmetros de Impressora Térmica (58mm/80mm), Supabase e Dados da Empresa
 */

import { getSupabaseConfig, saveSupabaseConfig, getCurrentStoreId, setCurrentStoreId } from './supabase.js';
import { getReceiptConfig, saveReceiptConfig } from './receipts.js';
import { renderIcons } from './icons.js';

/**
 * Retorna as configurações da loja ativa para cabeçalho de recibo
 */
export async function fetchStoreConfig() {
  const receipt = getReceiptConfig();
  return {
    name: receipt.storeName || 'GEF MATERIAIS DE CONSTRUÇÃO',
    trade_name: receipt.storeName || 'GEF MATERIAIS DE CONSTRUÇÃO',
    cnpj_nif: receipt.nuit || '400123987',
    phone: receipt.phone || '+258 84 000 0000',
    address: receipt.address || 'Av. de Moçambique, Maputo',
    receipt_footer: receipt.footerMessage || 'Obrigado pela preferência!',
    currency: 'MT'
  };
}

/**
 * Renderiza a view de Configurações
 */
export async function renderSettingsView(container) {
  const supaConfig = getSupabaseConfig();
  const receiptConfig = getReceiptConfig();
  const activeStore = getCurrentStoreId() || 'LOJA-01';

  container.innerHTML = `
    <div class="space-y-6 max-w-4xl">
      <!-- Topo -->
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <h1 class="text-xl font-extrabold text-white flex items-center gap-2">
          <i data-lucide="settings" class="w-5 h-5 text-orange-400"></i>
          Configurações do Sistema & Impressão Térmica
        </h1>
        <p class="text-xs text-slate-400 mt-0.5">
          Ajuste as preferências da impressora térmica de 80mm/58mm, cabeçalho de recibo e conexão PostgreSQL / Supabase.
        </p>
      </div>

      <!-- Configuração da Impressora Térmica & Recibo -->
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="printer" class="w-4 h-4 text-orange-400"></i>
          <span>Parâmetros de Impressão Térmica de Recibos</span>
        </h3>

        <form id="receiptConfigForm" class="space-y-4 text-xs text-slate-300">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Largura da Bobina Térmica</label>
              <select id="cfgPaperWidth" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono">
                <option value="80mm" ${receiptConfig.paperWidth === '80mm' ? 'selected' : ''}>80mm (Padrão Comercial / Balcão)</option>
                <option value="58mm" ${receiptConfig.paperWidth === '58mm' ? 'selected' : ''}>58mm (Mini Impressora Térmica Portátil)</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Nome Comercial da Loja no Recibo</label>
              <input type="text" id="cfgStoreName" value="${receiptConfig.storeName || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">NUIT / Registo Comercial</label>
              <input type="text" id="cfgNuit" value="${receiptConfig.nuit || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" />
            </div>
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Telefone de Atendimento</label>
              <input type="text" id="cfgPhone" value="${receiptConfig.phone || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Endereço da Loja Físico</label>
            <input type="text" id="cfgAddress" value="${receiptConfig.address || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white" />
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Mensagem de Rodapé do Recibo</label>
            <input type="text" id="cfgFooter" value="${receiptConfig.footerMessage || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white" />
          </div>

          <div class="flex justify-end pt-2">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-950/40 cursor-pointer transition active:scale-95">
              Salvar Parâmetros de Impressão
            </button>
          </div>
        </form>
      </div>

      <!-- Configuração de Conexão Supabase -->
      <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="database" class="w-4 h-4 text-emerald-400"></i>
          <span>Conexão Supabase / PostgreSQL em Nuvem</span>
        </h3>
        <p class="text-xs text-slate-400">
          As credenciais são mantidas seguras no navegador e utilizadas para sincronização em tempo real de todas as vendas e estoques.
        </p>

        <form id="supaConfigForm" class="space-y-4 text-xs text-slate-300">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Project URL do Supabase</label>
            <input type="url" id="cfgSupaUrl" value="${supaConfig.url || ''}" placeholder="https://seu-projeto.supabase.co" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" />
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Anon / Public API Key</label>
            <input type="text" id="cfgSupaKey" value="${supaConfig.anonKey || ''}" placeholder="eyJhbGciOi..." class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono" />
          </div>

          <div class="flex justify-end pt-2">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 cursor-pointer transition active:scale-95">
              Testar & Salvar Conexão
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  renderIcons(container);

  // Evento formulário de recibo
  container.querySelector('#receiptConfigForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveReceiptConfig({
      paperWidth: container.querySelector('#cfgPaperWidth').value,
      storeName: container.querySelector('#cfgStoreName').value,
      nuit: container.querySelector('#cfgNuit').value,
      phone: container.querySelector('#cfgPhone').value,
      address: container.querySelector('#cfgAddress').value,
      footerMessage: container.querySelector('#cfgFooter').value
    });
    alert('Configurações de recibo e impressora salvas com sucesso!');
  });

  // Evento formulário de supabase
  container.querySelector('#supaConfigForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = container.querySelector('#cfgSupaUrl').value.trim();
    const key = container.querySelector('#cfgSupaKey').value.trim();
    if (url && key) {
      saveSupabaseConfig(url, key);
      alert('Configurações de conexão atualizadas! A página será recarregada.');
      window.location.reload();
    } else {
      alert('Preencha a URL e a Chave do Supabase.');
    }
  });
}
