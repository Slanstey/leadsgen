/**
 * Sync backend files to api/backend for Vercel deployment
 * CommonJS version for compatibility
 */
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const apiBackendDir = path.join(__dirname, '..', 'api', 'backend');

// Create api/backend directory if it doesn't exist
if (!fs.existsSync(apiBackendDir)) {
  fs.mkdirSync(apiBackendDir, { recursive: true });
}

// Create services directory
const apiServicesDir = path.join(apiBackendDir, 'services');
if (!fs.existsSync(apiServicesDir)) {
  fs.mkdirSync(apiServicesDir, { recursive: true });
}

// Copy app.py
const appPySource = path.join(backendDir, 'app.py');
const appPyDest = path.join(apiBackendDir, 'app.py');
if (fs.existsSync(appPySource)) {
  fs.copyFileSync(appPySource, appPyDest);
  console.log('✓ Copied app.py');
}

// Copy services files
const servicesSource = path.join(backendDir, 'services');
const servicesDest = path.join(apiBackendDir, 'services');

if (fs.existsSync(servicesSource)) {
  const files = fs.readdirSync(servicesSource);
  files.forEach(file => {
    if (file.endsWith('.py')) {
      const sourceFile = path.join(servicesSource, file);
      const destFile = path.join(servicesDest, file);
      fs.copyFileSync(sourceFile, destFile);
      console.log(`✓ Copied services/${file}`);
    }
  });
}

console.log('Backend files synced to api/backend');

