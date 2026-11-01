const express = require('express');
const path = require('path');
const app = express();

// Permite que Express sirva automáticamente todos los archivos estáticos (HTML, CSS, JS) 
// directamente desde la carpeta actual (public_html)
app.use(express.static(__dirname));

// Ruta de diagnóstico para verificar que el servidor está respondiendo al instante
app.get('/test-vivo', (req, res) => {
    res.send('¡El servidor Node.js está respondiendo correctamente en la ruta /test-vivo!');
});

// Ruta opcional para la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Puerto asignado automáticamente por el entorno de alojamiento o 3000 por defecto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});