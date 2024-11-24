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
    toggleSistemaAutomatico
} = require('../controllers/arduinoController');

router.post('/vincular', auth, vincularArduino);
router.get('/status', auth, getStatus);
router.get('/leituras', auth, getLeituras);
router.post('/irrigar', auth, irrigar);
router.post('/parar', auth, parar);
router.post('/desconectar', auth, desconectar);
router.get('/estado', auth, getUltimoEstado);
router.post('/sistema-automatico', auth, toggleSistemaAutomatico);

module.exports = router; 