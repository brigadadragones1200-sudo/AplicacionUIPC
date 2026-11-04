const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

// Ruta de prueba básica para verificar que el servidor responde
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'loginuipc.html'));
});

// Iniciar servidor usando estrictamente el puerto dinámico de la plataforma
app.listen(PORT, () => {
    console.log(`Servidor operando en el puerto ${PORT}`);
});