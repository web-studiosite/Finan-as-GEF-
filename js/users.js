/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Gestão de Usuários & Perfis RBAC (js/users.js)
 * Controle de permissões (ADMIN, GERENTE, OPERADOR_CAIXA, ESTOQUISTA)
 */

import { getSupabase, formatErrorMessage, getCurrentStoreId } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { renderIcons } from './icons.js';

let usersCache = [];

/**
 * Consulta usuários do sistema no Supabase
 */
export async function fetchSystemUsers(storeIdParam = null) {
  const client = getSupabase();
  if (!client) return [];

  const storeId = storeIdParam || getCurrentStoreId();

  try {
    let query = client
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (storeId && storeId !== 'ALL') {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar usuários no profiles:', error);
      return [];
    }

    usersCache = (data || []).map(u => ({
      id: u.id,
      store_id: u.store_id,
      email: u.email || '',
      full_name: u.full_name || 'Usuário',
      role: u.role || 'OPERADOR_CAIXA',
      active: u.active !== false,
      created_at: u.created_at
    }));

    return usersCache;
  } catch (err) {
    console.error('Erro de conexão ao buscar perfis:', err);
    return [];
  }
}

/**
 * Atualiza o cargo/perfil RBAC de um usuário
 */
export async function updateUserRole(userId, newRole) {
  const client = getSupabase();
  const operator = getCurrentUser();
  if (!client) throw new Error('Supabase não conectado.');

  const { error } = await client
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw new Error(formatErrorMessage(error));

  await client.from('audit_logs').insert({
    store_id: getCurrentStoreId() || null,
    user_id: operator?.id || null,
    operator_name: operator?.fullName || 'GEF',
    action: 'ALTERACAO_PERMISSAO_USUARIO',
    entity: 'profiles',
    record_id: userId,
    details: { novo_cargo: newRole }
  });

  return true;
}

/**
 * Renderiza a view de Usuários
 */
export async function renderUsersView(container) {
  container.innerHTML = `
    <div class="space-y-5">
      <!-- Topo -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h1 class="text-xl font-extrabold text-white flex items-center gap-2">
            <i data-lucide="shield" class="w-5 h-5 text-orange-400"></i>
            Usuários do Sistema & Permissões (RBAC)
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">
            Gerenciamento de acessos de Administradores, Gerentes, Operadores de Caixa e Estoquistas.
          </p>
        </div>
        <button id="btnRefreshUsers" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Atualizar</span>
        </button>
      </div>

      <!-- Tabela de Usuários -->
      <div class="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-md">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-700">
              <tr>
                <th class="py-3 px-4">Nome Completo</th>
                <th class="py-3 px-4">E-mail de Acesso</th>
                <th class="py-3 px-4">Perfil / Cargo (RBAC)</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody id="usersTableBody" class="divide-y divide-slate-800/80">
              <tr>
                <td colspan="5" class="py-12 text-center text-slate-500">
                  <i data-lucide="refresh-cw" class="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2"></i>
                  Carregando usuários do Supabase...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  renderIcons(container);

  const tableBody = container.querySelector('#usersTableBody');
  const refreshBtn = container.querySelector('#btnRefreshUsers');

  let list = [];

  const updateTable = () => {
    if (list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-500">
            Nenhum usuário registrado na base.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = list.map(u => {
      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-bold text-white">${u.full_name}</td>
          <td class="py-3 px-4 font-mono text-slate-300">${u.email}</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${
              u.role === 'ADMIN'
                ? 'bg-red-950 text-red-400 border border-red-500/30'
                : u.role === 'GERENTE'
                ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                : u.role === 'ESTOQUISTA'
                ? 'bg-blue-950 text-blue-400 border border-blue-500/30'
                : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
            }">
              ${u.role}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.active ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}">
              ${u.active ? 'ATIVO' : 'INATIVO'}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <button class="btn-change-role px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 text-xs font-semibold cursor-pointer" data-id="${u.id}">
              Alterar Cargo
            </button>
          </td>
        </tr>
      `;
    }).join('');

    renderIcons(tableBody);

    tableBody.querySelectorAll('.btn-change-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const u = list.find(item => item.id === btn.dataset.id);
        if (!u) return;
        const newRole = prompt(`Alterar cargo de ${u.full_name}:\nOpções permitidas:\nADMIN, GERENTE, OPERADOR_CAIXA, ESTOQUISTA`, u.role);
        if (newRole && ['ADMIN', 'GERENTE', 'OPERADOR_CAIXA', 'ESTOQUISTA'].includes(newRole.toUpperCase())) {
          try {
            await updateUserRole(u.id, newRole.toUpperCase());
            alert('Cargo atualizado com sucesso!');
            await reloadData();
          } catch (err) {
            alert('Erro: ' + err.message);
          }
        }
      });
    });
  };

  const reloadData = async () => {
    list = await fetchSystemUsers();
    updateTable();
  };

  refreshBtn.addEventListener('click', reloadData);
  await reloadData();
}
