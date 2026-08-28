import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://vcbbvqhfcnouhsazqoxr.supabase.co';
let key = '';
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const match = envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/) || envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  if (match) key = match[1].trim();
} catch (e) {}

if (!key) {
  console.log('Key not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, key);

async function run() {
  const { data, error } = await supabase.from('ProductionOrder').select('id, op_number, numero_op_externo, route_id, route_name').order('created_at', { ascending: false }).limit(10);
  if (error) {
    console.error('Error fetching OPs:', error);
    return;
  }
  
  console.log('Production Orders list:');
  for (const op of data) {
    const { count } = await supabase.from('ProductionStep').select('id', { count: 'exact', head: true }).eq('op_id', op.id);
    console.log(`ID: ${op.id}, External OP: ${op.numero_op_externo}, Internal OP: ${op.op_number}, Route ID: ${op.route_id}, Route Name: ${op.route_name}, Steps count: ${count}`);
  }
}

run();
