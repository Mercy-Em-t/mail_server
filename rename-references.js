const fs = require('fs');
const files = [
  'server.js',
  'admin.html',
  'legacy_node_version/server.js',
  'legacy_node_version/admin.html'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/INDEX\.HTML/g, 'index.html');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
