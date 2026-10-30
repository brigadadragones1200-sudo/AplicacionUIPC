const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const uploadDir = path.join(__dirname, 'uploads');
const dbFile = path.join(__dirname, 'usuarios.json');
const actFile = path.join(__dirname, 'actividades.json');
const pobFile = path.join(__dirname, 'poblacion.json');
const filesFile = path.join(__dirname, 'files.json');

const activeUsers = {};

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify([
        { usuario: 'coordinador.uipc', password: 'Uipc2026*', nombre: 'Administrador Coordinador Operativo', correo: 'coordinador@sep.gob.mx', cargo: 'Coordinador General', ur: 'DGRMyS', extension: '62015', ubicacion: 'Oficina Central', suplente: 'N/A' },
        { usuario: 'daniel.gonzalez', password: '123', nombre: 'Daniel Fernando González Pacheco', correo: 'daniel.gonzalez@nube.sep.gob.mx', ur: 'DGDy8NEM', cargo: 'Coordinador Operativo Unidad Interna de Protección Civil', extension: '62015', ubicacion: 'sector 2-4', suplente: 'Eduardo Sánchez Salas' },
        { usuario: 'ivan.vela', password: '123', nombre: 'Ivan Vela', correo: 'ivan.vela@sep.gob.mx', ur: 'DGAIR', cargo: 'Operativo UIPC', extension: '62015', ubicacion: 'Oficina Central', suplente: 'N/A' },
        { usuario: 'myriam.rojas', password: '123', nombre: 'Myriam de Lourdes Rojas Flores', correo: 'myriam.rojas@sep.gob.mx', ur: 'DGAIR', cargo: 'Capacitación', extension: '62015', ubicacion: 'Oficina', suplente: 'N/A' },
        { usuario: 'sujei.alonso', password: '123', nombre: 'Sujei Alonso', correo: 'sujei.alonso@sep.gob.mx', ur: 'DGCO', cargo: 'Brigada de Comunicación', extension: '62015', ubicacion: 'Oficina Central', suplente: 'N/A' }
    ], null, 2));
}

if (!fs.existsSync(actFile)) {
    fs.writeFileSync(actFile, JSON.stringify([{ id: '1', titulo: 'Simulacro Trimestral', fecha: '2026-09-18', hora: '11:00 Hrs', sede: 'Inmueble Central', creadoPor: 'coordinador.uipc' }], null, 2));
}

if (!fs.existsSync(pobFile)) {
    fs.writeFileSync(pobFile, JSON.stringify([], null, 2));
}

if (!fs.existsSync(filesFile)) {
    fs.writeFileSync(filesFile, JSON.stringify([], null, 2));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Capturar dinámicamente el usuario desde el body, headers o usar el nombre actual conectado
        const rawUser = (req.body && (req.body.userId || req.body.usuario)) 
            ? (req.body.userId || req.body.usuario) 
            : (req.headers['x-user-id'] || 'ivan.vela');
        
        const userId = String(rawUser).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
        const userFolder = path.join(uploadDir, userId);
        
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }
        cb(null, userFolder);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const found = users.find(u => u.usuario === username && u.password === password);
    if (found) {
        res.json({ success: true, user: found });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    }
});

app.post('/api/recover-password', (req, res) => {
    const { usuario, extension } = req.body;
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const found = users.find(u => u.usuario === usuario && String(u.extension) === String(extension));
    if (found) {
        res.json({ success: true, password: found.password });
    } else {
        res.status(404).json({ success: false, message: 'Usuario o extensión no coinciden.' });
    }
});

app.get('/api/admin/users', (req, res) => {
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    res.json({ success: true, users });
});

app.post('/api/heartbeat', (req, res) => {
    const { userId } = req.body;
    if (userId) {
        activeUsers[userId] = Date.now();
    }
    res.json({ success: true });
});

app.get('/api/admin/online-users', (req, res) => {
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const now = Date.now();
    const list = users.map(u => {
        const last = activeUsers[u.usuario] || 0;
        const diff = now - last;
        const isOnline = diff < 30000;
        let lastActiveStr = "Desconectado";
        if (last > 0) {
            const seconds = Math.floor(diff / 1000);
            if (seconds < 60) lastActiveStr = `Hace ${seconds}s`;
            else lastActiveStr = `Hace ${Math.floor(seconds/60)}m`;
        }
        return {
            usuario: u.usuario,
            nombre: u.nombre,
            ur: u.ur,
            isOnline,
            lastActive: lastActiveStr
        };
    });
    res.json({ success: true, users: list });
});

app.get('/api/poblacion', (req, res) => {
    const records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    res.json({ success: true, records });
});

app.post('/api/poblacion/save', (req, res) => {
    const { usuario, nombre, ur, nivel, cantidad, fecha } = req.body;
    let records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    const index = records.findIndex(r => r.usuario === usuario && r.fecha === fecha);
    const newRecord = { usuario, nombre, ur, nivel, cantidad, fecha };
    if (index >= 0) {
        records[index] = newRecord;
    } else {
        records.push(newRecord);
    }
    fs.writeFileSync(pobFile, JSON.stringify(records, null, 2));
    res.json({ success: true, record: newRecord });
});

app.get('/api/actividades', (req, res) => {
    const acts = JSON.parse(fs.readFileSync(actFile, 'utf8'));
    res.json({ success: true, activities: acts });
});

app.post('/api/admin/add-activity', (req, res) => {
    const newAct = req.body;
    let acts = JSON.parse(fs.readFileSync(actFile, 'utf8'));
    newAct.id = Date.now().toString();
    acts.push(newAct);
    fs.writeFileSync(actFile, JSON.stringify(acts, null, 2));
    res.json({ success: true, activity: newAct });
});

app.post('/api/admin/delete-activity', (req, res) => {
    const { id } = req.body;
    let acts = JSON.parse(fs.readFileSync(actFile, 'utf8'));
    acts = acts.filter(a => String(a.id) !== String(id));
    fs.writeFileSync(actFile, JSON.stringify(acts, null, 2));
    res.json({ success: true });
});

app.get('/api/admin/files', (req, res) => {
    const files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    res.json({ success: true, files });
});

app.post('/api/upload', upload.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo.' });
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const hoyStr = new Date().toLocaleDateString();
    const horaStr = new Date().toLocaleTimeString();
    
    const rawUser = (req.body && (req.body.userId || req.body.usuario)) 
        ? (req.body.userId || req.body.usuario) 
        : (req.headers['x-user-id'] || 'ivan.vela');
        
    const userId = String(rawUser).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    const isMinuta = req.body.comentarios && req.body.comentarios.toLowerCase().includes('minuta');
    
    const newFile = {
        filename: req.file.originalname,
        path: isMinuta ? `/uploads/${req.file.filename}` : `/uploads/${userId}/${req.file.originalname}`,
        usuario: isMinuta ? 'Minutas' : (req.body.usuario || userId),
        fecha: `${hoyStr} ${horaStr}`,
        comentarios: req.body.comentarios || ''
    };
    files.push(newFile);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    res.json({ success: true, file: newFile });
});

app.post('/api/delete-file', (req, res) => {
    const { filename } = req.body;
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    files = files.filter(f => f.filename !== filename);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    res.json({ success: true });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor UIPC operando en http://localhost:${PORT}`);
});