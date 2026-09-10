/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Orquestrador Principal da Aplicação SPA (js/app.js)
 * Inicialização, Shell de Navegação, Barramento de Rotas e Verificação de Estado
 */

import { initSupabase, getCurrentStoreId, setCurrentStoreId, initOfflineSyncListeners } from './supabase.js';
import { getCurrentUser, isAuthenticated, logout, hasPermission } from './auth.js';
import { registerRoute, navigateTo, initRouter, getCurrentRoute, initGlobalShortcuts } from './router.js';
import { getGefLogoSvg } from './logo.js';
import { renderIcons } from './icons.js';
import { renderLoginView, renderRegisterStoreView } from './auth-ui.js';
import { renderDashboardView } from './dashboard.js';
import { renderPosView } from './pos.js';
import { renderProductsView } from './products.js';
import { renderStockView } from './stock.js';
import { renderSalesView } from './sales.js';
import { renderCustomersView } from './customers.js';
import { renderSuppliersView } from './suppliers.js';
import { renderCashierView } from './cashier.js';
import { renderReportsView } from './reports.js';
import { renderUsersView } from './users.js';
import { renderAuditView } from './audit.js';
import { renderSettingsView } from './settings.js';

let toastContainer = null;
function ensureToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'gef-toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
    document.body.appendChild(toastContainer);
  }
}

export function showToast(type, title, message = '', duration = 4000) {
  ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border transition-all duration-300 transform translate-y-2 opacity-0 text-xs font-sans ' +
    (type === 'success' ? 'bg-slate-900 border-emerald-500/40 text-emerald-300' :
     type === 'error' ? 'bg-slate-900 border-red-500/40 text-red-300' :
     type === 'warning' ? 'bg-slate-900 border-amber-500/40 text-amber-300' :
     'bg-slate-900 border-slate-700 text-slate-200');

  const iconName = type === 'success' ? 'check-circle' :
                   type === 'error' ? 'alert-octagon' :
                   type === 'warning' ? 'alert-triangle' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 shrink-0 mt-0.5"></i>
    <div class="flex-1 min-w-0">
      <strong class="font-bold text-white block">${title}</strong>
      ${message ? `<p class="text-[11px] text-slate-300 mt-0.5">${message}</p>` : ''}
    </div>
    <button class="text-slate-500 hover:text-white p-1 ml-1 cursor-pointer">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  toastContainer.appendChild(toast);
  renderIcons(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  const remove = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('button').addEventListener('click', remove);
  setTimeout(remove, duration);
}

/**
 * Monta o layout padrão (Sidebar + Topbar + Container de Conteúdo)
 */
function renderShell(user) {
  const root = document.getElementById('app');
  if (!root) return;

  const role = user?.role || 'OPERADOR_CAIXA';
  const isAdminOrGerente = role === 'ADMIN' || role === 'GERENTE';

  root.innerHTML = `
    <div class="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <!-- Sidebar Desktop -->
      <aside id="sidebar" class="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-40 transition-transform duration-300 -translate-x-full md:translate-x-0 fixed md:relative h-full">
        <!-- Logo e Cabeçalho -->
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            ${getGefLogoSvg('horizontal', { className: 'h-8 w-auto' })}
          </div>
          <button id="closeMobileSidebarBtn" class="md:hidden p-1 text-slate-400 hover:text-white cursor-pointer">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Links de Navegação -->
        <nav class="flex-1 overflow-y-auto p-3 space-y-1 text-xs font-semibold">
          <a href="#/dashboard" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="dashboard">
            <i data-lucide="layout-dashboard" class="w-4 h-4 text-orange-500"></i>
            <span>Painel Geral</span>
          </a>

          <a href="#/pos" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="pos">
            <i data-lucide="shopping-cart" class="w-4 h-4 text-orange-500"></i>
            <span>PDV / Venda Balcão (F4)</span>
          </a>

          <a href="#/products" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="products">
            <i data-lucide="package" class="w-4 h-4 text-orange-500"></i>
            <span>Catálogo & Conversões</span>
          </a>

          <a href="#/stock" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="stock">
            <i data-lucide="layers" class="w-4 h-4 text-orange-500"></i>
            <span>Estoque & Matriz FEFO</span>
          </a>

          <a href="#/sales" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="sales">
            <i data-lucide="receipt" class="w-4 h-4 text-orange-500"></i>
            <span>Histórico de Vendas</span>
          </a>

          <a href="#/customers" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="customers">
            <i data-lucide="users" class="w-4 h-4 text-orange-500"></i>
            <span>Clientes & Fiado</span>
          </a>

          <a href="#/cashier" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="cashier">
            <i data-lucide="wallet" class="w-4 h-4 text-orange-500"></i>
            <span>Caixa & Sangrias</span>
          </a>

          <a href="#/suppliers" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="suppliers">
            <i data-lucide="truck" class="w-4 h-4 text-orange-500"></i>
            <span>Fornecedores</span>
          </a>

          ${isAdminOrGerente ? `
            <div class="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Gestão & Auditoria
            </div>

            <a href="#/reports" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="reports">
              <i data-lucide="bar-chart-3" class="w-4 h-4 text-orange-500"></i>
              <span>DRE & Curva ABC</span>
            </a>

            <a href="#/users" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="users">
              <i data-lucide="shield" class="w-4 h-4 text-orange-500"></i>
              <span>Usuários & RBAC</span>
            </a>

            <a href="#/audit" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="audit">
              <i data-lucide="shield-alert" class="w-4 h-4 text-orange-500"></i>
              <span>Trilha de Auditoria</span>
            </a>

            <a href="#/settings" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition" data-route="settings">
              <i data-lucide="settings" class="w-4 h-4 text-orange-500"></i>
              <span>Configurações</span>
            </a>
          ` : ''}
        </nav>

        <!-- Perfil do Usuário e Logout -->
        <div class="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div class="min-w-0 pr-2">
            <div class="font-bold text-xs text-white truncate">${user?.fullName || 'Operador'}</div>
            <div class="text-[10px] text-slate-400 font-mono">${user?.role || 'OPERADOR'}</div>
          </div>
          <button id="btnLogout" class="p-2 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 transition cursor-pointer" title="Encerrar Sessão">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      </aside>

      <!-- Overlay Mobile -->
      <div id="sidebarOverlay" class="fixed inset-0 bg-black/60 z-30 hidden md:hidden"></div>

      <!-- Área Principal de Conteúdo -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Barra Superior (Top Bar) -->
        <header class="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 z-20 shrink-0">
          <div class="flex items-center gap-3">
            <button id="openMobileSidebarBtn" class="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer">
              <i data-lucide="menu" class="w-5 h-5"></i>
            </button>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-400 font-mono hidden sm:inline">LOJA ATIVA:</span>
              <select id="globalStoreSelect" class="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:outline-hidden">
                <option value="LOJA-01">Loja Central 01 - Matola</option>
                <option value="LOJA-02">Filial 02 - Maputo Pátio</option>
                <option value="ALL">Todas as Unidades (Consolidado)</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- Indicador Online / Offline -->
            <div id="onlineBadge" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>ONLINE</span>
            </div>
          </div>
        </header>

        <!-- Container da View Ativa -->
        <main id="viewContainer" class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950">
          <!-- Conteúdo dinâmico injetado pelo roteador -->
        </main>
      </div>
    </div>
  `;

  renderIcons(root);

  // Manipulação do menu mobile
  const sidebar = root.querySelector('#sidebar');
  const overlay = root.querySelector('#sidebarOverlay');
  const openBtn = root.querySelector('#openMobileSidebarBtn');
  const closeBtn = root.querySelector('#closeMobileSidebarBtn');

  const toggleMobileSidebar = (open) => {
    if (open) {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  };

  openBtn?.addEventListener('click', () => toggleMobileSidebar(true));
  closeBtn?.addEventListener('click', () => toggleMobileSidebar(false));
  overlay?.addEventListener('click', () => toggleMobileSidebar(false));

  // Fechar sidebar ao clicar num link
  root.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => toggleMobileSidebar(false));
  });

  // Logout
  root.querySelector('#btnLogout')?.addEventListener('click', () => {
    if (confirm('Deseja realmente encerrar a sessão no GEF?')) {
      logout();
    }
  });

  // Troca de Loja Ativa
  const storeSelect = root.querySelector('#globalStoreSelect');
  if (storeSelect) {
    storeSelect.value = getCurrentStoreId() || 'LOJA-01';
    storeSelect.addEventListener('change', (e) => {
      setCurrentStoreId(e.target.value);
      window.location.reload();
    });
  }

  // Monitoramento online / offline
  const onlineBadge = root.querySelector('#onlineBadge');
  initOfflineSyncListeners((isOnline) => {
    if (isOnline) {
      onlineBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-bold text-emerald-400';
      onlineBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>ONLINE</span>';
    } else {
      onlineBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/30 text-[10px] font-bold text-amber-400';
      onlineBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span>OFFLINE</span>';
    }
  });
}

/**
 * Atualiza o destaque da rota ativa na barra lateral
 */
function updateActiveNav(routeName) {
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.dataset.route === routeName) {
      el.className = 'nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl bg-orange-600 text-white font-bold transition shadow-sm';
      const icon = el.querySelector('i');
      if (icon) icon.className = 'w-4 h-4 text-white';
    } else {
      el.className = 'nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition';
      const icon = el.querySelector('i');
      if (icon) icon.className = 'w-4 h-4 text-orange-500';
    }
  });
}

/**
 * Ponto de Entrada Principal da Aplicação
 */
export function initializeGefApplication() {
  initSupabase();
  initGlobalShortcuts();

  // Registrar rotas
  registerRoute('login', async (container) => {
    await renderLoginView(container);
  }, { public: true });

  registerRoute('register-store', async (container) => {
    await renderRegisterStoreView(container);
  }, { public: true });

  registerRoute('dashboard', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('dashboard');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderDashboardView(viewContainer);
  }, { requiredRole: ['ADMIN', 'GERENTE', 'OPERADOR_CAIXA', 'ESTOQUISTA'] });

  registerRoute('pos', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('pos');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderPosView(viewContainer);
  });

  registerRoute('products', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('products');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderProductsView(viewContainer);
  });

  registerRoute('stock', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('stock');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderStockView(viewContainer);
  });

  registerRoute('sales', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('sales');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderSalesView(viewContainer);
  });

  registerRoute('customers', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('customers');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderCustomersView(viewContainer);
  });

  registerRoute('cashier', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('cashier');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderCashierView(viewContainer);
  });

  registerRoute('suppliers', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('suppliers');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderSuppliersView(viewContainer);
  });

  registerRoute('reports', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('reports');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderReportsView(viewContainer);
  }, { requiredRole: ['ADMIN', 'GERENTE'] });

  registerRoute('users', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('users');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderUsersView(viewContainer);
  }, { requiredRole: ['ADMIN'] });

  registerRoute('audit', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('audit');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderAuditView(viewContainer);
  }, { requiredRole: ['ADMIN'] });

  registerRoute('settings', async (container) => {
    renderShell(getCurrentUser());
    updateActiveNav('settings');
    const viewContainer = document.getElementById('viewContainer');
    if (viewContainer) await renderSettingsView(viewContainer);
  }, { requiredRole: ['ADMIN'] });

  // Iniciar roteador
  initRouter();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGefApplication);
} else {
  initializeGefApplication();
}
