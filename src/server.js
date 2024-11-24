const express = require('express');
const connectDB = require('./config/database');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Conectar ao MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Definir rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/programacao', require('./routes/programacao'));
app.use('/api/admin', require('./routes/admin'));
app.use('/arduino', require('./routes/arduino')); // Adicionar rota do Arduino

// Importar a função verificarTimers
const { verificarTimers } = require('./controllers/arduinoController');

// Agendar verificação dos timers a cada minuto
setInterval(verificarTimers, 60000);

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});