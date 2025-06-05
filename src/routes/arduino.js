const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
    vincularArduino, 
    getStatus, 
    getLeituras,
    irrigar,
    parar,
    desconectar,
    getUltimoEstado,
    toggleSistemaAutomatico,
    processarHeartbeat,
    getDispositivosUsuario
} = require('../controllers/arduinoController');

const {
    addSensorData,
    getSensorData,
    getAggregatedData
} = require('../controllers/sensorController');

// Rotas de dispositivos
router.get('/dispositivos', auth, getDispositivosUsuario);

// Rotas de configuração do Arduino
router.post('/vincular', auth, vincularArduino);
router.get('/status', auth, getStatus);
router.get('/leituras', auth, getLeituras);
router.post('/irrigar', auth, irrigar);
router.post('/parar', auth, parar);
router.post('/desconectar', auth, desconectar);
router.get('/ultimo-estado', auth, getUltimoEstado);
router.post('/automatico', auth, toggleSistemaAutomatico);

// Rotas para sensores
router.post('/sensores', auth, addSensorData);
router.get('/sensores', auth, getSensorData);
router.get('/sensores/agregados', auth, getAggregatedData);

// Rota de heartbeat para o Arduino (sem autenticação)
router.post('/api/arduino/heartbeat', async (req, res) => {
    try {
        console.log('Heartbeat recebido:', req.body);
        const resultado = await processarHeartbeat(req.body);
        
        if (resultado) {
            res.json({ 
                status: 'ok',
                userId: resultado.userId
            });
        } else {
            res.status(404).json({ 
                status: 'error',
                message: 'Dispositivo não vinculado'
            });
        }
    } catch (error) {
        console.error('Erro no heartbeat:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Erro interno no servidor'
        });
    }
});

module.exports = router; 