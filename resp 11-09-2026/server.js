const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
const frapcUploadDir = path.join(uploadDir, 'frapc');
const dbFile = path.join(__dirname, 'usuarios.json');
const actFile = path.join(__dirname, 'actividades.json');
const pobFile = path.join(__dirname, 'poblacion.json');
const filesFile = path.join(__dirname, 'files.json');

const activeUsers = {};

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(frapcUploadDir)) fs.mkdirSync(frapcUploadDir, { recursive: true });

if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]');
if (!fs.existsSync(actFile)) fs.writeFileSync(actFile, '[]');
if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]');
if (!fs.existsSync(filesFile)) fs.writeFileSync(filesFile, '[]');

// CONFIGURACIÓN DE MULTER
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetFolder = req.headers['x-target-folder'] || req.query.folder;
        if (targetFolder === 'Minutas' || (req.body && req.body.comentarios && req.body.comentarios.toLowerCase().includes('minuta'))) {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } else {
            const rawUser = req.query.userId || 'general';
            const userIdClean = String(rawUser).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
            const userFolder = path.join(uploadDir, userIdClean);
            if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
            cb(null, userFolder);
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); 

// Página Principal
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'loginuipc.html'));
});

// Autenticación
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const found = users.find(u => u.usuario === username && (u.password === password || u.contrasena === password));
    if (found) {
        res.json({ success: true, user: found });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
    }
});

// Recuperar contraseña
app.post('/api/recover-password', (req, res) => {
    const { usuario, extension } = req.body;
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const found = users.find(u => u.usuario === usuario && String(u.extension) === String(extension));
    if (found) {
        res.json({ success: true, password: found.password || found.contrasena });
    } else {
        res.status(404).json({ success: false, message: 'Usuario o extensión no coinciden.' });
    }
});

// Usuarios
app.get('/api/admin/users', (req, res) => {
    const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    res.json({ success: true, users });
});

app.post('/api/admin/add-user', (req, res) => {
    const newUser = req.body;
    if (newUser.contrasena && !newUser.password) {
        newUser.password = newUser.contrasena;
        delete newUser.contrasena;
    }

    let users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const index = users.findIndex(u => u.usuario === newUser.usuario);
    
    if (index >= 0) {
        users[index] = { ...users[index], ...newUser };
    } else {
        users.push(newUser);
    }
    
    fs.writeFileSync(dbFile, JSON.stringify(users, null, 2), 'utf8');
    res.json({ success: true, user: newUser });
});

app.post('/api/admin/delete-user', (req, res) => {
    const { usuario } = req.body;
    let users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    users = users.filter(u => u.usuario !== usuario);
    fs.writeFileSync(dbFile, JSON.stringify(users, null, 2), 'utf8');
    res.json({ success: true });
});

// Heartbeat y Conexiones en Línea
app.post('/api/heartbeat', (req, res) => {
    const { userId } = req.body;
    if (userId) activeUsers[userId] = Date.now();
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

// Población
app.get('/api/poblacion', (req, res) => {
    const records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    res.json({ success: true, records });
});

app.post('/api/poblacion/save', (req, res) => {
    const { usuario, nombre, ur, nivel, cantidad, fecha } = req.body;
    let records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    
    const index = records.findIndex(r => r.usuario === usuario && String(r.nivel) === String(nivel) && r.fecha === fecha);
    const newRecord = { usuario, nombre, ur, nivel, cantidad, fecha };
    if (index >= 0) {
        records[index] = newRecord;
    } else {
        records.push(newRecord);
    }
    
    fs.writeFileSync(pobFile, JSON.stringify(records, null, 2));
    res.json({ success: true, record: newRecord });
});

// Actividades
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

/* =======================================================
   SISTEMA DE SEGURIDAD DOCUMENTAL Y MINUTAS
   ======================================================= */

app.get('/api/admin/files', (req, res) => {
    let files = [];
    try {
        files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    } catch(e) {
        files = [];
    }
    
    const validFiles = files.filter(f => {
        if (!f.path) return false;
        const safePath = f.path.replace(/^\/uploads\//, '').replace(/\.\.\//g, '');
        const absolutePath = path.join(uploadDir, safePath);
        return fs.existsSync(absolutePath);
    });

    if (validFiles.length !== files.length) {
        fs.writeFileSync(filesFile, JSON.stringify(validFiles, null, 2), 'utf8');
    }

    res.json({ success: true, files: validFiles });
});

app.get('/api/file', (req, res) => {
    const requestedPath = req.query.path;
    if (!requestedPath) {
        return res.status(404).send('Archivo no especificado');
    }
    const safePath = requestedPath.replace(/^\/uploads\//, '').replace(/\.\.\//g, ''); 
    const absolutePath = path.join(uploadDir, safePath);

    if (fs.existsSync(absolutePath)) {
        res.sendFile(absolutePath);
    } else {
        res.status(404).send('Archivo no encontrado en el servidor.');
    }
});

app.post('/api/upload-frapc', upload.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo.' });
    
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const hoyStr = new Date().toLocaleDateString();
    const horaStr = new Date().toLocaleTimeString();
    
    const tempPath = req.file.path;
    const targetPath = path.join(frapcUploadDir, req.file.originalname);
    if (tempPath !== targetPath) {
        fs.renameSync(tempPath, targetPath);
    }

    const newFile = {
        filename: req.file.originalname,
        path: `/uploads/frapc/${req.file.originalname}`,
        usuario: req.body.usuario || 'general',
        fecha: `${hoyStr} ${horaStr}`,
        comentarios: req.body.comentarios || 'Formato FRAPC oficial'
    };
    
    files = files.filter(f => f.filename !== req.file.originalname);
    files.push(newFile);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    
    res.json({ success: true, file: newFile });
});

app.post('/api/upload', upload.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo.' });
    
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const hoyStr = new Date().toLocaleDateString();
    const horaStr = new Date().toLocaleTimeString();
    
    const rawUser = req.query.userId || 'general';
    const userIdClean = String(rawUser).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

    const isMinuta = (req.headers['x-target-folder'] === 'Minutas') || 
                     (req.body.comentarios && req.body.comentarios.toLowerCase().includes('minuta')) ||
                     (req.file.originalname.toLowerCase().includes('min'));

    // SE CORRIGIÓ LA RUTA PARA QUE COINCIDA CON LA CARPETA FÍSICA
    const finalPath = isMinuta ? `/uploads/${req.file.originalname}` : `/uploads/${userIdClean}/${req.file.originalname}`;

    if (isMinuta) {
        const tempPath = req.file.path;
        const targetPath = path.join(uploadDir, req.file.originalname);
        if (tempPath !== targetPath && fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, targetPath);
        }
    }

    const newFile = {
        filename: req.file.originalname,
        path: finalPath,
        usuario: isMinuta ? 'Minutas' : (req.body.usuario || 'general'),
        fecha: `${hoyStr} ${horaStr}`,
        comentarios: req.body.comentarios || ''
    };
    
    files = files.filter(f => f.filename !== req.file.originalname);
    files.push(newFile);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    res.json({ success: true, file: newFile });
});

app.post('/api/delete-file', (req, res) => {
    const { filename } = req.body;
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const fileToDelete = files.find(f => f.filename === filename);
    
    if (!fileToDelete) return res.status(404).json({ success: false });

    files = files.filter(f => f.filename !== filename);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    
    const safePath = fileToDelete.path.replace(/^\/uploads\//, '').replace(/\.\.\//g, ''); 
    const absolutePath = path.join(uploadDir, safePath);
    if(fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);

    res.json({ success: true });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Maestro UIPC operando en http://localhost:${PORT}`);
});