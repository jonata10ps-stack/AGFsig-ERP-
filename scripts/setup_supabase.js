
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

async function setup() {
  console.log('--- Iniciando Configuração de Permissões Supabase ---');

  // 1. Criar bucket se não existir
  console.log('1. Verificando bucket "attachments"...');
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.id === 'attachments')) {
    await supabase.storage.createBucket('attachments', { public: true });
    console.log('✅ Bucket "attachments" criado.');
  }

  // 2. Liberar RLS para o bucket via SQL
  // Como não temos a função exec_sql em todos os projetos, vamos tentar usar o RPC se existir
  // Mas a forma mais garantida é o usuário rodar no SQL Editor.
  // Vou imprimir o SQL aqui para o usuário e tentar rodar se possível.
  
  const policySql = `
    -- Habilitar acesso público ao bucket 'attachments'
    DO $$ 
    BEGIN
      -- Política para permitir INSERT (Upload) para todos (ou autenticados)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Insert' AND tablename = 'objects' AND schemaname = 'storage'
      ) THEN
        CREATE POLICY "Public Access Insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'attachments');
      END IF;

      -- Política para permitir SELECT (Visualização)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Select' AND tablename = 'objects' AND schemaname = 'storage'
      ) THEN
        CREATE POLICY "Public Access Select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'attachments');
      END IF;

      -- Política para permitir UPDATE/DELETE (Opcional, mas útil)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access All' AND tablename = 'objects' AND schemaname = 'storage'
      ) THEN
        CREATE POLICY "Public Access All" ON storage.objects FOR ALL TO public USING (bucket_id = 'attachments');
      END IF;
    END $$;
  `;

  console.log('2. Tentando aplicar políticas de segurança (RLS)...');
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: policySql });
    if (error) {
      console.log('ℹ️ Não foi possível aplicar RLS automaticamente. Por favor, COPIE E COLE o SQL abaixo no seu SQL Editor do Supabase.');
      console.log('\n--- COPIE O SQL ABAIXO ---\n');
      console.log(policySql);
      console.log('\n--- FIM DO SQL ---\n');
    } else {
      console.log('✅ Políticas de segurança aplicadas com sucesso!');
    }
  } catch (err) {
    console.log('ℹ️ RPC exec_sql indisponível.');
    console.log('\n--- COPIE E COLE ESTE SQL NO SUPABASE SQL EDITOR ---\n');
    console.log(policySql);
  }
}

setup();
