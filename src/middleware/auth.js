const jwt = require('jsonwebtoken');
const pool = require('../config/mysql');

module.exports = async function(req, res, next) {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'Sem token, autorização negada' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar se o usuário ainda existe no banco
        const connection = await pool.getConnection();
        try {
            const [users] = await connection.execute(
                'SELECT id, is_admin FROM usuarios WHERE id = ?',
                [decoded.user.id]
            );

            if (users.length === 0) {
                return res.status(401).json({ msg: 'Token inválido' });
            }

            req.user = {
                id: users[0].id,
                isAdmin: users[0].is_admin
            };
            next();
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Token verification error:', err);
        res.status(401).json({ msg: 'Token inválido' });
    }
}; 