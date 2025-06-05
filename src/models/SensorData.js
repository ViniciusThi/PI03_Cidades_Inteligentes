const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    deviceMac: {
        type: String,
        required: true
    },
    temperatura: {
        type: Number,
        required: true
    },
    umidade: {
        type: Number,
        required: true
    },
    umidadeSolo: {
        type: Number,
        required: true
    },
    irrigacaoAtiva: {
        type: Boolean,
        default: false
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

// Índice para melhorar performance de consultas por usuário e tempo
sensorDataSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('SensorData', sensorDataSchema); 