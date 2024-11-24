const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { getClientes, getClienteById } = require('../controllers/adminController');

// Rotas protegidas por autenticação e middleware de admin
router.get('/clientes', [auth, admin], getClientes);
router.get('/cliente/:id', [auth, admin], getClienteById);

module.exports = router; 