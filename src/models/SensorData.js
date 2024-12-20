const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    umidadeSolo: {
        type: Number,
        required: true
    },
    consumoAgua: {
        type: Number,
        default: 0
    },
    consumoEnergia: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SensorData', sensorDataSchema); 