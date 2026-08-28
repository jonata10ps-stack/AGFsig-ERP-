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
  const { data: routes, error: err1 } = await supabase.from('ProductionRoute').select('id, name, product_id');
  if (err1) {
    console.error('Error fetching routes:', err1);
    return;
  }
  
  console.log('Routes in DB:');
  for (const r of routes) {
    const { data: steps, error: err2 } = await supabase.from('ProductionRouteStep').select('id, name, sequence').eq('route_id', r.id);
    console.log(`Route ID: ${r.id}, Name: ${r.name}, Product ID: ${r.product_id}, Steps count: ${steps?.length || 0}`);
    if (steps && steps.length > 0) {
      steps.forEach(s => console.log(`  - Step: ${s.name} (sequence: ${s.sequence})`));
    }
  }
}

run();
