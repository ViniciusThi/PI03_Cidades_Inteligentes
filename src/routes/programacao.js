const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getProgramacao, 
  addProgramacao, 
  updateProgramacao,
  deleteProgramacao,
  carregarProgramacoesPadrao
} = require('../controllers/programacaoController');

router.get('/', auth, getProgramacao);
router.post('/', auth, addProgramacao);
router.put('/:id', auth, updateProgramacao);
router.delete('/:id', auth, deleteProgramacao);

module.exports = router; 