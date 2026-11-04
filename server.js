const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Archivo de base de datos de usuarios
const dbFile = path.join(__dirname, 'usuarios.json');

// Middleware para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

// Ruta inicial (Login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'loginuipc.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'loginuipc.html'));
});

// API DE AUTENTICACIÓN (Lee usuarios.json de forma segura)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    try {
        if (!fs.existsSync(dbFile)) {
            return res.status(401).json({ success: false, message: 'Base de datos de usuarios no encontrada.' });
        }

        const usersData = fs.readFileSync(dbFile, 'utf8');
        const users = JSON.parse(usersData);

        // Busca el usuario comparando nombre y contraseña (soporta claves 'password' o 'contrasena')
        const found = users.find(u => u.usuario === username && (u.password === password || u.contrasena === password));

        if (found) {
            res.json({ success: true, user: found });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error interno en el servidor al procesar el acceso.' });
    }
});

// Iniciar servidor usando estrictamente el puerto dinámico de la plataforma
app.listen(PORT, () => {
    console.log(`Servidor operando en el puerto ${PORT}`);
});