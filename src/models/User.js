const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nomeCompleto: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  telefone: {
    type: String,
    required: true
  },
  senha: {
    type: String,
    required: true
  },
  tipoTelhado: {
    type: String,
    enum: ['intensivo', 'semiintensivo', 'extensivo'],
    required: true
  },
  arduinoVinculado: {
    ip: String,
    port: String,
    isVinculado: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema); 