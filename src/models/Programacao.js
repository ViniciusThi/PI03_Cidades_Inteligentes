const mongoose = require('mongoose');

const programacaoSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    nomeUsuario: {
        type: String,
        required: true
    },
    tipoTelhado: {
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
    },
    dataCriacao: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Programacao', programacaoSchema); 