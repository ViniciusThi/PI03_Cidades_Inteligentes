const mongoose = require('mongoose');

const timerPadraoSchema = new mongoose.Schema({
    tipoTelhado: {
        type: String,
        required: true,
        enum: ['intensivo', 'semiintensivo', 'extensivo']
    },
    horarios: [{
        diaSemana: String,
        hora: String,
        duracao: {
            type: Number,
            default: 5 // duração em minutos
        }
    }]
});

module.exports = mongoose.model('TimerPadrao', timerPadraoSchema); 