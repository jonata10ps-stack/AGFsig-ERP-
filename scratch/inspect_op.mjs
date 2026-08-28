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
  const { data, error } = await supabase.from('ProductionOrder').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('ProductionOrder record keys:', Object.keys(data[0] || {}));
    console.log('Sample record:', data[0]);
  }
}

run();
