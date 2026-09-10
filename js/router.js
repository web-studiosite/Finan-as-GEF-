/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Roteamento, Proteção de Rotas & Route Guard (js/router.js)
 * Constrói o menu dinamicamente e bloqueia acessos não autorizados
 */

import { getCurrentUser, isRouteAllowed, getDefaultRouteForRole, normalizeRole } from './auth.js';

// Definição de todos os módulos do GEF
export const ALL_NAV_ITEMS = [
  // SuperAdmin Global
  { id: 'monitor', label: 'Monitor SaaS & Trava', icon: 'shield-check', group: 'SaaS Global', superadminOnly: true },
  { id: 'stores', label: 'Lojas & Filiais', icon: 'building-2', group: 'SaaS Global', superadminOnly: true },
  { id: 'ambassadors', label: 'Embaixadores / Parceiros', icon: 'award', group: 'SaaS Global' },
  // Operacional Loja
  { id: 'dashboard', label: 'Painel da Loja', icon: 'layout-dashboard', group: 'Visão Geral' },
  { id: 'pos', label: 'PDV / Frente de Caixa', icon: 'shopping-cart', group: 'Vendas', highlight: true },
  { id: 'sales', label: 'Vendas & Estornos', icon: 'receipt', group: 'Vendas' },
  { id: 'products', label: 'Catálogo de Produtos', icon: 'package', group: 'Estoque' },
  { id: 'stock', label: 'Estoque & Matriz FEFO', icon: 'layers', group: 'Estoque' },
  { id: 'transfers', label: 'Transferências Internas', icon: 'arrow-left-right', group: 'Estoque' },
  { id: 'losses', label: 'Perdas & Avarias', icon: 'trash-2', group: 'Estoque' },
  { id: 'cash', label: 'Caixa & Turnos', icon: 'landmark', group: 'Financeiro' },
  { id: 'customers', label: 'Clientes & Fiado', icon: 'users', group: 'Financeiro' },
  { id: 'users', label: 'Equipe da Loja', icon: 'user-check', group: 'Administração', adminOnly: true },
  { id: 'reports', label: 'Relatórios & DRE', icon: 'file-bar-chart', group: 'Administração' },
  { id: 'audit', label: 'Trilha de Auditoria', icon: 'history', group: 'Governança' },
  { id: 'settings', label: 'Configurações da Loja', icon: 'settings', group: 'Configuração' }
];

let activeRoute = 'pos';
let routeChangeCallbacks = new Set();
const routeHandlers = new Map();

/**
 * Registra uma rota com seu handler de renderização
 */
export function registerRoute(name, handler, options = {}) {
  routeHandlers.set(name.toLowerCase(), { handler, options });
}

export function getCurrentRoute() {
  return activeRoute;
}

/**
 * Registra callback para mudanças de rota
 */
export function onRouteChange(cb) {
  routeChangeCallbacks.add(cb);
  return () => routeChangeCallbacks.delete(cb);
}

/**
 * Obtém a rota ativa atual
 */
export function getActiveRoute() {
  return activeRoute;
}

/**
 * Navega para uma nova rota aplicando o Route Guard (Requisito 10)
 */
export function navigateTo(targetRoute) {
  const user = getCurrentUser();
  const cleanRoute = (targetRoute || '').replace(/^#\/?/, '').toLowerCase() || 'pos';

  // Se não estiver logado, rota fixa é login ou register-store
  if (!user && cleanRoute !== 'register-store') {
    activeRoute = 'login';
    window.location.hash = '#/login';
    triggerRouteHandler('login');
    triggerCallbacks('login');
    return;
  }

  if (cleanRoute === 'register-store') {
    activeRoute = 'register-store';
    window.location.hash = '#/register-store';
    triggerRouteHandler('register-store');
    triggerCallbacks('register-store');
    return;
  }

  // Verificar se o usuário tem permissão para a rota (Requisito 10)
  if (user && !isRouteAllowed(cleanRoute, user.role)) {
    console.warn(`[Route Guard] Acesso negado à rota "${cleanRoute}" para o perfil "${user.role}". Redirecionando para área autorizada.`);
    const fallbackRoute = getDefaultRouteForRole(user.role);
    activeRoute = fallbackRoute;
    window.location.hash = `#/${fallbackRoute}`;
    triggerRouteHandler(fallbackRoute);
    triggerCallbacks(fallbackRoute, { accessDenied: true, attempted: cleanRoute });
    return;
  }

  activeRoute = cleanRoute;
  window.location.hash = `#/${cleanRoute}`;
  triggerRouteHandler(cleanRoute);
  triggerCallbacks(cleanRoute);
}

async function triggerRouteHandler(route) {
  const reg = routeHandlers.get(route);
  if (reg && typeof reg.handler === 'function') {
    const root = document.getElementById('app');
    try {
      await reg.handler(root);
    } catch (err) {
      console.error(`Erro ao renderizar rota ${route}:`, err);
    }
  }
}

function triggerCallbacks(route, metadata = {}) {
  routeChangeCallbacks.forEach(cb => {
    try {
      cb(route, metadata);
    } catch (e) {
      console.error('Erro no callback de rota:', e);
    }
  });
}

/**
 * Atalhos de teclado globais
 */
export function initGlobalShortcuts() {
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    const isEditing = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'F1') {
      e.preventDefault();
      showShortcutsHelpModal();
      return;
    }

    if (e.key === 'Escape') {
      const topModal = document.querySelector('.fixed.inset-0.z-50');
      if (topModal) topModal.remove();
      return;
    }

    if (e.altKey && !isEditing) {
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        navigateTo('dashboard');
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        navigateTo('pos');
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        navigateTo('stock');
      } else if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigateTo('sales');
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        navigateTo('customers');
      }
    }
  });
}

export function showShortcutsHelpModal() {
  const existing = document.getElementById('gef-shortcuts-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'gef-shortcuts-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4';
  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 text-xs text-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 class="font-bold text-base text-white">Atalhos de Teclado do Balcão</h3>
        <button id="closeShortcutsBtn" class="text-slate-400 hover:text-white cursor-pointer font-bold text-base">&times;</button>
      </div>
      <div class="space-y-2 text-xs">
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Pesquisa rápida no PDV</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-orange-400 font-bold">F2</kbd>
        </div>
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Finalizar Venda e Emitir Recibo</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-emerald-400 font-bold">F4</kbd>
        </div>
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Limpar Carrinho</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-red-400 font-bold">F8</kbd>
        </div>
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Fechar modais e telas suspensas</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300 font-bold">ESC</kbd>
        </div>
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Ir para o Painel Geral</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold">Alt + D</kbd>
        </div>
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Ir para o Ponto de Venda (PDV)</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold">Alt + P</kbd>
        </div>
        <div class="flex justify-between items-center p-2 rounded-lg bg-slate-800/60">
          <span>Ir para o Controle de Estoque</span>
          <kbd class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold">Alt + E</kbd>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#closeShortcutsBtn').addEventListener('click', () => modal.remove());
}


/**
 * Inicializa os ouvintes de hashchange na janela
 */
export function initRouter() {
  window.addEventListener('hashchange', () => {
    const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const user = getCurrentUser();
    if (!user) {
      if (raw === 'register-store') {
        navigateTo('register-store');
      } else {
        navigateTo('login');
      }
    } else {
      navigateTo(raw || getDefaultRouteForRole(user.role));
    }
  });

  // Roteamento inicial
  const user = getCurrentUser();
  if (!user) {
    const initialRaw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (initialRaw === 'register-store') {
      navigateTo('register-store');
    } else {
      navigateTo('login');
    }
  } else {
    const initialRaw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    navigateTo(initialRaw || getDefaultRouteForRole(user.role));
  }
}

/**
 * Constrói o menu lateral com APENAS os módulos autorizados (Requisito 7, Item 6)
 */
export function getAuthorizedMenu(role) {
  const normRole = normalizeRole(role);
  const items = ALL_NAV_ITEMS.filter(item => isRouteAllowed(item.id, normRole));

  // Agrupar itens por seção
  const groups = {};
  items.forEach(item => {
    if (!groups[item.group]) {
      groups[item.group] = [];
    }
    groups[item.group].push(item);
  });

  return Object.entries(groups).map(([groupName, groupItems]) => ({
    group: groupName,
    items: groupItems
  }));
}
