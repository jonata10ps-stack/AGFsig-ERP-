import { createClient } from '@supabase/supabase-js';

// Setup connection to Supabase
// Chaves configuradas via arquivo .env
// Fallback para ambientes que não suportam import.meta.env (ex: testes node)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl.includes('SEU_PROJECT_REF')) {
  console.warn('⚠️ ATENÇÃO: VITE_SUPABASE_URL não configurada no arquivo .env. Acesse app.supabase.com → Settings → Data API → Project URL para obter a URL do projeto.');
}
if (!supabaseKey) {
  console.error('❌ ERRO: VITE_SUPABASE_ANON_KEY não configurada no arquivo .env.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// O admin key deve ser evitado no navegador por questões de segurança.
export const supabaseAdmin = null;

// Função para limpar dados: converte strings vazias em null
const sanitizeData = (data, entityName) => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === '') {
      sanitized[key] = null;
    }
  });

  // REMOVER company_id de tabelas que sabidamente não o possuem no schema
  const entitiesWithoutCompanyId = ['BOMDeliveryControl', 'BOMItem', 'BOMVersion'];
  if (entitiesWithoutCompanyId.includes(entityName)) {
    delete sanitized.company_id;
  }
  
  // Remover campos de auditoria antes de enviar para o banco
  delete sanitized.created_date;
  delete sanitized.created_at;
  delete sanitized.registered_date;
  
  return sanitized;
};

// Custom helper to handle base44 method mapping to supabase
const createEntityHandler = (entityName) => {
  return {
    async list(sort = '-created_date', limit = 1000) {
      let query = supabase.from(entityName).select('*').limit(limit);
      
      if (typeof sort === 'string') {
        const isDesc = sort.startsWith('-');
        const column = isDesc ? sort.substring(1) : sort;
        const sortColumn = (column === 'created_date' || column === 'registered_date' || column === 'created_at') ? 'created_at' : column;
        query = query.order(sortColumn, { ascending: !isDesc });
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (data && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item && !item.created_date) {
            item.created_date = item.created_at || item.registered_date;
          }
        }
      }
      return data || [];
    },
    
    async filter(conditions = {}, sort) {
      const sanitizedFilters = sanitizeData(conditions, entityName);
      let query = supabase.from(entityName).select('*');
      
      for (const [key, value] of Object.entries(sanitizedFilters)) {
        if (value !== undefined) {
          if (value === null) {
            query = query.is(key, null);
          } else if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      }

      if (typeof sort === 'string') {
        const isDesc = sort.startsWith('-');
        const column = isDesc ? sort.substring(1) : sort;
        const sortColumn = (column === 'created_date' || column === 'registered_date' || column === 'created_at') ? 'created_at' : column;
        query = query.order(sortColumn, { ascending: !isDesc });
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (data && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item && !item.created_date) {
            item.created_date = item.created_at || item.registered_date;
          }
        }
      }
      return data || [];
    },
    
    async create(data) {
      const sanitized = sanitizeData(data, entityName);
      
      const session = (await supabase.auth.getSession()).data?.session;
      const token = session?.access_token || supabaseKey;
      
      const response = await fetch(`${supabaseUrl}/rest/v1/${entityName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(sanitized)
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`Error creating ${entityName}:`, errorBody);
        throw errorBody;
      }
      
      const result = await response.json();
      const createdItem = Array.isArray(result) ? result[0] : result;
      if (createdItem && !createdItem.created_date) {
        createdItem.created_date = createdItem.created_at || new Date().toISOString();
      }
      return createdItem;
    },
    
    async bulkCreate(dataArray) {
      const sanitizedArray = (dataArray || []).map(item => sanitizeData(item, entityName));
      const session = (await supabase.auth.getSession()).data?.session;
      const token = session?.access_token || supabaseKey;
      
      const response = await fetch(`${supabaseUrl}/rest/v1/${entityName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(sanitizedArray)
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`Error bulk creating ${entityName}:`, errorBody);
        throw errorBody;
      }
      
      const result = await response.json();
      if (result && Array.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          const item = result[i];
          if (item && !item.created_date) {
            item.created_date = item.created_at || new Date().toISOString();
          }
        }
      }
      return result || [];
    },
    
    async update(id, data) {
      const sanitized = sanitizeData(data, entityName);
      const { data: result, error } = await supabase.from(entityName).update(sanitized).eq('id', id).select().single();
      if (error) {
        console.error(`Error updating ${entityName} with id ${id}:`, error);
        throw error;
      }
      if (result && !result.created_date) {
        result.created_date = result.created_at || new Date().toISOString();
      }
      return result;
    },
    
    async delete(id) {
      const { error } = await supabase.from(entityName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    subscribe(callback) {
      return () => {};
    }
  };
};

const entitiesProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string') return Reflect.get(target, prop);
    return createEntityHandler(prop);
  }
});

export const base44 = {
  entities: entitiesProxy,
  functions: {
    invoke: async (functionName, body = {}) => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body
      });
      if (error) throw error;
      return { data };
    }
  },
  auth: {
    me: (function() {
      let cachedUser = null;
      let lastFetch = 0;
      const CACHE_TTL = 30000;

      return async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) throw new Error('Não autenticado');

        const now = Date.now();
        if (cachedUser && (now - lastFetch < CACHE_TTL)) {
          return cachedUser;
        }

        const { data: profile } = await supabase.from('User').select('*').eq('email', session.user.email).maybeSingle();

        cachedUser = {
          id: session.user.id,
          email: session.user.email,
          full_name: profile?.full_name || session.user.user_metadata?.full_name || 'Autenticado(a)',
          role: profile?.role || 'admin',
          company_id: profile?.company_id || '00000000-0000-0000-0000-000000000000',
          current_company_id: profile?.company_id || '00000000-0000-0000-0000-000000000000',
          account_status: 'APROVADO',
          active: true
        };
        
        lastFetch = now;
        return cachedUser;
      };
    })(),
    logout: async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  },
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: 'https://placeholder.com/file' }),
      ExtractDataFromUploadedFile: async () => ({ parsed_data: [] })
    }
  }
};
