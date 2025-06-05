const express = require('express');
const router = express.Router();
const { register, login, renewToken } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/renew-token', auth, renewToken);

module.exports = router; 