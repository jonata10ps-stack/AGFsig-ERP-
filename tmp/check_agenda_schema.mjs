import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vcbbvqhfcnouhsazqoxr.supabase.co';
const supabaseKey = 'sb_publishable_mPUq6bR5836zSYvFbMS-TA_-hSQm_uF';

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'ProspectionVisit',
  'DailyVehicleLog',
  'ProspectionProjectItem',
  'Seller',
  'Quote',
  'Product',
  'Notification',
  'User'
];

async function checkSchemas() {
  for (const table of tables) {
    console.log(`\n--- Checking [${table}] ---`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Columns in ${table}:`, Object.keys(data[0]));
    } else {
      console.log(`No records found in ${table} to inspect.`);
    }
  }
}

checkSchemas();
