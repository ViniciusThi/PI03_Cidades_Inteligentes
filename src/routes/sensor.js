const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { addSensorData, getSensorData } = require('../controllers/sensorController');

router.post('/', auth, addSensorData);
router.get('/', auth, getSensorData);

module.exports = router; 