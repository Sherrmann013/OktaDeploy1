const fs = require('fs');
const path = require('path');

// Read the correct maze logo file
const logoPath = path.join(__dirname, 'client/public/maze-logo.png');
const logoBuffer = fs.readFileSync(logoPath);
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

console.log('Maze logo data prepared:');
console.log('File size:', logoBuffer.length);
console.log('Base64 length:', logoBase64.length);
console.log('First 100 chars:', logoBase64.substring(0, 100));

// Output the SQL command
console.log('\nSQL Update command:');
const sqlCommand = `UPDATE company_logos SET logo_data = '${logoBase64}', file_size = ${logoBuffer.length} WHERE id = 2;`;
fs.writeFileSync('update-maze-logo.sql', sqlCommand);
console.log('SQL command written to update-maze-logo.sql');