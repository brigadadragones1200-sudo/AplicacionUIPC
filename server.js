const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Rutas de archivos JSON de base de datos
const dbFile = path.join(__dirname, 'usuarios.json');
const pobFile = path.join(__dirname, 'poblacion.json');
const eventosFile = path.join(__dirname, 'eventos.json');

// Middleware para parsing de peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la raíz
app.use(express.static(__dirname));

// Inicializar archivos JSON si no existen
if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]', 'utf8');

// RUTA INICIAL Y LOGIN
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'loginuipc.html')));
app.get('/dashboard_mobile.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard_mobile.html')));

// API AUTENTICACIÓN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    try {
        if (!fs.existsSync(dbFile)) {
            return res.status(401).json({ success: false, message: 'Base de datos no encontrada.' });
        }
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

// API CONTROL DE POBLACIÓN (poblacion.json)
app.get('/api/poblacion', (req, res) => {
    try {
        if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]', 'utf8');
        const records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
        res.json({ success: true, records });
    } catch (e) {
        res.status(500).json({ success: false, records: [], message: 'Error al leer la población.' });
    }
});

app.post('/api/poblacion/save', (req, res) => {
    const { usuario, nombre, ur, nivel, cantidad, observaciones, fecha } = req.body;
    let records = [];
    try {
        if (fs.existsSync(pobFile)) records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    } catch (e) {}

    const newRecord = { 
        id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
        usuario, nombre, ur, nivel, 
        cantidad: Number(cantidad) || 0, 
        observaciones: observaciones || '', 
        fecha: fecha || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) 
    };

    records.push(newRecord);
    try {
        fs.writeFileSync(pobFile, JSON.stringify(records, null, 2), 'utf8');
        res.json({ success: true, record: newRecord });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al guardar registro.' });
    }
});

app.post('/api/poblacion/delete', (req, res) => {
    const { id, adminUser } = req.body;
    if (adminUser !== 'coordinador.uipc') {
        return res.status(403).json({ success: false, message: 'Acceso denegado.' });
    }

    let records = [];
    try {
        if (fs.existsSync(pobFile)) records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    } catch (e) {}

    const initialLength = records.length;
    records = records.filter(r => String(r.id) !== String(id));

    if (records.length < initialLength) {
        fs.writeFileSync(pobFile, JSON.stringify(records, null, 2), 'utf8');
        res.json({ success: true, message: 'Registro eliminado.' });
    } else {
        res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    }
});

// API AGENDA Y EVENTOS (eventos.json)

// Función auxiliar para mantener o inicializar la estructura al día
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

// 1. Obtener eventos del día
app.get('/api/eventos', (req, res) => {
    try {
        const data = obtenerAgendaAlDia();
        res.json({ success: true, eventos: data.lista });
    } catch (error) {
        res.status(500).json({ success: false, eventos: [] });
    }
});

// 2. Guardar lote de eventos estructurados
app.post('/api/eventos/lote', (req, res) => {
    const nuevosEventos = req.body.eventos;
    if (!nuevosEventos || !Array.isArray(nuevosEventos) || nuevosEventos.length === 0) {
        return res.status(400).json({ success: false, error: 'Sin eventos válidos.' });
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
        res.status(500).json({ success: false, error: 'Error al guardar los eventos.' });
    }
});

// 3. Captura rápida desde el cuadro de texto (ej. Mensajes de WhatsApp)
app.post('/api/eventos/rapido', (req, res) => {
    try {
        const { contenido_whatsapp } = req.body;
        if (!contenido_whatsapp) return res.status(400).json({ success: false, message: 'El texto está vacío.' });

        const data = obtenerAgendaAlDia();
        const horaActual = new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_