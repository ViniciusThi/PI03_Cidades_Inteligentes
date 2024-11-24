const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/mysql');
const axios = require('axios');

exports.register = async (req, res) => {
    try {
        const { 
            nomeCompleto, 
            email, 
            telefone, 
            senha, 
            tipoTelhado,
            cep,
            numero
        } = req.body;

        const connection = await pool.getConnection();

        try {
            // Verificar se usuário já existe
            const [existingUser] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUser.length > 0) {
                connection.release();
                return res.status(400).json({ msg: 'Usuário já existe' });
            }

            // Buscar dados do CEP
            const cepFormatado = cep.replace(/\D/g, '');
            const enderecoResponse = await axios.get(`https://viacep.com.br/ws/${cepFormatado}/json/`);
            
            if (enderecoResponse.data.erro) {
                connection.release();
                return res.status(400).json({ msg: 'CEP inválido' });
            }

            const endereco = enderecoResponse.data;

            // Hash da senha
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(senha, salt);

            // Inserir usuário
            const [result] = await connection.execute(
                `INSERT INTO users (
                    nomeCompleto, email, senha, telefone, tipoTelhado,
                    cep, rua, numero, bairro, cidade, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nomeCompleto,
                    email,
                    senhaHash,
                    telefone,
                    tipoTelhado,
                    cep,
                    endereco.logradouro,
                    numero,
                    endereco.bairro,
                    endereco.localidade,
                    endereco.uf
                ]
            );

            const token = jwt.sign(
                { user: { id: result.insertId } },
                process.env.JWT_SECRET,
                { expiresIn: '5h' }
            );

            res.json({ token });

        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
};

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        const connection = await pool.getConnection();

        try {
            const [users] = await connection.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                return res.status(400).json({ msg: 'Credenciais inválidas' });
            }

            const user = users[0];
            const isMatch = await bcrypt.compare(senha, user.senha);

            if (!isMatch) {
                return res.status(400).json({ msg: 'Credenciais inválidas' });
            }

            const token = jwt.sign(
                { 
                    user: { 
                        id: user.id,
                        isAdmin: user.isAdmin
                    } 
                },
                process.env.JWT_SECRET,
                { expiresIn: '5h' }
            );

            res.json({ 
                token,
                isAdmin: Boolean(user.isAdmin)
            });

        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
}; 