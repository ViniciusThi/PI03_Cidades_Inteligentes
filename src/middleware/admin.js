const pool = require('../config/mysql');

module.exports = async function(req, res, next) {
    try {
        const connection = await pool.getConnection();
        
        try {
            const [user] = await connection.execute(
                'SELECT is_admin FROM usuarios WHERE id = ?',
                [req.user.id]
            );

            if (user.length === 0 || !user[0].is_admin) {
                return res.status(403).json({ msg: 'Acesso negado' });
            }

            next();
        } finally {
            connection.release();
        }
    } catch (err) {
        res.status(500).json({ msg: 'Erro no servidor' });
    }
}; 