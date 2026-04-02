import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carregar .env manualmente
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY devem estar no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runCleanup() {
  console.log("🚀 Iniciando limpeza do Kardex...");

  // 1. Buscar todos os movimentos de Entrada/Compra do dia de hoje (ou todos para ser seguro)
  const { data: moves, error: movesErr } = await supabase
    .from('InventoryMove')
    .select('*')
    .eq('type', 'ENTRADA')
    .eq('related_type', 'COMPRA')
    //.gte('created_at', new Date().toISOString().split('T')[0]) // Opcional: restringir a hoje
    .order('created_at', { ascending: true });

  if (movesErr) {
    console.error("Erro ao buscar movimentos:", movesErr);
    return;
  }

  console.log(`🔍 Analisando ${moves.length} movimentos de ENTRADA (COMPRA)...`);

  const toDelete = [];
  const processed = new Set();

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (processed.has(move.id)) continue;

    // Encontrar candidatos a duplicidade
    // Definição: Mesmo produto, mesma quantidade, mesma empresa e data/hora muito próxima (< 5 min)
    const duplicates = moves.filter((m, index) => {
      if (index <= i || processed.has(m.id)) return false;
      
      const sameProduct = m.product_id === move.product_id;
      const sameQty = Math.abs(m.qty - move.qty) < 0.001;
      const sameCompany = m.company_id === move.company_id;
      
      const timeDiff = Math.abs(new Date(m.created_at) - new Date(move.created_at)) / 1000;
      const veryClose = timeDiff < 300; // 5 minutos

      // Duplicidade confirmada se:
      // a) Tem o mesmo related_id (Lote)
      // b) OU Um tem related_id e o outro não (GHOST), mas coincidem em produto/quantidade/tempo
      const sameBatch = m.related_id === move.related_id;
      const oneGhost = !m.related_id || !move.related_id;

      return sameProduct && sameQty && sameCompany && veryClose && (sameBatch || oneGhost);
    });

    if (duplicates.length > 0) {
      console.log(`⚠️  Encontrada(s) ${duplicates.length} duplicata(s) para o produto ${move.product_id} (Qtd: ${move.qty})`);
      
      // PRIORIDADE: Manter o registro que tem motivo (reason) ou related_id preenchido
      let keep = move;
      if (!move.reason && duplicates.some(d => d.reason)) {
          keep = duplicates.find(d => d.reason);
      }

      duplicates.forEach(d => {
        if (d.id !== keep.id) {
          toDelete.push(d.id);
          processed.add(d.id);
        }
      });
      processed.add(keep.id);
    }
  }

  if (toDelete.length === 0) {
    console.log("✅ Nenhuma duplicata encontrada no histórico.");
  } else {
    console.log(`🗑️  Deletando ${toDelete.length} movimentos duplicados...`);
    const { error: delErr } = await supabase
      .from('InventoryMove')
      .delete()
      .in('id', toDelete);

    if (delErr) {
      console.error("Erro ao deletar:", delErr);
      return;
    }
    console.log("✅ Histórico limpo com sucesso.");
  }

  // 2. RECONSTRUIR SALDOS (Sync)
  console.log("🔄 Reconstruindo Saldos de Estoque (StockBalance) a partir do Kardex limpo...");

  // Buscar todos os movimentos restantes para a empresa (idealmente filtrar por empresa se houver muitas)
  const { data: allMoves, error: allMovesErr } = await supabase
    .from('InventoryMove')
    .select('*')
    .order('created_at', { ascending: true });

  if (allMovesErr) {
    console.error("Erro ao buscar movimentos para reconstrução:", allMovesErr);
    return;
  }

  // Deletar saldos atuais para evitar mistura (ATENÇÃO: Operação destrutiva controlada)
  // Nota: Idealmente faríamos produto por produto, mas para garantir sync total, zeramos.
  console.log("🧹 Zerando tabela StockBalance...");
  const { error: clearErr } = await supabase.from('StockBalance').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos
  if (clearErr) console.warn("Aviso ao limpar StockBalance (pode estar vazia):", clearErr.message);

  const finalBalances = {};

  for (const move of allMoves) {
    const productId = move.product_id;
    const companyId = move.company_id;
    
    // Entrada
    if (move.to_warehouse_id) {
      const key = `${productId}-${move.to_warehouse_id}-${move.to_location_id || 'NULL'}`;
      if (!finalBalances[key]) {
        finalBalances[key] = { 
          product_id: productId, 
          warehouse_id: move.to_warehouse_id, 
          location_id: move.to_location_id, 
          qty_available: 0, 
          qty_reserved: 0, 
          qty_separated: 0, 
          company_id: companyId,
          avg_cost: move.unit_cost || 0
        };
      }
      const prevQty = finalBalances[key].qty_available;
      const prevCost = finalBalances[key].avg_cost;
      const moveQty = move.qty || 0;
      const moveCost = move.unit_cost || 0;

      finalBalances[key].qty_available += moveQty;
      
      // Média ponderada de custo (opcional)
      if (prevQty + moveQty > 0 && moveCost > 0) {
        finalBalances[key].avg_cost = (prevQty * prevCost + moveQty * moveCost) / (prevQty + moveQty);
      }
    }

    // Saída
    if (move.from_warehouse_id) {
      const key = `${productId}-${move.from_warehouse_id}-${move.from_location_id || 'NULL'}`;
      if (finalBalances[key]) {
        finalBalances[key].qty_available -= (move.qty || 0);
      }
    }
  }

  // Inserir os novos saldos
  const balancesToInsert = Object.values(finalBalances).filter(b => Math.abs(b.qty_available) > 0.0001);
  console.log(`📤 Inserindo ${balancesToInsert.length} novos registros de saldo...`);

  if (balancesToInsert.length > 0) {
    const { error: insErr } = await supabase.from('StockBalance').insert(balancesToInsert);
    if (insErr) {
      console.error("Erro ao inserir novos saldos:", insErr);
      return;
    }
  }

  console.log("✨ PROCESSO CONCLUÍDO COM SUCESSO! Kardex e Saldos estão em sintonia.");
}

runCleanup();
