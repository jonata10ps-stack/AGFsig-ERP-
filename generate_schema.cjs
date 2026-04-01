const fs = require('fs');
const data = JSON.parse(fs.readFileSync('schema_extract.json', 'utf8'));

let sql = '-- Auto-generated Supabase Schema based on frontend entities inference\n\n';

for (const [entityName, details] of Object.entries(data)) {
    const tableName = entityName; 
    
    // Default columns that probably every table has (by Supabase convention)
    sql += `CREATE TABLE public."${tableName}" (\n`;
    sql += `  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,\n`;
    sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n`;
    
    // Add inferred fields
    const fields = details.inferredFields || [];
    const fieldsToCreate = new Set(fields);
    
    // Filter out standard fields that we already add or are not real fields
    ['id', 'created_at', 'company_id', 'enabled', 'active', 'staleTime', 'refetchInterval', 
     'gcTime', 'refetchOnMount', 'page'].forEach(f => fieldsToCreate.delete(f));

    // company_id is very common, foreign key usually
    sql += `  company_id UUID,\n`;
    sql += `  active BOOLEAN DEFAULT true,\n`;

    const fieldArray = Array.from(fieldsToCreate);
    for (let i = 0; i < fieldArray.length; i++) {
        const field = fieldArray[i];
        
        let type = 'TEXT';
        if (field.endsWith('_id')) type = 'UUID';
        else if (field.startsWith('qty') || field.includes('quantity') || field.includes('amount') || field.includes('cost') || field.includes('price')) type = 'NUMERIC';
        else if (field.includes('date') || field.includes('time')) type = 'TIMESTAMP WITH TIME ZONE';
        else if (field.startsWith('is_') || field.startsWith('has_')) type = 'BOOLEAN';
        else if (field === 'enabled') type = 'BOOLEAN';

        // ensure no trailing comma for the last field
        if (i === fieldArray.length - 1) {
            sql += `  "${field}" ${type}\n`;
        } else {
            sql += `  "${field}" ${type},\n`;
        }
    }
    
    // if there were no extra fields, we need to remove the trailing comma from 'active BOOLEAN DEFAULT true,\n'
    if (fieldArray.length === 0) {
        // Find the last comma and replace it
        sql = sql.replace(/,\n$/, '\n');
    }

    sql += `);\n\n`;
}

fs.writeFileSync('schema.sql', sql);
console.log('Successfully wrote schema.sql');
