const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { getClientes, getClienteById } = require('../controllers/adminController');
const { 
    getUsers, 
    getUserById, 
    updateUser, 
    deleteUser 
} = require('../controllers/userController');

const {
    getAllDevices,
    vincularDispositivoUsuario
} = require('../controllers/arduinoController');

// Middleware para verificar se o usuário é admin
const checkAdmin = [auth, admin];

// Rotas protegidas por autenticação e middleware de admin
router.get('/clientes', checkAdmin, getClientes);
router.get('/cliente/:id', checkAdmin, getClienteById);

// Rotas de usuários
router.get('/users', checkAdmin, getUsers);
router.get('/users/:id', checkAdmin, getUserById);
router.put('/users/:id', checkAdmin, updateUser);
router.delete('/users/:id', checkAdmin, deleteUser);

// Rotas de dispositivos
router.get('/dispositivos', checkAdmin, getAllDevices);
router.post('/dispositivos/vincular', checkAdmin, vincularDispositivoUsuario);

module.exports = router; 