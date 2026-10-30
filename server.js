const express = require('express');
const httpMod = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const server = httpMod.createServer(app);
const PORT = process.env.PORT || 3000;

// Directorios principales adaptados de forma segura y portable para la nube
const uploadDir = path.join(__dirname, 'uploads');
const frapcUploadDir = path.join(uploadDir, 'frapc');
const minutasUploadDir = path.join(uploadDir, 'minutas');
const rutaRedFormato = path.join(uploadDir, 'RED_Formato');

// Archivos de base de datos JSON
const dbFile = path.join(__dirname, 'usuarios.json');
const actFile = path.join(__dirname, 'actividades.json');
const pobFile = path.join(__dirname, 'poblacion.json');
const filesFile = path.join(__dirname, 'files.json');
const asisFile = path.join(__dirname, 'asistencia.json');
const eventosFile = path.join(__dirname, 'eventos.json');

const activeUsers = {};

// Crear carpetas si no existen de forma segura
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(frapcUploadDir)) fs.mkdirSync(frapcUploadDir, { recursive: true });
if (!fs.existsSync(minutasUploadDir)) fs.mkdirSync(minutasUploadDir, { recursive: true });
if (!fs.existsSync(rutaRedFormato)) fs.mkdirSync(rutaRedFormato, { recursive: true });

// Crear archivos JSON iniciales si no existen
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]');
if (!fs.existsSync(actFile)) fs.writeFileSync(actFile, '[]');
if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]');
if (!fs.existsSync(filesFile)) fs.writeFileSync(filesFile, '[]');
if (!fs.existsSync(asisFile)) fs.writeFileSync(asisFile, '{}', 'utf8');

// Configuración de almacenamiento Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetFolder = req.headers['x-target-folder'] || req.query.folder;
        if (targetFolder === 'Minutas' || (req.body && req.body.tipoCarpeta === 'Minutas')) {
            if (!fs.existsSync(minutasUploadDir)) fs.mkdirSync(minutasUploadDir, { recursive: true });
            cb(null, minutasUploadDir);
        } else {
            const rawUser = req.query.userId || (req.body ? req.body.usuario : 'general');
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

const storageRED = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(rutaRedFormato)) fs.mkdirSync(rutaRedFormato, { recursive: true });
        cb(null, rutaRedFormato);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const uploadRED = multer({ storage: storageRED });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Exponer carpeta uploads de forma pública para visualizar PDFs y FRAPCs
app.use('/uploads', express.static(uploadDir));

// RUTAS INICIALES Y VISTAS PRINCIPALES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/dashboard_mobile.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard_mobile.html')));

// API AUTENTICACIÓN
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

// ADMINISTRACIÓN DE USUARIOS
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

// MONITOR DE USUARIOS EN LÍNEA
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

// CONTROL DE ASISTENCIA DIARIA
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

// CONTROL DE POBLACIÓN
app.get('/api/poblacion', (req, res) => {
    const records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    res.json({ success: true, records });
});

app.post('/api/poblacion/save', (req, res) => {
    const { usuario, nombre, ur, nivel, cantidad, observaciones, fecha } = req.body;
    let records = [];
    try { records = JSON.parse(fs.readFileSync(pobFile, 'utf8')); } catch(e) {}
    
    const newRecord = { 
        id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
        usuario, nombre, ur, nivel, cantidad, observaciones, fecha 
    };
    
    records.push(newRecord); 
    fs.writeFileSync(pobFile, JSON.stringify(records, null, 2));
    res.json({ success: true, record: newRecord });
});

app.post('/api/poblacion/delete', (req, res) => {
    const { id, adminUser } = req.body;
    if (adminUser !== 'coordinador.uipc') {
        return res.status(403).json({ success: false, message: 'Acceso denegado: Solo el Coordinador puede eliminar registros.' });
    }
    
    let records = [];
    try { records = JSON.parse(fs.readFileSync(pobFile, 'utf8')); } catch(e) {}
    
    const initialLength = records.length;
    records = records.filter(r => r.id !== id);
    
    if (records.length < initialLength) {
        fs.writeFileSync(poblacionFile, JSON.stringify(records, null, 2)); // Corregido por consistencia
        res.json({ success: true, message: 'Registro eliminado correctamente.' });
    } else {
        res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    }
});

// CONTROL DE ACTIVIDADES
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

// REPOSITORIO DOCUMENTAL Y CONTROL DE ARCHIVOS
app.get('/api/admin/files', (req, res) => {
    let files = [];
    try { files = JSON.parse(fs.readFileSync(filesFile, 'utf8')); } catch(e) {}
    
    const validFiles = files.filter(f => {
        if (!f.path) return false;
        const safePath = f.path.replace(/^\/uploads\//, '').replace(/\.\.\//g, '');
        const absolutePath = f.path.includes('/minutas/') 
            ? path.join(minutasUploadDir, path.basename(f.path))
            : path.join(uploadDir, safePath);
        return fs.existsSync(absolutePath);
    });

    if (validFiles.length !== files.length) {
        fs.writeFileSync(filesFile, JSON.stringify(validFiles, null, 2), 'utf8');
    }
    res.json({ success: true, files: validFiles });
});

app.get('/api/file', (req, res) => {
    const requestedPath = req.query.path;
    const solicitante = req.query.userId;
    if (!requestedPath) return res.status(404).send('Archivo no especificado');
    
    const esAdmin = solicitante && solicitante.toLowerCase() === 'coordinador.uipc';
    if (!esAdmin && solicitante && !requestedPath.includes(`/${solicitante.toLowerCase().replace(/[^a-z0-9_.-]/g, '_')}/`) && !requestedPath.includes('/minutas/')) {
        return res.status(403).send('Acceso denegado: Este documento es confidencial.');
    }

    if (requestedPath.includes('/minutas/')) {
        const fileName = path.basename(requestedPath);
        const absolutePath = path.join(minutasUploadDir, fileName);
        if (fs.existsSync(absolutePath)) return res.sendFile(absolutePath);
    }

    const safePath = requestedPath.replace(/^\/uploads\//, '').replace(/\.\.\//g, ''); 
    const absolutePath = path.join(uploadDir, safePath);

    if (fs.existsSync(absolutePath)) res.sendFile(absolutePath);
    else res.status(404).send('Archivo no encontrado en el servidor.');
});

// MODULO RED FORMATO
app.post('/api/upload/red', uploadRED.any(), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No se recibió ningún archivo.' });
        }
        res.json({ success: true, message: 'Formato RED guardado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
    }
});

app.get('/api/list/red', (req, res) => {
    fs.readdir(rutaRedFormato, (err, files) => {
        if (err) return res.json({ success: true, files: [] });
        const archivos = files
            .filter(f => f.toUpperCase().includes('RED') && f.endsWith('.html'))
            .map(f => ({ filename: f }));
        res.json({ success: true, files: archivos });
    });
});

app.get('/api/file/red', (req, res) => {
    const fileName = req.query.name;
    if (!fileName) return res.status(400).send('Archivo no especificado');
    const filePath = path.join(rutaRedFormato, fileName);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Archivo no encontrado.');
});

// API FRAPC
app.get('/api/frapcs', (req, res) => {
    if (!fs.existsSync(frapcUploadDir)) {
        fs.mkdirSync(frapcUploadDir, { recursive: true });
    }

    fs.readdir(frapcUploadDir, (err, files) => {
        if (err) {
            console.error("Error al leer la carpeta frapc:", err);
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
                    fecha: stats.mtime.toLocaleString('es-MX'),
                    url: `/uploads/frapc/${file}`
                };
            });

        res.json({ frapcs: listaFrapcs });
    });
});

// SUBIDA FRAPC
app.post('/api/upload-frapc', upload.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo.' });
    
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const hoyStr = new Date().toLocaleDateString();
    const horaStr = new Date().toLocaleTimeString();
    
    const tempPath = req.file.path;
    const targetPath = path.join(frapcUploadDir, req.file.originalname);
    if (tempPath !== targetPath) fs.renameSync(tempPath, targetPath);

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

// SUBIDA GENERAL Y PROCESO DE ESCANEOS
app.post('/api/upload', upload.single('pdfFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se adjuntó archivo.' });
    
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const hoyStr = new Date().toLocaleDateString();
    const horaStr = new Date().toLocaleTimeString();
    
    const isMinuta = (req.headers['x-target-folder'] === 'Minutas') || 
                     (req.body && req.body.tipoCarpeta === 'Minutas') ||
                     (req.file.originalname.toLowerCase().includes('min'));

    let finalPath = '';
    const rawUser = req.query.userId || (req.body ? req.body.usuario : 'general');
    const userIdClean = String(rawUser).toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

    if (isMinuta) {
        finalPath = `/uploads/minutas/${req.file.originalname}`;
        const tempPath = req.file.path;
        const targetPath = path.join(minutasUploadDir, req.file.originalname);
        if (tempPath !== targetPath) {
            fs.copyFileSync(tempPath, targetPath);
            try { fs.unlinkSync(tempPath); } catch(e) {}
        }
    } else {
        const userFolder = path.join(uploadDir, userIdClean);
        if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
        
        const tempPath = req.file.path;
        const targetPath = path.join(userFolder, req.file.originalname);
        if (tempPath !== targetPath) {
            if (fs.existsSync(targetPath)) {
                try { fs.unlinkSync(targetPath); } catch (err) {}
            }
            fs.renameSync(tempPath, targetPath);
        }

        finalPath = `/uploads/${userIdClean}/${req.file.originalname}`;
    }

    // OCR EN SEGUNDO PLANO
    const absolutePdfPath = path.join(__dirname, finalPath.replace(/^\//, ''));
    if (fs.existsSync(absolutePdfPath) && req.file.originalname.toLowerCase().endsWith('.pdf') && !isMinuta) {
        const baseDir = path.dirname(absolutePdfPath);
        const fileNameNoExt = path.basename(req.file.originalname, '.pdf');
        const imgPrefix = path.join(baseDir, `${fileNameNoExt}_page`);
        const txtOutput = path.join(baseDir, `${fileNameNoExt}_ocr`);
        const csvOutput = path.join(baseDir, `${fileNameNoExt}_sanitizado.csv`);

        (async () => {
            try {
                await execPromise(`pdftoppm -png -r 200 "${absolutePdfPath}" "${imgPrefix}"`);
                
                const page1Img = `${imgPrefix}-1.png`;
                if (fs.existsSync(page1Img)) {
                    await execPromise(`tesseract "${page1Img}" "${txtOutput}" -l spa`);
                    const ocrTxtPath = `${txtOutput}.txt`;

                    if (fs.existsSync(ocrTxtPath)) {
                        const rawText = fs.readFileSync(ocrTxtPath, 'utf8');
                        const lineas = rawText.split('\n');

                        let csvContent = 'Num,Nombre,Apellido Paterno,Apellido Materno,Brigada,Piso,Sector,Escalera,Punto de Reunión\n';

                        lineas.forEach(linea => {
                            const l = linea.trim();
                            if (/^\d+\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(l)) {
                                const partes = l.split(/\s+/);
                                const partesLimpias = partes.filter(p => !p.includes('@') && !/^\d{5,10}$/.test(p));
                                csvContent += partesLimpias.join(',') + '\n';
                            }
                        });

                        fs.writeFileSync(csvOutput, csvContent, 'utf8');
                        try {
                            if (fs.existsSync(page1Img)) fs.unlinkSync(page1Img);
                            if (fs.existsSync(ocrTxtPath)) fs.unlinkSync(ocrTxtPath);
                        } catch (e) {}
                    }
                }
            } catch (ocrErr) {
                console.log(`[Aviso OCR] Archivo guardado de forma segura.`);
            }
        })();
    }

    const newFile = {
        filename: req.file.originalname,
        path: finalPath,
        usuario: isMinuta ? 'Área de Comunicación' : rawUser,
        fecha: `${hoyStr} ${horaStr}`,
        comentarios: req.body.comentarios || 'Documento institucional procesado'
    };
    
    files = files.filter(f => f.filename !== req.file.originalname);
    files.push(newFile);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    res.json({ success: true, file: newFile });
});

// BORRADO DE ARCHIVOS
app.post('/api/delete-file', (req, res) => {
    const { filename } = req.body;
    let files = JSON.parse(fs.readFileSync(filesFile, 'utf8'));
    const fileToDelete = files.find(f => f.filename === filename);
    if (!fileToDelete) return res.status(404).json({ success: false });

    files = files.filter(f => f.filename !== filename);
    fs.writeFileSync(filesFile, JSON.stringify(files, null, 2));
    
    let absolutePath = '';
    if (fileToDelete.path && fileToDelete.path.includes('/minutas/')) {
        absolutePath = path.join(minutasUploadDir, filename);
    } else {
        const safePath = fileToDelete.path.replace(/^\/uploads\//, '').replace(/\.\.\//g, ''); 
        absolutePath = path.join(uploadDir, safePath);
    }

    if (fs.existsSync(absolutePath)) {
        try { fs.unlinkSync(absolutePath); } catch (e) {}
    }

    const csvPath = absolutePath.replace(/\.pdf$/i, '_sanitizado.csv');
    if (fs.existsSync(csvPath)) {
        try { fs.unlinkSync(csvPath); } catch (e) {}
    }

    res.json({ success: true });
});

// AGENDA Y EVENTOS
const obtenerAgendaAlDia = () => {
    const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
    let data = { fecha_creacion: hoy, lista: [] };
    
    if (fs.existsSync(eventosFile)) {
        try {
            const archivoGuardado = JSON.parse(fs.readFileSync(eventosFile, 'utf8'));
            if (archivoGuardado.fecha_creacion === hoy) {
                data = archivoGuardado;
            } else {
                fs.writeFileSync(eventosFile, JSON.stringify(data, null, 2), 'utf8');
            }
        } catch (e) {}
    } else {
        fs.writeFileSync(eventosFile, JSON.stringify(data, null, 2), 'utf8');
    }
    return data;
};

app.get('/api/eventos', (req, res) => {
    try {
        const data = obtenerAgendaAlDia();
        res.json({ success: true, eventos: data.lista });
    } catch (error) {
        res.status(500).json({ success: false, eventos: [] });
    }
});

app.post('/api/eventos/lote', (req, res) => {
    const nuevosEventos = req.body.eventos;
    if (!nuevosEventos || !Array.isArray(nuevosEventos) || nuevosEventos.length === 0) {
        return res.status(400).json({ success: false, error: 'No se recibieron eventos válidos.' });
    }

    try {
        const data = obtenerAgendaAlDia();
        const horaActual = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

        nuevosEventos.forEach(evento => {
            const id = Date.now() + Math.random();
            const horaReg = evento.hora_registro || horaActual;
            const textoCompleto = `
${evento.Sede || 'No especificada'}
Fecha: ${evento.fecha || 'No especificada'}
Horario: ${evento.horario || 'No especificado'}
Asistentes: ${evento['total de asistentes'] || 'No especificados'}
Tema: ${evento['tema del evento'] || 'No especificado'}
UR: ${evento['UR responsable'] || 'No especificada'}
`.trim();
            
            data.lista.push({ id, texto_completo: textoCompleto, hora_registro: horaReg });
        });

        fs.writeFileSync(eventosFile, JSON.stringify(data, null, 2), 'utf8');
        res.status(200).json({ success: true, mensaje: 'Eventos guardados exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
});

app.post('/api/eventos/rapido', (req, res) => {
    try {
        const { contenido_whatsapp } = req.body;
        if (!contenido_whatsapp) return res.status(400).json({ success: false, message: 'El texto está vacío' });

        const data = obtenerAgendaAlDia();
        const horaActual = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
        const bloquesCrudos = contenido_whatsapp.split(/(?=\[.*?\]\s*[^:]+:\s*)/g);
        let eventosAgregados = 0;

        bloquesCrudos.forEach(bloque => {
            const tekstLimpio = bloque.trim();
            if (tekstLimpio.length > 10) {
                data.lista.push({ id: Date.now() + Math.random(), texto_completo: tekstLimpio, hora_registro: horaActual });
                eventosAgregados++;
            }
        });

        if (eventosAgregados === 0) {
            data.lista.push({ id: Date.now(), texto_completo: contenido_whatsapp.trim(), hora_registro: horaActual });
        }

        fs.writeFileSync(eventosFile, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, message: 'Eventos analizados correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

app.post('/api/eventos/borrar', (req, res) => {
    try {
        const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
        const data = { fecha_creacion: hoy, lista: [] };
        fs.writeFileSync(eventosFile, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, message: 'Agenda borrada correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al limpiar el muro' });
    }
});

// INICIO DEL SERVIDOR
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Maestro UIPC operando en http://localhost:${PORT}`);
});