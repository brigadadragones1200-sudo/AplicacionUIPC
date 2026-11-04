const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Rutas de archivos JSON de base de datos
const dbFile = path.join(__dirname, 'usuarios.json');
const pobFile = path.join(__dirname, 'poblacion.json');

// Middleware para parsing de peticiones
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la raíz
app.use(express.static(__dirname));

// Inicializar poblacion.json si no existe
if (!fs.existsSync(pobFile)) {
    fs.writeFileSync(pobFile, '[]', 'utf8');
}

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

// 1. Obtener todos los registros de población
app.get('/api/poblacion', (req, res) => {
    try {
        if (!fs.existsSync(pobFile)) fs.writeFileSync(pobFile, '[]', 'utf8');
        const records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
        res.json({ success: true, records });
    } catch (e) {
        res.status(500).json({ success: false, records: [], message: 'Error al leer los registros de población.' });
    }
});

// 2. Guardar nuevo registro de población
app.post('/api/poblacion/save', (req, res) => {
    const { usuario, nombre, ur, nivel, cantidad, observaciones, fecha } = req.body;
    let records = [];
    
    try {
        if (fs.existsSync(pobFile)) {
            records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
        }
    } catch (e) {
        records = [];
    }

    const newRecord = { 
        id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
        usuario, 
        nombre, 
        ur, 
        nivel, 
        cantidad: Number(cantidad) || 0, 
        observaciones: observaciones || '', 
        fecha: fecha || new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) 
    };

    records.push(newRecord);

    try {
        fs.writeFileSync(pobFile, JSON.stringify(records, null, 2), 'utf8');
        res.json({ success: true, record: newRecord });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Error al guardar el registro en el servidor.' });
    }
});

// 3. Eliminar registro de población (Exclusivo para el Coordinador Operativo)
app.post('/api/poblacion/delete', (req, res) => {
    const { id, adminUser } = req.body;
    if (adminUser !== 'coordinador.uipc') {
        return res.status(403).json({ success: false, message: 'Acceso denegado: Solo el Coordinador puede eliminar registros.' });
    }

    let records = [];
    try {
        if (fs.existsSync(pobFile)) records = JSON.parse(fs.readFileSync(pobFile, 'utf8'));
    } catch (e) {}

    const initialLength = records.length;
    records = records.filter(r => String(r.id) !== String(id));

    if (records.length < initialLength) {
        fs.writeFileSync(pobFile, JSON.stringify(records, null, 2), 'utf8');
        res.json({ success: true, message: 'Registro eliminado correctamente.' });
    } else {
        res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    }
});

// Iniciar servidor usando el puerto dinámico de Phusion Passenger
app.listen(PORT, () => {
    console.log(`Servidor UIPC corriendo exitosamente en el puerto ${PORT}`);
});