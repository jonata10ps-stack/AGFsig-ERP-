import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://vcbbvqhfcnouhsazqoxr.supabase.co',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function scanDuplicates() {
  console.log('🔍 Iniciando varredura de duplicidades...');
  
  const { data: products } = await s.from('Product').select('id, sku, name').eq('active', true);
  
  const groups = {};
  products.forEach(p => {
    if (!p.sku) return;
    const key = p.sku.trim().toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  const duplicates = Object.entries(groups).filter(([_, list]) => list.length > 1);
  
  console.log(`📊 Encontrados ${duplicates.length} SKUs com duplicidade.`);
  
  duplicates.slice(0, 5).forEach(([sku, list]) => {
    console.log(`- SKU: ${sku} (${list.length} ocorrências)`);
    list.forEach(item => console.log(`  - ID: ${item.id}`));
  });
}

scanDuplicates();
