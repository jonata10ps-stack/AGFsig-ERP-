import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPages = path.join(__dirname, 'src', 'pages');

const files = fs.readdirSync(srcPages).filter(f => f.endsWith('.jsx'));

const entities = {};

const entityRegex = /base44\.entities\.([a-zA-Z0-9_]+)\./g;
const formFieldRegex = /(?:form|formData|newItem|editForm)\s*[.?\[]+['"]?([a-zA-Z][a-zA-Z0-9_]*)/g;
const setFormRegex = /[Ss]et[Ff]orm\s*\(\s*\{([^}]{0,2000})\}/gms;
const fieldInObjectRegex = /^\s{2,}([a-zA-Z][a-zA-Z0-9_]*):/gm;
const methodCreateUpdateRegex = /\.(?:create|update|batchCreate)\s*\(\s*(?:[^,]*,\s*)?\{([^}]{0,3000})\}/gs;

const SKIP_FIELDS = new Set([
  // Métodos JS — não são campos de banco
  'map','filter','length','find','reduce','forEach','some','every',
  'then','catch','finally','push','pop','slice','splice','includes',
  'preventDefault','target','value','checked',
  'current', 'key', 'ref', 'children', 'className', 'style',
  'toString', 'join', 'split', 'trim', 'replace',
  // Colunas padrão já criadas pelo schema base em todas as tabelas
  'id','created_at','company_id','active',
]);

files.forEach(file => {
  const content = fs.readFileSync(path.join(srcPages, file), 'utf-8');

  // Find entities used
  const matchedEntities = new Set();
  const entityRe = /base44\.entities\.([a-zA-Z0-9_]+)\./g;
  let m;
  while ((m = entityRe.exec(content)) !== null) {
    matchedEntities.add(m[1]);
  }

  if (matchedEntities.size === 0) return;

  const fields = new Set();

  // Extract from form.field patterns
  const fieldRe = /(?:form|formData|newItem|editForm|newClient|newForm)\s*[.?[]+['"]?([a-zA-Z][a-zA-Z0-9_]*)/g;
  while ((m = fieldRe.exec(content)) !== null) {
    const f = m[1];
    if (!SKIP_FIELDS.has(f) && f.length > 1) fields.add(f);
  }

  // Extract initial form state objects: { field: value, ... }
  const initStateRe = /(?:useState|initialForm|defaultForm|emptyForm)\s*\(\s*\{([^}]{0,4000})\}/gs;
  while ((m = initStateRe.exec(content)) !== null) {
    const obj = m[1];
    const keyRe = /^\s+([a-zA-Z][a-zA-Z0-9_]*):/gm;
    let km;
    while ((km = keyRe.exec(obj)) !== null) {
      const f = km[1];
      if (!SKIP_FIELDS.has(f) && f.length > 1) fields.add(f);
    }
  }

  // Detect specifically 'created_date' or other manual assignments
  if (content.includes('created_date:')) {
    fields.add('created_date');
  }
  if (content.includes('updated_date:')) {
    fields.add('updated_date');
  }

  // Extract from .create({ field: value }) or .update(id, { field: value })
  const methodRe = /\.(?:create|update|batchCreate)\s*\(\s*(?:[^,]*,\s*)?\{([^}]{0,4000})\}/gs;
  while ((m = methodRe.exec(content)) !== null) {
    const obj = m[1];
    const keyRe = /^\s+([a-zA-Z][a-zA-Z0-9_]*):/gm;
    let km;
    while ((km = keyRe.exec(obj)) !== null) {
      const f = km[1];
      if (!SKIP_FIELDS.has(f) && f.length > 1) fields.add(f);
    }
  }

  // Store per entity
  matchedEntities.forEach(entity => {
    if (!entities[entity]) entities[entity] = new Set();
    fields.forEach(f => entities[entity].add(f));
  });
});

// Gera SQL de ALTER TABLE com todas as colunas detectadas
const COMMON_COLS = new Set(['id', 'created_at', 'company_id', 'active']);

let sql = `-- ====================================================
-- Script Gerado Automaticamente em ${new Date().toISOString()}
-- Execute no SQL Editor do Supabase
-- ====================================================

`;

const sortedEntities = Object.entries(entities).sort(([a], [b]) => a.localeCompare(b));

for (const [entity, fields] of sortedEntities) {
  const extra = Array.from(fields).filter(f => !COMMON_COLS.has(f)).sort();
  if (extra.length === 0) continue;

  sql += `-- Tabela: ${entity}\n`;
  sql += `ALTER TABLE public."${entity}"\n`;
  sql += extra.map(f => `  ADD COLUMN IF NOT EXISTS "${f}" text`).join(',\n');
  sql += `;\n\n`;
}

sql += `-- Recarrega cache do schema do PostgREST\nNOTIFY pgrst, 'reload schema';\n`;

fs.writeFileSync('generated_schema.sql', sql, 'utf-8');
console.log('✅ Arquivo generated_schema.sql criado com sucesso!');
console.log(`📋 Total de tabelas mapeadas: ${sortedEntities.length}`);
sortedEntities.forEach(([entity, fields]) => {
  const extra = Array.from(fields).filter(f => !COMMON_COLS.has(f));
  if (extra.length > 0) console.log(`  - ${entity}: ${extra.length} colunas`);
});
