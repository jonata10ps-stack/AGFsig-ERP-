const fs = require('fs');
const path = require('path');

const srcPages = path.join(__dirname, 'src', 'pages');

const files = fs.readdirSync(srcPages).filter(f => f.endsWith('.jsx'));

const entities = {};

// Regex cases
const entityRegex = /base44\.entities\.([a-zA-Z0-9_]+)\./g;
const formValueRegex = /form\.([a-zA-Z0-9_]+)/g;
const formDataRegex = /formData\.([a-zA-Z0-9_]+)/g;
const inputNameRegex = /name="([a-zA-Z0-9_]+)"/g;

files.forEach(file => {
  const content = fs.readFileSync(path.join(srcPages, file), 'utf-8');
  
  // Encontrar todas as entidades mencionadas no arquivo
  const matchedEntities = new Set();
  let match;
  while ((match = entityRegex.exec(content)) !== null) {
      matchedEntities.add(match[1]);
  }
  
  // Se encontrou alguma entidade, procura por campos "form.xxx" ou "formData.xxx" no arquivo
  if (matchedEntities.size > 0) {
      const fields = new Set();
      
      while ((match = formValueRegex.exec(content)) !== null) {
        if (!['map', 'filter', 'length', 'find', 'reduce', 'forEach'].includes(match[1])) {
          fields.add(match[1]);
        }
      }
      
      while ((match = formDataRegex.exec(content)) !== null) {
        if (!['map', 'filter', 'length', 'find'].includes(match[1])) {
          fields.add(match[1]);
        }
      }

      while ((match = inputNameRegex.exec(content)) !== null) {
        fields.add(match[1]);
      }

      // Adiciona pra todas as entidades mencionadas no arquivo (um chute razoável)
      matchedEntities.forEach(entity => {
          if(!entities[entity]) entities[entity] = new Set();
          fields.forEach(f => entities[entity].add(f));
      });
  }
});

// Converter para script SQL
let sql = '';
for (const [entity, fields] of Object.entries(entities)) {
   sql += `\n-- Tabela ${entity}\n`;
   // sql += `CREATE TABLE IF NOT EXISTS public."${entity}" ( id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), company_id UUID, active BOOLEAN DEFAULT true );\n`;
   
   if (fields.size > 0) {
      sql += `ALTER TABLE public."${entity}"\n`;
      const cols = Array.from(fields).map(f => `  ADD COLUMN IF NOT EXISTS "${f}" text`);
      sql += cols.join(',\n') + ';\n';
   }
}

sql += `\nNOTIFY pgrst, 'reload schema';\n`;

console.log(sql);
fs.writeFileSync('generated_schema.sql', sql);
