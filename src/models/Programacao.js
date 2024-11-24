const mongoose = require('mongoose');

const programacaoSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    diaSemana: {
        type: String,
        required: true
    },
    horario: {
        type: String,
        required: true
    },
    ativo: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Programacao', programacaoSchema); 