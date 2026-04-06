const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://vcbbvqhfcnouhsazqoxr.supabase.co', 'sb_publishable_mPUq6bR5836zSYvFbMS-TA_-hSQm_uF');

const sql = `
  ALTER TABLE IF EXISTS "ServiceOrder" ADD COLUMN IF NOT EXISTS "client_signature" text;
  ALTER TABLE IF EXISTS "ServiceOrder" ADD COLUMN IF NOT EXISTS "service_photos" jsonb DEFAULT '[]';
  ALTER TABLE IF EXISTS "ServiceOrder" ADD COLUMN IF NOT EXISTS "total_cost" numeric DEFAULT 0;
  ALTER TABLE IF EXISTS "ServiceOrder" ADD COLUMN IF NOT EXISTS "started_at" text;
  ALTER TABLE IF EXISTS "ServiceOrder" ADD COLUMN IF NOT EXISTS "completed_at" text;
  ALTER TABLE IF EXISTS "ServiceOrder" ADD COLUMN IF NOT EXISTS "labor_hours" text DEFAULT '0';
`;

s.rpc('execute_sql', { sql }).then(r => {
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
