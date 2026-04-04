import fs from 'fs';
import path from 'path';

const replacements = {
  'Ã§Ã£o': 'ção',
  'Ã£o': 'ão',
  'Ã§': 'ç',
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã\xad': 'í',
  'Ã³': 'ó',
  'Ãº': 'ú',
  'Ãª': 'ê',
  'Ã´': 'ô',
  'Ã ': 'à',
  'Ã': 'Á',
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

const filesToFix = [
  'src/pages/StorageAllocation.jsx',
  'src/pages/CreateInventoryMove.jsx',
  'src/pages/Separation.jsx',
  'src/pages/Shipping.jsx',
  'src/Layout.jsx'
];

filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixFile(fullPath);
  }
});
