const express = require('express');
const connectDB = require('./config/database');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
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

// Criar servidor HTTP
const server = http.createServer(app);

// Configurar servidor WebSocket
const wss = new WebSocket.Server({ 
    server, 
    path: '/ws' 
});

// Armazenar conexões ativas
const clients = new Map();
const arduinoClients = new Map();

// Gerenciar conexões WebSocket
wss.on('connection', (ws, req) => {
    const pathname = url.parse(req.url).pathname;
    
    if (pathname === '/ws/arduino') {
        handleArduinoConnection(ws, req);
    } else {
        handleClientConnection(ws, req);
    }
});

// Gerenciar conexões de clientes (navegadores)
function handleClientConnection(ws, req) {
    console.log('Novo cliente conectado');
    
    // Extrair token de autenticação dos parâmetros da URL (se houver)
    const parameters = new URLSearchParams(url.parse(req.url).query);
    const token = parameters.get('token');
    
    // Armazenar a conexão do cliente
    const clientId = Date.now();
    clients.set(clientId, { ws, userId: null, token });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Mensagem recebida do cliente:', data);
            
            // Processar autenticação
            if (data.type === 'auth' && data.token) {
                const client = clients.get(clientId);
                if (client) {
                    client.token = data.token;
                    client.userId = data.userId;
                    console.log(`Cliente ${clientId} autenticado como usuário ${data.userId}`);
                }
            }
            
            // Processar comandos
            if (data.type === 'comando' && data.deviceMac) {
                const arduino = Array.from(arduinoClients.values())
                    .find(client => client.mac === data.deviceMac);
                
                if (arduino) {
                    console.log(`Enviando comando para Arduino ${data.deviceMac}`);
                    arduino.ws.send(JSON.stringify(data));
                } else {
                    console.log(`Arduino ${data.deviceMac} não encontrado`);
                    
                    // Enviar mensagem de erro para o cliente
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Dispositivo offline'
                    }));
                }
            }
        } catch (error) {
            console.error('Erro ao processar mensagem do cliente:', error);
        }
    });
    
    ws.on('close', () => {
        console.log(`Cliente ${clientId} desconectado`);
        clients.delete(clientId);
    });
}

// Gerenciar conexões de Arduino
function handleArduinoConnection(ws, req) {
    console.log('Novo Arduino conectado');
    
    const arduinoId = Date.now();
    arduinoClients.set(arduinoId, { ws, mac: null, userId: null });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Mensagem recebida do Arduino:', data);
            
            // Processar informações do dispositivo
            if (data.type === 'info' && data.mac) {
                const arduino = arduinoClients.get(arduinoId);
                if (arduino) {
                    arduino.mac = data.mac;
                    console.log(`Arduino ${arduinoId} identificado com MAC ${data.mac}`);
                    
                    // Buscar usuário associado a este MAC
                    // Esta lógica deve ser implementada com base no seu modelo de dados
                    // por enquanto, apenas confirmamos o recebimento
                    ws.send(JSON.stringify({
                        type: 'config',
                        status: 'connected'
                    }));
                }
            }
            
            // Processar dados dos sensores
            if (data.type === 'sensor_data' && data.mac) {
                console.log(`Recebidos dados dos sensores do Arduino ${data.mac}`);
                
                // Salvar dados no banco de dados através do controlador
                const { salvarDadosSensores } = require('./controllers/sensorController');
                
                // Chamar a função de forma assíncrona, mas não aguardar
                salvarDadosSensores(data)
                    .then(() => console.log('Dados dos sensores salvos com sucesso'))
                    .catch(err => console.error('Erro ao salvar dados dos sensores:', err));
                
                // Encaminhar dados para todos os clientes interessados
                broadcastSensorData(data);
            }
            
            // Processar mudanças de estado
            if (data.type === 'estado' && data.mac) {
                console.log(`Recebida atualização de estado do Arduino ${data.mac}`);
                
                // Encaminhar estado para todos os clientes interessados
                broadcastArduinoState(data);
            }
        } catch (error) {
            console.error('Erro ao processar mensagem do Arduino:', error);
        }
    });
    
    ws.on('close', () => {
        const arduino = arduinoClients.get(arduinoId);
        console.log(`Arduino ${arduino?.mac || arduinoId} desconectado`);
        
        // Notificar clientes sobre a desconexão
        if (arduino && arduino.mac) {
            broadcastArduinoState({
                type: 'estado',
                mac: arduino.mac,
                status: 'offline'
            });
        }
        
        arduinoClients.delete(arduinoId);
    });
}

// Função para enviar dados dos sensores para clientes interessados
function broadcastSensorData(data) {
    clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            // Aqui você pode adicionar lógica para enviar apenas para clientes
            // que estão interessados neste dispositivo específico
            client.ws.send(JSON.stringify({
                type: 'sensor_update',
                data: data
            }));
        }
    });
}

// Função para enviar atualizações de estado para clientes interessados
function broadcastArduinoState(data) {
    clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            // Aqui você pode adicionar lógica para enviar apenas para clientes
            // que estão interessados neste dispositivo específico
            client.ws.send(JSON.stringify({
                type: 'state_update',
                data: data
            }));
        }
    });
}

// Exportar o objeto WebSocket para uso em outros módulos
global.wss = wss;
global.clients = clients;
global.arduinoClients = arduinoClients;
global.broadcastSensorData = broadcastSensorData;
global.broadcastArduinoState = broadcastArduinoState;

// Importar a função verificarTimers
const { verificarTimers } = require('./controllers/arduinoController');

// Agendar verificação dos timers a cada minuto
setInterval(verificarTimers, 60000);

// Iniciar servidor
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`WebSocket disponível em ws://localhost:${PORT}/ws`);
});