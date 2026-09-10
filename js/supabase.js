/**
 * GEF – GESTÃO EMPRESARIAL E FINANCEIRA
 * Módulo de Integração com Supabase / PostgreSQL (js/supabase.js)
 * Fonte Única e Oficial de Dados.
 */

// Chaves de armazenamento local para persistência de credenciais públicas da loja
const STORAGE_KEY_URL = 'gef_supabase_url';
const STORAGE_KEY_ANON_KEY = 'gef_supabase_anon_key';
const STORAGE_KEY_CURRENT_STORE = 'gef_current_store_id';

// Configuração oficial do projeto Supabase fornecida
export const DEFAULT_SUPABASE_URL = 'https://hsfzjliuoajyafcsyfcy.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZnpqbGl1b2FqeWFmY3N5ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzIzODcsImV4cCI6MjEwNDIwODM4N30.TMdoh8Y0BRQJTZebNkgp5m9e1ZOprnjjz0DSYvn5d-A';

let supabaseClient = null;

/**
 * Obtém as credenciais públicas configuradas
 */
export function getCredentials() {
  const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const storedKey = localStorage.getItem(STORAGE_KEY_ANON_KEY);
  
  // Utiliza as credenciais oficiais configuradas por padrão
  const url = (storedUrl && storedUrl.trim()) ? storedUrl.trim() : DEFAULT_SUPABASE_URL;
  const key = (storedKey && storedKey.trim()) ? storedKey.trim() : DEFAULT_SUPABASE_ANON_KEY;
  return { url, key };
}

/**
 * Salva as credenciais públicas
 */
export function saveCredentials(url, key) {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  else localStorage.removeItem(STORAGE_KEY_URL);

  if (key) localStorage.setItem(STORAGE_KEY_ANON_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY_ANON_KEY);

  supabaseClient = null;
  return initSupabase();
}

/**
 * Inicializa ou retorna o cliente Supabase via CDN window.supabase
 */
export function initSupabase(customUrl = null, customKey = null) {
  if (supabaseClient && !customUrl && !customKey) return supabaseClient;

  const creds = getCredentials();
  const url = customUrl || creds.url;
  const key = customKey || creds.key;

  if (!url || !key) {
    return null;
  }

  try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return supabaseClient;
    } else {
      console.warn('Biblioteca Supabase JS não encontrada no escopo global (CDN).');
      return null;
    }
  } catch (err) {
    console.error('Erro ao inicializar Supabase Client:', err);
    supabaseClient = null;
    return null;
  }
}

/**
 * Retorna a instância ativa do Supabase
 */
export function getSupabase() {
  if (!supabaseClient) {
    initSupabase();
  }
  return supabaseClient;
}

/**
 * Verifica se as credenciais do Supabase estão configuradas
 */
export function isConfigured() {
  const { url, key } = getCredentials();
  return Boolean(url && key);
}

/**
 * Testa conectividade direta com o banco de dados Supabase
 */
export async function testConnection() {
  const client = getSupabase();
  if (!client) {
    return {
      connected: false,
      message: 'Supabase não configurado. Por favor, informe o Project URL e a Chave Pública (Anon Key).'
    };
  }

  try {
    const { error } = await client.from('stores').select('id').limit(1);
    if (error) {
      return {
        connected: false,
        message: formatErrorMessage(error)
      };
    }
    return {
      connected: true,
      message: 'Conexão com PostgreSQL / Supabase estabelecida com sucesso!'
    };
  } catch (err) {
    return {
      connected: false,
      message: 'Não foi possível contatar o servidor. Verifique sua conexão com a internet.'
    };
  }
}

/**
 * Formata erros internos do PostgreSQL para mensagens comerciais amigáveis (Requisito 24)
 * Não expõe códigos como '42501 permission denied' ou detalhes de banco ao usuário
 */
export function formatErrorMessage(err) {
  if (!err) return 'Ocorreu uma falha inesperada.';
  const msg = (err.message || String(err)).toLowerCase();
  const code = String(err.code || '');

  if (code === '42501' || msg.includes('permission denied') || msg.includes('row-level security')) {
    return 'Acesso não autorizado para esta operação. Verifique as permissões do seu perfil.';
  }
  if (code === '23505' || msg.includes('unique constraint') || msg.includes('already exists')) {
    return 'Já existe um registro com este código ou identificador.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
    return 'E-mail ou senha incorretos. Por favor, tente novamente.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Falha de comunicação com o servidor. Verifique sua conexão de rede.';
  }
  if (msg.includes('jwt expired')) {
    return 'Sua sessão expirou. Por favor, autentique-se novamente.';
  }
  if (msg.includes('user not found')) {
    return 'Usuário não localizado no sistema.';
  }
  return 'Não foi possível completar a solicitação no momento. Tente novamente ou consulte o suporte.';
}

/**
 * Normaliza o nome do operador responsável (Requisitos 21 e 22)
 * Regra estrita: Se for null, undefined, postgres, authenticated, supabase, sql ou UUID -> 'GEF'
 */
export function normalizeOperator(name) {
  if (!name) return 'GEF';
  const str = String(name).trim();
  const lower = str.toLowerCase();

  if (
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'postgres' ||
    lower === 'authenticated' ||
    lower === 'anon' ||
    lower === 'supabase' ||
    lower === 'sql' ||
    lower === 'direct_sql' ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  ) {
    return 'GEF';
  }
  return str;
}

/**
 * Gerenciamento do ID da Loja Selecionada no contexto Multi-Loja
 */
export function getCurrentStoreId() {
  return localStorage.getItem(STORAGE_KEY_CURRENT_STORE) || '';
}

export function setCurrentStoreId(storeId) {
  if (storeId) {
    localStorage.setItem(STORAGE_KEY_CURRENT_STORE, storeId);
  } else {
    localStorage.removeItem(STORAGE_KEY_CURRENT_STORE);
  }
}

export const getSupabaseConfig = getCredentials;
export const saveSupabaseConfig = saveCredentials;

/**
 * Fila Offline e Sincronização
 */
const QUEUE_STORAGE_KEY = 'gef_offline_sync_queue';

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function enqueueOfflineOperation(type, payload) {
  const queue = getOfflineQueue();
  queue.push({
    id: 'OFF-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    type,
    payload,
    timestamp: new Date().toISOString(),
    retries: 0
  });
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export async function processOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  const client = getSupabase();
  if (!client || !navigator.onLine) return { processed: 0, failed: queue.length };

  const remaining = [];
  let processed = 0;

  for (const item of queue) {
    try {
      if (item.type === 'SALE') {
        const { error } = await client.from('sales').insert(item.payload);
        if (error) throw error;
        processed++;
      } else {
        processed++;
      }
    } catch (err) {
      item.retries = (item.retries || 0) + 1;
      remaining.push(item);
    }
  }

  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
  return { processed, failed: remaining.length };
}

export function initOfflineSyncListeners(onStatusChange) {
  window.addEventListener('online', () => {
    if (onStatusChange) onStatusChange(true);
    processOfflineQueue();
  });

  window.addEventListener('offline', () => {
    if (onStatusChange) onStatusChange(false);
  });
}

