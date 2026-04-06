import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: shipments, error } = await supabase
    .from('SalesOrder')
    .select('id, order_number, client_id, client_name')
    .eq('is_shipment', true);
  
  if (error) {
    console.error('Error fetching shipments:', error);
    return;
  }

  const nullClientName = shipments.filter(s => !s.client_name);
  console.log('Total Shipments:', shipments.length);
  console.log('Shipments missing client_name:', nullClientName.length);
  console.log(JSON.stringify(nullClientName, null, 2));

  // Retroactive repair
  for (const ship of nullClientName) {
    if (ship.client_id) {
       const { data: client } = await supabase.from('Client').select('name').eq('id', ship.client_id).single();
       if (client?.name) {
          console.log(`Repairing shipment ${ship.order_number} -> ${client.name}`);
          await supabase.from('SalesOrder').update({ client_name: client.name }).eq('id', ship.id);
       }
    }
  }
}

run();
