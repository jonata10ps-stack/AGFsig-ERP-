
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERRO: VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não encontrados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function publishDatabaseChanges() {
  console.log('--- Publicando Alterações na Base de Produção ---');

  const rlsSql = `
    -- 1. Liberar acesso global para CLIENTES
    DROP POLICY IF EXISTS "Enable select for users based on company_id" ON public."Client";
    CREATE POLICY "Enable global select for Client" ON public."Client" FOR SELECT USING (true);

    -- 2. Liberar acesso global para PRODUTOS
    DROP POLICY IF EXISTS "Enable select for users based on company_id" ON public."Product";
    CREATE POLICY "Enable global select for Product" ON public."Product" FOR SELECT USING (true);
  `;

  try {
    console.log('Tentando aplicar RLS de unificação via RPC...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: rlsSql });
    
    if (error) {
       console.log('ℹ️ RPC exec_sql falhou. Isto é comum se a função não estiver configurada.');
       console.log('Por favor, COPIE E COLE o SQL abaixo no seu SQL Editor do Supabase Dashboard:');
       console.log('\n--- COPIE O SQL ABAIXO ---\n');
       console.log(rlsSql);
       console.log('\n--- FIM DO SQL ---\n');
    } else {
       console.log('✅ Base de produção atualizada com sucesso!');
    }
  } catch (err) {
    console.log('Erro ao tentar conectar: ' + err.message);
  }
}

publishDatabaseChanges();
