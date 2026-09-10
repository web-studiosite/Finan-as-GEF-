/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Fornecedores & Pedidos de Compra (js/suppliers.js)
 * Conexão direta com Supabase para gerenciar fornecedores e compras de insumos
 */

import { getSupabase, formatErrorMessage, getCurrentStoreId } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { renderIcons } from './icons.js';

let suppliersCache = [];

/**
 * Consulta fornecedores no Supabase
 */
export async function fetchSuppliers(storeIdParam = null) {
  const client = getSupabase();
  if (!client) return [];

  const storeId = storeIdParam || getCurrentStoreId();

  try {
    let query = client
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (storeId && storeId !== 'ALL') {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar fornecedores:', error);
      return [];
    }

    suppliersCache = (data || []).map(s => ({
      id: s.id,
      store_id: s.store_id,
      name: s.name,
      contact_person: s.contact_person || '',
      tax_id: s.tax_id || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
      active: s.active !== false
    }));

    return suppliersCache;
  } catch (err) {
    console.error('Erro de conexão ao buscar fornecedores:', err);
    return [];
  }
}

/**
 * Cadastra ou edita um fornecedor
 */
export async function saveSupplier(supplierData) {
  const client = getSupabase();
  const user = getCurrentUser();

  if (!client) throw new Error('Supabase não conectado.');
  const storeId = supplierData.store_id || getCurrentStoreId();
  if (!storeId || storeId === 'ALL') {
    throw new Error('Selecione uma loja específica antes de salvar o fornecedor.');
  }

  const payload = {
    store_id: storeId,
    name: supplierData.name?.trim(),
    contact_person: supplierData.contact_person?.trim() || null,
    tax_id: supplierData.tax_id?.trim() || null,
    phone: supplierData.phone?.trim() || null,
    email: supplierData.email?.trim() || null,
    address: supplierData.address?.trim() || null,
    notes: supplierData.notes?.trim() || null,
    active: true
  };

  let saved = null;
  if (supplierData.id) {
    const { data, error } = await client
      .from('suppliers')
      .update(payload)
      .eq('id', supplierData.id)
      .select()
      .single();

    if (error) throw new Error(formatErrorMessage(error));
    saved = data;
  } else {
    const { data, error } = await client
      .from('suppliers')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(formatErrorMessage(error));
    saved = data;
  }

  await client.from('audit_logs').insert({
    store_id: storeId,
    user_id: user?.id || null,
    operator_name: user?.fullName || 'GEF',
    action: supplierData.id ? 'ATUALIZACAO_FORNECEDOR' : 'CADASTRO_FORNECEDOR',
    entity: 'suppliers',
    record_id: saved.id,
    details: { nome: saved.name }
  });

  return saved;
}

/**
 * Renderiza a view de Fornecedores
 */
export async function renderSuppliersView(container) {
  container.innerHTML = `
    <div class="space-y-5">
      <!-- Topo -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 class="text-xl font-extrabold text-white flex items-center gap-2">
            <i data-lucide="truck" class="w-5 h-5 text-orange-400"></i>
            Gestão de Fornecedores & Fábricas
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">
            Cadastro de distribuidores de cimento, siderúrgicas, pedreiras e fornecedores de tintas.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btnRefreshSuppliers" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Atualizar</span>
          </button>
          <button id="btnNewSupplier" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition active:scale-95 cursor-pointer">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Cadastrar Fornecedor</span>
          </button>
        </div>
      </div>

      <!-- Filtro de Busca -->
      <div class="relative">
        <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
        <input
          type="text"
          id="searchSuppliersInput"
          placeholder="Pesquisar por razão social, contato, telefone ou NUIT..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-orange-500"
        />
      </div>

      <!-- Grade de Fornecedores -->
      <div id="suppliersGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="col-span-full py-12 text-center text-slate-500 text-xs">
          <i data-lucide="refresh-cw" class="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2"></i>
          Carregando fornecedores do banco...
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const searchInput = container.querySelector('#searchSuppliersInput');
  const grid = container.querySelector('#suppliersGrid');
  const refreshBtn = container.querySelector('#btnRefreshSuppliers');
  const newBtn = container.querySelector('#btnNewSupplier');

  let suppliersList = [];

  const updateGrid = () => {
    const q = (searchInput.value || '').toLowerCase().trim();
    const filtered = suppliersList.filter(s => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.tax_id && s.tax_id.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-500 text-xs">
          Nenhum dado encontrado.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(s => `
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-slate-700 transition shadow-xs">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm text-white truncate max-w-[200px]">${s.name}</h3>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              ATIVO
            </span>
          </div>
          <div class="text-[11px] text-slate-400 space-y-0.5">
            <div>Contato: <strong class="text-slate-300">${s.contact_person || 'Setor Comercial'}</strong></div>
            <div>Telefone: <span class="text-slate-300 font-mono">${s.phone || '-'}</span></div>
            <div>NUIT: <span class="text-slate-300 font-mono">${s.tax_id || '-'}</span></div>
            ${s.address ? `<div class="truncate">Endereço: ${s.address}</div>` : ''}
          </div>
        </div>
        <div class="pt-3 border-t border-slate-800 flex justify-end">
          <button class="btn-edit-sup text-xs text-orange-400 hover:text-orange-300 font-semibold cursor-pointer" data-id="${s.id}">
            Editar Fornecedor &rarr;
          </button>
        </div>
      </div>
    `).join('');

    renderIcons(grid);

    grid.querySelectorAll('.btn-edit-sup').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = suppliersList.find(item => item.id === btn.dataset.id);
        if (s) openSupplierModal(s, reloadData);
      });
    });
  };

  const reloadData = async () => {
    suppliersList = await fetchSuppliers();
    updateGrid();
  };

  searchInput.addEventListener('input', updateGrid);
  refreshBtn.addEventListener('click', reloadData);
  newBtn.addEventListener('click', () => openSupplierModal(null, reloadData));

  await reloadData();
}

function openSupplierModal(existing, onSuccess) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4';
  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 text-xs text-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 class="font-bold text-base text-white">${existing ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h3>
        <button id="closeSupModalBtn" class="text-slate-400 hover:text-white cursor-pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <form id="supForm" class="space-y-3">
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Razão Social / Fábrica *</label>
          <input type="text" id="supName" required value="${existing?.name || ''}" placeholder="Ex: Cimentos de Moçambique, S.A." class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Pessoa de Contato</label>
            <input type="text" id="supContact" value="${existing?.contact_person || ''}" placeholder="Ex: Sr. Armando" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs" />
          </div>
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Telefone</label>
            <input type="text" id="supPhone" value="${existing?.phone || ''}" placeholder="+258 21 000 000" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">NUIT da Empresa</label>
            <input type="text" id="supTaxId" value="${existing?.tax_id || ''}" placeholder="400123456" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs" />
          </div>
          <div>
            <label class="block text-slate-300 font-semibold mb-1">E-mail Comercial</label>
            <input type="email" id="supEmail" value="${existing?.email || ''}" placeholder="vendas@fornecedor.co.mz" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs" />
          </div>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Endereço da Fábrica / Armazém</label>
          <input type="text" id="supAddress" value="${existing?.address || ''}" placeholder="Zona Industrial, Maputo / Matola" class="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs" />
        </div>
        <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" id="cancelSupBtn" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer">Cancelar</button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold cursor-pointer">Salvar Fornecedor</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  renderIcons(modal);

  const close = () => modal.remove();
  modal.querySelector('#closeSupModalBtn').addEventListener('click', close);
  modal.querySelector('#cancelSupBtn').addEventListener('click', close);
  modal.querySelector('#supForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveSupplier({
        id: existing?.id,
        name: modal.querySelector('#supName').value,
        contact_person: modal.querySelector('#supContact').value,
        phone: modal.querySelector('#supPhone').value,
        tax_id: modal.querySelector('#supTaxId').value,
        email: modal.querySelector('#supEmail').value,
        address: modal.querySelector('#supAddress').value
      });
      close();
      onSuccess();
    } catch (err) {
      alert(err.message || 'Erro ao salvar fornecedor.');
    }
  });
}
