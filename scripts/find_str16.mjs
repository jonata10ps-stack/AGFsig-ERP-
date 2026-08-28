import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://vcbbvqhfcnouhsazqoxr.supabase.co',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function findSpecific() {
  const { data: products } = await s.from('Product')
    .select('*')
    .ilike('sku', '%STR16-2T%');
  
  console.log(`📦 Encontrados ${products?.length} registros para o padrão STR16-2T:`);
  products?.forEach(p => {
    console.log(`- ID: ${p.id} | SKU: "${p.sku}" | Ativo: ${p.active} | Empresa: ${p.company_id}`);
  });
}

findSpecific();
