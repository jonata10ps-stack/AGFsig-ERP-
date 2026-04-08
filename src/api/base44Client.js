import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {Object} Base44Handler
 * @property {(sort?: string, limit?: number, skip?: number) => Promise<any[]>} list
 * @property {(conditions?: Object, sort?: string, limit?: number, skip?: number) => Promise<any[]>} filter
 * @property {(data: Object) => Promise<any>} create
 * @property {(items: any[]) => Promise<any>} bulkCreate
 * @property {(id: string, data: Object) => Promise<any>} update
 * @property {(id: string) => Promise<any>} delete
 * @property {(conditions: Object) => Promise<any>} deleteBy
 * @property {(conditions: Object, sort?: string, limit?: number, skip?: number, searchFields?: string[], searchString?: string) => Promise<{data: any[], count: number}>} queryPaginated
 * @property {(conditions?: Object, sort?: string) => Promise<any[]>} listAll
 * @property {(callback: function) => function} subscribe
 */

/**
 * @typedef {Object.<string, Base44Handler>} Base44Entities
 */

// Setup connection to Supabase
const getSupabaseConfig = () => {
  const url = 'https://vcbbvqhfcnouhsazqoxr.supabase.co';
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
  const adminKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, adminKey };
};

const config = getSupabaseConfig();
export const supabaseUrl = config.url;
export const supabaseKey = config.key;

// Singleton pattern using window to persist cross-HMR
if (!window._supabaseInstance && config.url && config.key) {
  window._supabaseInstance = createClient(config.url, config.key);
}
export const supabase = window._supabaseInstance;

if (!window._supabaseAdminInstance && config.url && config.adminKey) {
  window._supabaseAdminInstance = createClient(config.url, config.adminKey);
}
export const supabaseAdmin = window._supabaseAdminInstance;

const sanitizeData = (data, entityName) => {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...data };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === '') sanitized[key] = null;
  });
  const entitiesWithoutCompanyId = ['BOMDeliveryControl', 'BOMItem', 'BOMVersion'];
  if (entitiesWithoutCompanyId.includes(entityName)) delete sanitized.company_id;
  delete sanitized.created_date;
  delete sanitized.created_at;
  delete sanitized.registered_date;
  return sanitized;
};

const mapAuditFields = (data) => {
  if (data && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item && !item.created_date) item.created_date = item.created_at || item.registered_date;
    }
  } else if (data && typeof data === 'object') {
    if (!data.created_date) data.created_date = data.created_at || data.registered_date || new Date().toISOString();
  }
  return data;
};

const createEntityHandler = (entityName) => {
  return {
    async get(id) {
      if (!id) return null;
      const { data, error } = await supabase.from(entityName).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapAuditFields(data);
    },

    async list(sort = '-created_date', limit = 1000, skip = 0) {
      const { data } = await this.queryPaginated({}, sort, limit, skip);
      return data;
    },
    
    async filter(conditions = {}, sort, limit = 1000, skip = 0) {
      const { data } = await this.queryPaginated(conditions, sort, limit, skip);
      return data;
    },

    async queryPaginated(conditions = {}, sort, limit = 1000, skip = 0, searchFields = [], searchString = '') {
      const sanitizedFilters = sanitizeData(conditions, entityName);
      let query = supabase.from(entityName).select('*', { count: 'exact' });
      
      // Apply filters
      for (const [key, value] of Object.entries(sanitizedFilters)) {
        if (value !== undefined) {
          if (value === null) query = query.is(key, null);
          else if (Array.isArray(value)) query = query.in(key, value);
          else if (typeof value === 'object') {
            if (value.like) query = query.ilike(key, value.like);
            if (value.gte !== undefined) query = query.gte(key, value.gte);
            if (value.lte !== undefined) query = query.lte(key, value.lte);
            if (value.gt !== undefined) query = query.gt(key, value.gt);
            if (value.lt !== undefined) query = query.lt(key, value.lt);
            if (value.like === undefined && value.gte === undefined && value.lte === undefined && value.gt === undefined && value.lt === undefined) {
              query = query.eq(key, value);
            }
          }
          else query = query.eq(key, value);
        }
      }

      // Apply multi-column search
      if (searchString && searchFields.length > 0) {
        const orConditions = searchFields.map(field => `${field}.ilike.%${searchString}%`).join(',');
        query = query.or(orConditions);
      }

      if (typeof sort === 'string') {
        const isDesc = sort.startsWith('-');
        const column = isDesc ? sort.substring(1) : sort;
        const sortColumn = (column === 'created_date' || column === 'registered_date' || column === 'created_at') ? 'created_at' : column;
        query = query.order(sortColumn, { ascending: !isDesc });
      }

      if (limit > 0) {
        query = query.range(skip, skip + limit - 1);
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: mapAuditFields(data) || [], count: count || 0 };
    },

    async listAll(conditions = {}, sort) {
      const CHUNK_SIZE = 1000;
      let allData = [];
      let currentSkip = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, count } = await this.queryPaginated(conditions, sort, CHUNK_SIZE, currentSkip);
        
        if (!page || page.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...page];
          if (page.length < CHUNK_SIZE || allData.length >= count) {
            hasMore = false;
          } else {
            currentSkip += CHUNK_SIZE;
          }
        }
      }
      return allData;
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
      if (!response.ok) throw await response.json().catch(() => ({ message: response.statusText }));
      const result = await response.json();
      return mapAuditFields(Array.isArray(result) ? result[0] : result);
    },
    async bulkCreate(dataArray) {
      if (!dataArray || dataArray.length === 0) return [];
      const sanitizedArray = dataArray.map(item => sanitizeData(item, entityName));
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
      if (!response.ok) throw await response.json().catch(() => ({ message: response.statusText }));
      return mapAuditFields(await response.json()) || [];
    },
    async update(id, data) {
      const sanitized = sanitizeData(data, entityName);
      const { data: result, error } = await supabase.from(entityName).update(sanitized).eq('id', id).select().single();
      if (error) throw error;
      return mapAuditFields(result);
    },
    async delete(id) {
      const { error } = await supabase.from(entityName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    async deleteBy(filters = {}) {
      if (Object.keys(filters).length === 0) throw new Error('Delete filters cannot be empty');
      let query = supabase.from(entityName).delete();
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      const { error } = await query;
      if (error) throw error;
      return true;
    },
    subscribe(callback) { return () => {}; }
  };
};

/** @type {Base44Entities} */
const entitiesProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string' || prop === '$$typeof' || prop === 'toJSON' || prop === 'constructor') return Reflect.get(target, prop);
    return createEntityHandler(prop);
  }
});

export const base44 = {
  entities: entitiesProxy,
  functions: {
    invoke: async (functionName, body = {}) => {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      return { data };
    },
    invokeRpc: async (rpcName, params = {}) => {
      const { data, error } = await supabase.rpc(rpcName, params);
      return { data, error };
    }
  },
  auth: {
    me: (function() {
      let cachedUser = null;
      let lastFetch = 0;
      const CACHE_TTL = 30000;
      
      const meFunc = async (force = false) => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) throw new Error('Não autenticado');
        const now = Date.now();
        if (!force && cachedUser && (now - lastFetch < CACHE_TTL)) return cachedUser;
        
        // Busca o perfil mais completo (caso existam duplicados por erro de cadastro)
        const { data: profiles } = await supabase
          .from('User')
          .select('*')
          .ilike('email', session.user.email.toLowerCase())
          .order('updated_at', { ascending: false });
        
        // Pega o primeiro perfil que tiver módulos, ou o mais recente
        const profile = profiles?.find(p => p.allowed_modules && p.allowed_modules.length > 5) || profiles?.[0];
        
        cachedUser = {
          id: session.user.id,
          email: session.user.email,
          ...profile,
          ...session.user.user_metadata,
          full_name: profile?.full_name || session.user.user_metadata?.full_name || 'Autenticado(a)',
          role: profile?.role || 'admin',
          company_id: profile?.company_id || '00000000-0000-0000-0000-000000000000',
          current_company_id: profile?.company_id || '00000000-0000-0000-0000-000000000000',
          company_ids: profile?.company_ids || [],
          account_status: profile?.account_status || 'PENDENTE',
          active: profile?.active !== false
        };
        lastFetch = now;
        return cachedUser;
      };

      meFunc.clearCache = () => { cachedUser = null; lastFetch = 0; };
      return meFunc;
    })(),
    updateMe: async (data) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      const { error } = await supabase.from('User').update(data).eq('email', session.user.email);
      if (error) throw error;
      if (typeof base44.auth.me.clearCache === 'function') {
        base44.auth.me.clearCache();
      }
      return true;
    },
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },
    signUp: async (email, password, metadata = {}) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });
      if (error) throw error;
      return data;
    },
    logout: async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
    },
    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      });
      if (error) throw error;
      return true;
    },
    updatePassword: async (newPassword) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return true;
    }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file, bucket = 'attachments', path = '' }) => {
        try {
          const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const filePath = path ? `${path}/${fileName}` : fileName;
          
          const client = supabaseAdmin || supabase;
          const { data, error } = await client.storage
            .from(bucket)
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

          if (error) throw error;
          
          const { data: { publicUrl } } = client.storage
            .from(bucket)
            .getPublicUrl(filePath);

          return { file_url: publicUrl };
        } catch (err) {
          console.error('Erro no UploadFile:', err);
          throw err;
        }
      },
      InvokeLLM: async (body) => {
        try {
          const { data, error } = await supabase.functions.invoke('generate-report-insights', {
            body
          });
          if (error) throw error;
          return data;
        } catch (err) {
          console.warn('Edge Function falhou, tentando via RPC...', err);
          const { data, error } = await supabase.rpc('get_ai_report_insights', { 
            p_prompt: body.prompt,
            p_schema: body.response_json_schema 
          });
          if (error) throw error;
          return data;
        }
      },
      ExtractDataFromUploadedFile: async () => ({ parsed_data: [] })
    }
  }
};
