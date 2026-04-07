
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpload() {
  const fileContent = Buffer.from('Test File Content');
  const fileName = `test_${Date.now()}.txt`;
  
  console.log(`Testando upload para bucket 'attachments'...`);
  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(fileName, fileContent, { contentType: 'text/plain' });

  if (error) {
    console.error('❌ Upload Falhou via Terminal:', error.message);
  } else {
    console.log('✅ Upload Funcionou via Terminal! URL:', data.path);
  }
}

testUpload();
