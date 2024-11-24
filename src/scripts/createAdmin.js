const bcrypt = require('bcryptjs');
const pool = require('../config/mysql');

async function createAdmin() {
    try {
        // Senha que você quer usar para o admin
        const senhaAdmin = 'admin123';
        
        // Gerar hash da senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senhaAdmin, salt);

        const connection = await pool.getConnection();

        try {
            // Verificar se já existe um admin
            const [existingAdmin] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                ['admin@greensystem.com']
            );

            if (existingAdmin.length > 0) {
                console.log('Administrador já existe!');
                return;
            }

            // Inserir novo admin
            await connection.execute(`
                INSERT INTO users (
                    nomeCompleto,
                    email,
                    senha,
                    telefone,
                    tipoTelhado,
                    cep,
                    rua,
                    numero,
                    bairro,
                    cidade,
                    estado,
                    isAdmin
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'Administrador',
                'admin@greensystem.com',
                senhaHash,
                '11999999999',
                'intensivo',
                '01001000',
                'Praça da Sé',
                'S/N',
                'Sé',
                'São Paulo',
                'SP',
                true
            ]);

            console.log('Administrador criado com sucesso!');
            console.log('Email: admin@greensystem.com');
            console.log('Senha:', senhaAdmin);

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Erro ao criar administrador:', error);
    } finally {
        process.exit();
    }
}

createAdmin(); 