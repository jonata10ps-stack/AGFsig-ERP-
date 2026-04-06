import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('--- REPAIRING QUOTES ---');
  const { data: quotes, error } = await supabase
    .from('Quote')
    .select('id, quote_number, client_id, client_name');
  
  if (error) {
    console.error('Error fetching quotes:', error);
    return;
  }

  const nullClientName = quotes.filter(q => !q.client_name);
  console.log('Total Quotes:', quotes.length);
  console.log('Quotes missing client_name:', nullClientName.length);

  for (const quote of nullClientName) {
    if (quote.client_id) {
       const { data: client } = await supabase.from('Client').select('name').eq('id', quote.client_id).single();
       if (client?.name) {
          console.log(`Repairing Quote ${quote.quote_number} -> ${client.name}`);
          await supabase.from('Quote').update({ client_name: client.name }).eq('id', quote.id);
       }
    }
  }

  console.log('\n--- REPAIRING SALES ORDERS ---');
  const { data: orders, error: orderError } = await supabase
    .from('SalesOrder')
    .select('id, order_number, client_id, client_name');
  
  if (orderError) {
    console.error('Error fetching orders:', orderError);
    return;
  }

  const nullOrderClientName = orders.filter(o => !o.client_name);
  console.log('Total SalesOrders:', orders.length);
  console.log('SalesOrders missing client_name:', nullOrderClientName.length);

  for (const order of nullOrderClientName) {
    if (order.client_id) {
       const { data: client } = await supabase.from('Client').select('name').eq('id', order.client_id).single();
       if (client?.name) {
          console.log(`Repairing SalesOrder ${order.order_number} -> ${client.name}`);
          await supabase.from('SalesOrder').update({ client_name: client.name }).eq('id', order.id);
       }
    }
  }
}

run();
