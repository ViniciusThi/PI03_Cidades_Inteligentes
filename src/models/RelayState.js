const mongoose = require('mongoose');

const relayStateSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    estado: {
        type: Boolean,
        required: true,
        default: false
    },
    sistemaAutomatico: {
        type: Boolean,
        required: true,
        default: false
    },
    status: {
        type: String,
        enum: ['desconectado', 'online', 'irrigando'],
        default: 'desconectado'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('RelayState', relayStateSchema); 