const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. RUTAS DE ARCHIVOS Y DIRECTORIOS BASE
// ==========================================
const dbFile = path.join(__dirname, 'usuarios.json');
const pobFile = path.join(__dirname, 'poblacion.json');
const eventosFile = path.join(__dirname, 'eventos.json');
const actFile = path.join(__dirname, 'actividades.json');
const asisFile = path.join(__dirname, 'asistencia.json');
const filesFile = path.join(__dirname, 'files.json');

const uploadDir = path.join(__dirname, 'uploads');
const frapcUploadDir = path.join(uploadDir, 'frapc');
const minutasUploadDir = path.join(uploadDir, 'minutas');

const activeUsers = {};

// ==========================================
// 2. INICIALIZACIÓN SEGURA DE ARCHIVOS Y CARPETAS
// ==========================================
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(frapcUploadDir)) fs.mkdirSync(frapcUploadDir, { recursive: true });
if (!fs.existsSync(minutasUploadDir)) fs.mkdirSync(minutasUploadDir, { recursive: true });

if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]', 'utf8');
if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]', 'utf8');
if (!fs.existsSync(actFile)) fs.writeFileSync(actFile, '[]', 'utf8');
if (!fs.existsSync(asisFile)) fs.writeFileSync(asisFile, '{}', 'utf8');
if (!fs.existsSync(filesFile)) fs.writeFileSync(filesFile, '[]', 'utf8');

// ==========================================
// 3. CONFIGURACIÓN DE ALMACENAMIENTO (MULTER)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetFolder = req.headers['x-target-folder'] || 'frapc';
        const destDir = targetFolder.toLowerCase() === 'minutas' ? minutasUploadDir : frapcUploadDir;
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        cb(null, destDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 4. MIDDLEWARES Y RECURSOS ESTÁTICOS
// ==========================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

app.use('/uploads', express.static(uploadDir));
app.use('/uploads/minutas', express.static(minutasUploadDir));

// ==========================================
// 5. RUTAS DE VISTAS PRINCIPALES
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/dashboard_mobile.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard_mobile.html')));
app.get('/frapc.html', (req, res) => res.sendFile(path.join(__dirname, 'frapc.html')));
app.get('/formato_frapc.html', (req, res) => res.sendFile(path.join(__dirname, 'formato_frapc.html')));
app.get('/minutas.html', (req, res) => res.sendFile(path.join(__dirname, 'minutas.html')));

// ==========================================
// 6. API DE AUTENTICACIÓN (usuarios.json)
// ==========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        const found = users.find(u => u.usuario === username && (u.password === password || u.contrasena === password));
        if (found) {
            res.json({ success: true, user: found });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error al procesar el acceso.' });
    }
});

// ==========================================
// 7. API DIRECTORIO Y GESTIÓN DE USUARIOS
// ==========================================
app.get('/api/admin/users', (req, res) => {
    try {
        const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        // Devuelve la lista completa con todas las propiedades (incluyendo password y contrasena)
        res.json({ success: true, users: users });
    } catch (e) {
        res.status(500).json({ success: false, users: [] });
    }
});

app.get('/api/admin/all-users', (req, res) => {
    try {
        const users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        res.json({ success: true, users: users });
    } catch (e) {
        res.status(500).json({ success: false, users: [] });
    }
});

// Procesador centralizado para guardar, crear o actualizar usuarios (compatible con POST y PUT)
const procesarGuardadoUsuario = (req, res) => {
    const userData = req.body;
    const identificador = userData.usuario || userData.id;

    if (!identificador) {
        return res.status(400).json({ success: false, message: 'El ID de usuario es obligatorio.' });
    }

    // Normalizar claves de contraseña para asegurar compatibilidad total
    if (userData.contrasena && !userData.password) {
        userData.password = userData.contrasena;
    } else if (userData.password && !userData.contrasena) {
        userData.contrasena = userData.password;
    }

    let users = [];
    try {
        if (fs.existsSync(dbFile)) {
            users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        }
    } catch (e) {}

    const index = users.findIndex(u => u.usuario === identificador || u.id === identificador);
    
    if (index >= 0) {
        users[index] = {
            ...users[index],
            ...userData,
            usuario: identificador,
            password: userData.password || users[index].password || users[index].contrasena || '',
            contrasena: userData.contrasena || users[index].contrasena || users[index].password || ''
        };
    } else {
        users.push({
            usuario: identificador,
            password: userData.password || userData.contrasena || '123456',
            contrasena: userData.contrasena || userData.password || '123456',
            nombre: userData.nombre || '',
            correo: userData.correo || '',
            indicativo: userData.indicativo || 'N/A',
            ur: userData.ur || '',
            cargo: userData.cargo || '',
            suplente: userData.suplente || 'N/A',
            ubicacion: userData.ubicacion || '',
            extension: userData.extension || 'N/A'
        });
    }

    try {
        fs.writeFileSync(dbFile, JSON.stringify(users, null, 2), 'utf8');
        return res.json({ success: true, message: 'Usuario guardado correctamente.' });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Error al escribir en el servidor.' });
    }
};

// Registro de múltiples rutas y métodos (POST y PUT) para evitar errores del frontend
app.post('/api/admin/save-user', procesarGuardadoUsuario);
app.put('/api/admin/save-user', procesarGuardadoUsuario);
app.post('/api/admin/add-user', procesarGuardadoUsuario);
app.put('/api/admin/add-user', procesarGuardadoUsuario);
app.post('/api/admin/update-user', procesarGuardadoUsuario);
app.put('/api/admin/update-user', procesarGuardadoUsuario);
app.post('/api/admin/user/update', procesarGuardadoUsuario);
app.put('/api/admin/user/update', procesarGuardadoUsuario);
app.post('/api/admin/users', procesarGuardadoUsuario);
app.put('/api/admin/users', procesarGuardadoUsuario);

app.post('/api/admin/delete-user', (req, res) => {
    const { usuario } = req.body;
    if (!usuario) return res.status(400).json({ success: false, message: 'Usuario requerido.' });

    let users = [];
    try {
        if (fs.existsSync(dbFile)) {
            users = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        }
    } catch (e) {}

    users = users.filter(u => u.usuario !== usuario);

    try {
        fs.writeFileSync(dbFile, JSON.stringify(users, null, 2), 'utf8');
        res.json({ success: true, message: 'Usuario eliminado correctamente.' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al eliminar en el servidor.' });
    }
});

// ==========================================
// 8. API MONITOR DE USUARIOS EN LÍNEA
// ==========================================
app.post('/api/heartbeat', (req, res) => {
    const { userId } = req.body;
    if (userId) {
        activeUsers[userId] = Date.now();
    }
    res.json({ success: true });
});

app.get('/api/admin/online-users', (req, res) => {
    try {
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
                cargo: u.cargo,
                ubicacion: u.ubicacion,
                extension: u.extension,
                isOnline,
                lastActive: lastActiveStr
            };
        });
        res.json({ success: true, users: list });
    } catch (e) {
        res.status(500).json({ success: false, users: [] });
    }
});

// ==========================================
// 9. API CONTROL DE POBLACIÓN (poblacion.json)
// ==========================================
app.get('/api/poblacion', (req, res) => {
    try {
        const records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
        res.json({ success: true, records });
    } catch (e) {
        res.json({ success: true, records: [] });
    }
});

app.post('/api/poblacion/save', (req, res) => {
    const { usuario, nombre, ur, nivel, cantidad, observaciones, fecha } = req.body;
    let records = [];
    try { records = JSON.parse(fs.readFileSync(pobFile, 'utf8')); } catch (e) {}
    
    const newRecord = { 
        id: Date.now().toString(),
        usuario, nombre, ur, nivel, 
        cantidad: Number(cantidad) || 0, 
        observaciones: observaciones || '', 
        fecha: fecha || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) 
    };

    records.push(newRecord);
    fs.writeFileSync(pobFile, JSON.stringify(records, null, 2), 'utf8');
    res.json({ success: true, record: newRecord });
});

app.post('/api/poblacion/delete', (req, res) => {
    const { id, adminUser } = req.body;
    if (adminUser !== 'coordinador.uipc') {
        return res.status(403).json({ success: false, message: 'Acceso denegado.' });
    }
    let records = [];
    try { records = JSON.parse(fs.readFileSync(pobFile, 'utf8')); } catch (e) {}
    
    records = records.filter(r => String(r.id) !== String(id));
    fs.writeFileSync(pobFile, JSON.stringify(records, null, 2), 'utf8');
    res.json({ success: true });
});

// ==========================================
// 10. API AGENDA Y EVENTOS (eventos.json)
// ==========================================
const obtenerAgendaAlDia = () => {
    const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
    let data = { fecha_creacion: hoy, lista: [] };
    try {
        if (fs.existsSync(eventosFile)) {
            const archivoGuardado = JSON.parse(fs.readFileSync(eventosFile, 'utf8'));
            if (archivoGuardado.fecha_creacion === hoy) data = archivoGuardado;
        }
    } catch (e) {}
    return data;
};

app.get('/api/eventos', (req, res) => {
    try {
        const data = obtenerAgendaAlDia();
        res.json({ success: true, eventos: data.lista });
    } catch (e) {
        res.json({ success: true, eventos: [] });
    }
});

app.post('/api/eventos/rapido', (req, res) => {
    try {
        const { contenido_whatsapp } = req.body;
        if (!contenido_whatsapp) return res.status(400).json({ success: false, message: 'Texto vacío' });

        const data = obtenerAgendaAlDia();
        const horaActual = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
        
        data.lista.push({ 
            id: Date.now(), 
            texto_completo: contenido_whatsapp.trim(), 
            hora_registro: horaActual 
        });

        fs.writeFileSync(eventosFile, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, message: 'Evento guardado' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error interno' });
    }
});

app.post('/api/eventos/borrar', (req, res) => {
    try {
        const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
        fs.writeFileSync(eventosFile, JSON.stringify({ fecha_creacion: hoy, lista: [] }, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 11. API DE ACTIVIDADES Y CALENDARIO (actividades.json)
// ==========================================
app.get('/api/actividades', (req, res) => {
    try {
        if (!fs.existsSync(actFile)) fs.writeFileSync(actFile, '[]', 'utf8');
        const acts = JSON.parse(fs.readFileSync(actFile, 'utf8'));
        res.json({ success: true, activities: acts });
    } catch (e) {
        res.status(500).json({ success: false, activities: [] });
    }
});

app.post('/api/admin/add-activity', (req, res) => {
    const newAct = req.body;
    let acts = [];
    try {
        if (fs.existsSync(actFile)) acts = JSON.parse(fs.readFileSync(actFile, 'utf8'));
    } catch (e) {}

    newAct.id = newAct.id || Date.now().toString();
    acts.push(newAct);

    try {
        fs.writeFileSync(actFile, JSON.stringify(acts, null, 2), 'utf8');
        res.json({ success: true, activity: newAct });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al guardar la actividad.' });
    }
});

app.post('/api/admin/delete-activity', (req, res) => {
    const { id } = req.body;
    let acts = [];
    try {
        if (fs.existsSync(actFile)) acts = JSON.parse(fs.readFileSync(actFile, 'utf8'));
    } catch (e) {}

    acts = acts.filter(a => String(a.id) !== String(id));

    try {
        fs.writeFileSync(actFile, JSON.stringify(acts, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al eliminar la actividad.' });
    }
});

// ==========================================
// 12. API CONTROL DE ASISTENCIA DIARIA (asistencia.json)
// ==========================================
app.get('/api/asistencia', (req, res) => {
    try {
        if (!fs.existsSync(asisFile)) fs.writeFileSync(asisFile, '{}', 'utf8');
        let registros = JSON.parse(fs.readFileSync(asisFile, 'utf8'));
        const hoyFechaStr = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });

        let registrosHoy = {};
        let huboCambios = false;

        for (let usuario in registros) {
            if (registros[usuario].fechaDia === hoyFechaStr) {
                registrosHoy[usuario] = registros[usuario];
            } else {
                huboCambios = true;
            }
        }

        if (huboCambios) fs.writeFileSync(asisFile, JSON.stringify(registrosHoy, null, 2), 'utf8');
        res.json({ success: true, registros: registrosHoy });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al leer la asistencia.' });
    }
});

app.post('/api/asistencia', (req, res) => {
    const { usuario, estatus, hora, observaciones } = req.body;
    if (!usuario) return res.status(400).json({ success: false, message: 'Usuario requerido.' });
    
    let registros = {};
    try {
        if (fs.existsSync(asisFile)) registros = JSON.parse(fs.readFileSync(asisFile, 'utf8'));
    } catch (e) {}

    const hoyFechaStr = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });

    registros[usuario] = {
        estatus,
        hora,
        fechaDia: hoyFechaStr,
        observaciones: observaciones || 'Sin observaciones'
    };

    fs.writeFileSync(asisFile, JSON.stringify(registros, null, 2), 'utf8');
    res.json({ success: true });
});

// ==========================================
// 13. API DE FRAPCS
// ==========================================
app.get('/api/frapcs', (req, res) => {
    if (!fs.existsSync(frapcUploadDir)) {
        fs.mkdirSync(frapcUploadDir, { recursive: true });
    }

    fs.readdir(frapcUploadDir, (err, files) => {
        if (err) {
            return res.status(500).json({ frapcs: [] });
        }

        const listaFrapcs = files
            .filter(file => fs.statSync(path.join(frapcUploadDir, file)).isFile())
            .map((file, index) => {
                const filePath = path.join(frapcUploadDir, file);
                const stats = fs.statSync(filePath);
                return {
                    id: index + 1,
                    folio: file,
                    fecha: stats.mtime.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
                    url: `/uploads/frapc/${file}`
                };
            });

        res.json({ frapcs: listaFrapcs });
    });
});

app.post('/api/upload-frapc', upload.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo.' });
    res.json({ success: true, file: { filename: req.file.originalname, path: `/uploads/frapc/${req.file.originalname}` } });
});

// ==========================================
// 14. API DE MINUTAS Y ARCHIVOS INSTITUCIONALES
// ==========================================
app.get('/api/admin/files', (req, res) => {
    try {
        let allFiles = [];
        if (fs.existsSync(minutasUploadDir)) {
            const files = fs.readdirSync(minutasUploadDir);
            files.forEach((file, index) => {
                const filePath = path.join(minutasUploadDir, file);
                if (fs.statSync(filePath).isFile()) {
                    const stats = fs.statSync(filePath);
                    allFiles.push({
                        id: `minuta_${index}`,
                        filename: file,
                        path: `/uploads/minutas/${file}`,
                        fecha: stats.mtime.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
                        comentarios: 'Minuta oficial institucional'
                    });
                }
            });
        }
        res.json({ success: true, files: allFiles });
    } catch (e) {
        res.status(500).json({ success: false, files: [] });
    }
});

app.post('/api/upload', upload.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo PDF.' });
    const targetFolder = req.headers['x-target-folder'] || 'minutas';
    res.json({ success: true, filename: req.file.originalname, path: `/uploads/${targetFolder.toLowerCase()}/${req.file.originalname}` });
});

app.post('/api/delete-file', (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'Nombre de archivo requerido.' });

    try {
        const filePath = path.join(minutasUploadDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.json({ success: true });
        }
        res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al eliminar el archivo.' });
    }
});

// ==========================================
// 15. INICIALIZACIÓN DEL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor UIPC operando dinámicamente en el puerto ${PORT}`);
});