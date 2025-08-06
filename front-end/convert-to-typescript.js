const fs = require('fs');
const path = require('path');

// Basic TypeScript conversion patterns
const conversions = [
  // Add React import for TSX files
  {
    pattern: /^(import.*from 'react';?\n?)/m,
    replacement: (match, p1) => p1.includes('React') ? p1 : p1.replace(/^import/, 'import React,')
  },
  
  // Convert function components to typed
  {
    pattern: /^(export\s+(?:default\s+)?(?:const|function)\s+\w+)\s*=?\s*\(([^)]*)\)\s*=>/m,
    replacement: '$1: React.FC<{$2}> = ($2) =>'
  },
  
  // Add React.FC type to function declarations
  {
    pattern: /^(export\s+(?:default\s+)?(?:const|function)\s+\w+)\s*=?\s*\(\s*{\s*([^}]*)\s*}\s*\)\s*=>/m,
    replacement: '$1: React.FC<{$2}> = ({ $2 }) =>'
  },
  
  // Remove PropTypes import
  {
    pattern: /import PropTypes from 'prop-types';\n?/,
    replacement: ''
  },
  
  // Remove PropTypes definitions
  {
    pattern: /\w+\.propTypes = \{[^}]*\};\n?/g,
    replacement: ''
  }
];

function convertFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let convertedContent = content;
  
  conversions.forEach(({ pattern, replacement }) => {
    convertedContent = convertedContent.replace(pattern, replacement);
  });
  
  fs.writeFileSync(filePath, convertedContent);
  console.log(`Converted ${filePath}`);
}

// Convert all TSX files in contexts and components
const contextsDir = './src/contexts';
const componentsDir = './src/components';

[contextsDir, componentsDir].forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir)
      .filter(file => file.endsWith('.tsx'))
      .forEach(file => {
        const filePath = path.join(dir, file);
        convertFile(filePath);
      });
  }
});

console.log('TypeScript conversion completed!');
