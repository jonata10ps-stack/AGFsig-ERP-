import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vcbbvqhfcnouhsazqoxr.supabase.co';
const supabaseKey = 'sb_publishable_mPUq6bR5836zSYvFbMS-TA_-hSQm_uF';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking ServiceOrder structure...');
  const { data, error } = await supabase
    .from('ServiceOrder')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching ServiceOrder:', error);
  } else if (data && data.length > 0) {
    console.log('Columns found in ServiceOrder:', Object.keys(data[0]));
  } else {
    console.log('No ServiceOrder records found to inspect.');
  }

  console.log('\nChecking TechnicianHistory structure...');
  const { data: historyData, error: historyError } = await supabase
    .from('TechnicianHistory')
    .select('*')
    .limit(1);

  if (historyError) {
    console.error('Error fetching TechnicianHistory:', historyError);
  } else if (historyData && historyData.length > 0) {
    console.log('Columns found in TechnicianHistory:', Object.keys(historyData[0]));
  } else {
    console.log('No TechnicianHistory records found.');
  }
}

checkSchema();
