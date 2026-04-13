import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Entidades extras encontradas no código
  const extraTables = [
    'BOMDeliveryControl', 'OPConsumptionControl', 'MaterialConsumption',
    'TechnicianHistory', 'SeparationItem', 'StockReservation',
  ];

  console.log('=== TABELAS EXTRAS REFERENCIADAS NO CÓDIGO ===\n');
  for (const table of extraTables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error && (error.message?.includes('does not exist') || error.code === '42P01' || error.message?.includes('relation'))) {
      console.log(`❌ ${table}: NÃO EXISTE no banco`);
    } else {
      console.log(`✅ ${table}: existe (${data?.length || 0} registros amostra)`);
    }
  }

  // Verificar colunas StockBalance
  console.log('\n=== COLUNAS DA TABELA StockBalance ===\n');
  const { data: sb } = await supabase.from('StockBalance').select('*').limit(1);
  if (sb?.[0]) {
    console.log('Colunas:', Object.keys(sb[0]).join(', '));
  }

  // Verificar colunas ProductionOrder
  console.log('\n=== COLUNAS DA TABELA ProductionOrder ===\n');
  const { data: po } = await supabase.from('ProductionOrder').select('*').limit(1);
  if (po?.[0]) {
    console.log('Colunas:', Object.keys(po[0]).join(', '));
  }

  // Verificar colunas User
  console.log('\n=== COLUNAS DA TABELA User ===\n');
  const { data: usr } = await supabase.from('User').select('*').limit(1);
  if (usr?.[0]) {
    console.log('Colunas:', Object.keys(usr[0]).join(', '));
  }
}

main().catch(console.error);
