const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Rutas de archivos JSON base
const dbFile = path.join(__dirname, 'usuarios.json');
const pobFile = path.join(__dirname, 'poblacion.json');
const eventosFile = path.join(__dirname, 'eventos.json');

// Middlewares esenciales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Verificar y crear archivos JSON si no existen para evitar bloqueos
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]', 'utf8');
if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]', 'utf8');

// Vistas y Rutas principales
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/dashboard_mobile.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard_mobile.html')));

// 1. API DE AUTENTICACIÓN
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

// 2. API DE POBLACIÓN
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

// 3. API DE EVENTOS Y AGENDA
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

// Iniciar servidor usando estrictamente el puerto dinámico
app.listen(PORT, () => {
    console.log(`Servidor UIPC operando en el puerto ${PORT}`);
});