const express = require('express');
const connectDB = require('./config/database');
const cors = require('cors');
const fetch = require('node-fetch');
const http = require('http');
const socketIo = require('socket.io');
const User = require('./models/User');
const SensorData = require('./models/SensorData');
const auth = require('./middleware/auth');
const userRoutes = require('./routes/user');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

global.io = io;

// Conectar ao banco de dados
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Novo cliente conectado');
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sensor', require('./routes/sensor'));
app.use('/api/programacao', require('./routes/programacao'));
app.use('/api/user', userRoutes);

// Rotas do Arduino
app.post('/arduino/vincular', auth, async (req, res) => {
    try {
        const { ip, port } = req.body;
        const user = await User.findById(req.user.id);
        
        // Testar conexão com o Arduino antes de vincular
        try {
            console.log(`Tentando conectar ao Arduino em http://${ip}:${port}/status`);
            
            const testResponse = await fetch(`http://${ip}:${port}/status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            if (!testResponse.ok) {
                throw new Error('Não foi possível conectar ao Arduino');
            }

            const testData = await testResponse.json();
            console.log('Resposta do Arduino:', testData);

            if (!testData.status || testData.status !== 'online') {
                throw new Error('Arduino não respondeu corretamente');
            }

            // Se chegou aqui, a conexão foi bem sucedida
            user.arduinoVinculado = {
                ip,
                port,
                isVinculado: true
            };
            await user.save();
            
            res.json({ 
                message: 'Arduino vinculado com sucesso', 
                status: 'online',
                arduinoConfig: user.arduinoVinculado
            });
        } catch (error) {
            console.error('Erro ao testar conexão:', error);
            res.status(400).json({ 
                error: 'Não foi possível conectar ao Arduino',
                details: error.message
            });
        }
    } catch (error) {
        console.error('Erro ao vincular Arduino:', error);
        res.status(500).json({ 
            error: 'Erro ao vincular Arduino',
            details: error.message
        });
    }
});

app.post('/arduino/desvincular', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Enviar comando de desconexão para o Arduino antes de desvincular
        if (user.arduinoVinculado.isVinculado) {
            try {
                await fetch(`http://${user.arduinoVinculado.ip}:${user.arduinoVinculado.port}/desconectar`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Erro ao enviar comando de desconexão:', error);
            }
        }

        user.arduinoVinculado = {
            ip: null,
            port: null,
            isVinculado: false
        };
        await user.save();

        res.json({ message: 'Arduino desvinculado com sucesso' });
    } catch (error) {
        console.error('Erro ao desvincular Arduino:', error);
        res.status(500).json({ error: 'Erro ao desvincular Arduino' });
    }
});

// Middleware para verificar Arduino vinculado
const verificarArduino = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.arduinoVinculado.isVinculado) {
            return res.status(400).json({ error: 'Arduino não vinculado' });
        }
        req.arduinoConfig = user.arduinoVinculado;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar Arduino' });
    }
};

// Rotas que requerem Arduino vinculado
app.get('/arduino/status', auth, verificarArduino, async (req, res) => {
    try {
        const response = await fetch(`http://${req.arduinoConfig.ip}:${req.arduinoConfig.port}/status`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao verificar status do Arduino:', error);
        res.status(500).json({ error: 'Erro ao verificar status do Arduino' });
    }
});

app.get('/arduino/leituras', auth, verificarArduino, async (req, res) => {
    try {
        const response = await fetch(`http://${req.arduinoConfig.ip}:${req.arduinoConfig.port}/leituras`);
        const data = await response.json();
        
        // Salvar dados no banco
        const sensorData = new SensorData({
            userId: req.user.id,
            umidadeSolo: data.umidade,
            consumoAgua: data.consumoAgua || 0,
            consumoEnergia: data.consumoEnergia || 0
        });
        await sensorData.save();
        
        // Emitir dados via Socket.IO
        io.emit('sensorUpdate', {
            userId: req.user.id,
            data: sensorData
        });
        
        res.json(data);
    } catch (error) {
        console.error('Erro ao obter leituras do Arduino:', error);
        res.status(500).json({ error: 'Erro ao obter leituras do Arduino' });
    }
});

app.post('/arduino/irrigar', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.arduinoVinculado.isVinculado) {
            return res.status(400).json({ error: 'Arduino não vinculado' });
        }

        const response = await fetch(`http://${user.arduinoVinculado.ip}:${user.arduinoVinculado.port}/irrigar`, {
            method: 'POST'
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao iniciar irrigação:', error);
        res.status(500).json({ error: 'Erro ao iniciar irrigação' });
    }
});

app.post('/arduino/parar', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.arduinoVinculado.isVinculado) {
            return res.status(400).json({ error: 'Arduino não vinculado' });
        }

        const response = await fetch(`http://${user.arduinoVinculado.ip}:${user.arduinoVinculado.port}/parar`, {
            method: 'POST'
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao parar irrigação:', error);
        res.status(500).json({ error: 'Erro ao parar irrigação' });
    }
});

const { verificarTimers } = require('./controllers/programacaoController');

// Adicionar após a configuração das rotas
// Verificar timers a cada minuto
setInterval(verificarTimers, 60000);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));