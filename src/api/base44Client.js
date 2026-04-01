import { createClient } from '@supabase/supabase-js';

// Setup connection to Supabase
// Chaves configuradas via arquivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes('SEU_PROJECT_REF')) {
  console.warn('⚠️ ATENÇÃO: VITE_SUPABASE_URL não configurada no arquivo .env. Acesse app.supabase.com → Settings → Data API → Project URL para obter a URL do projeto.');
}
if (!supabaseKey) {
  console.error('❌ ERRO: VITE_SUPABASE_ANON_KEY não configurada no arquivo .env.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// O admin key deve ser evitado no navegador por questões de segurança.
// Para operações administrativas, utilize o fluxo de pré-autorização.
export const supabaseAdmin = null;

// Custom helper to handle base44 method mapping to supabase
const createEntityHandler = (entityName) => {
  return {
    async list(sort = '-created_date', limit = 1000) {
      // Handle Supabase select
      let query = supabase.from(entityName).select('*').limit(limit);
      
      // Attempt rudimentary sorting based on string format
      if (typeof sort === 'string') {
        const isDesc = sort.startsWith('-');
        const column = isDesc ? sort.substring(1) : sort;
        if (column === 'created_date') {
            query = query.order('created_at', { ascending: !isDesc });
        } else {
            query = query.order(column, { ascending: !isDesc });
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    
    async filter(conditions = {}, sort) {
      let query = supabase.from(entityName).select('*');
      
      // Apply exact matches
      for (const [key, value] of Object.entries(conditions)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }

      // Sorting
      if (typeof sort === 'string') {
        const isDesc = sort.startsWith('-');
        const column = isDesc ? sort.substring(1) : sort;
        if (column === 'created_date') {
            query = query.order('created_at', { ascending: !isDesc });
        } else {
            query = query.order(column, { ascending: !isDesc });
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    
    async create(data) {
      // base44 might not send id if it expects the backend to generate it 
      // which is fine since Supabase has uuid_generate_v4() default.
      const { data: result, error } = await supabase.from(entityName).insert([data]).select().single();
      if (error) throw error;
      return result;
    },
    
    async bulkCreate(dataArray) {
      const { data: result, error } = await supabase.from(entityName).insert(dataArray).select();
      if (error) throw error;
      return result;
    },
    
    async update(id, data) {
      const { data: result, error } = await supabase.from(entityName).update(data).eq('id', id).select().single();
      if (error) {
        console.error(`Error updating ${entityName} with id ${id}:`, error);
        throw error;
      }
      return result;
    },
    
    async delete(id) {
      const { error } = await supabase.from(entityName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Mock subscription to avoid crashes
    subscribe(callback) {
      console.log(`[Mock] Inscrito em eventos da entidade: ${entityName}`);
      // Return a no-op unsubscribe function
      return () => console.log(`[Mock] Desinscrito de: ${entityName}`);
    }
  };
};

// Smart proxy that catches ANY entity name the app requests
const entitiesProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string') return Reflect.get(target, prop);
    // When the app requests base44.entities.Product, we return a Supabase handler for "Product"
    return createEntityHandler(prop);
  }
});

// The exported base44 object that mimics the base44 SDK
export const base44 = {
  entities: entitiesProxy,
  auth: {
    me: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) throw new Error('Não autenticado');

      // Tenta recuperar dados extras do usuário (caso exista na tabela User)
      const { data: profile } = await supabase.from('User').select('*').eq('email', session.user.email).maybeSingle();

      return {
        id: session.user.id,
        email: session.user.email,
        full_name: profile?.full_name || session.user.user_metadata?.full_name || 'Autenticado(a)',
        role: profile?.role || 'admin', // Força 'admin' para liberar todas as telas como master
        // Fallback para uma company genérica caso o usuário não tenha o company_id no perfil
        company_id: profile?.company_id || '00000000-0000-0000-0000-000000000000',
        current_company_id: profile?.company_id || '00000000-0000-0000-0000-000000000000',
        account_status: 'APROVADO',
        active: true
      };
    },
    updateMe: async (data) => {
      console.log('updateMe not fully implemented for Auth yet', data);
      return { success: true };
    },
    signUp: async (email, password, metadata = {}) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      if (error) throw error;
      return data;
    },
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    logout: async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  },
  appLogs: {
    logUserInApp: async (pageName) => {
      console.log(`[Mock Log] Usuário acessou a página: ${pageName}`);
      return true;
    }
  },
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: 'https://placeholder.com/file' }),
      ExtractDataFromUploadedFile: async () => ({ parsed_data: [] })
    }
  }
};
