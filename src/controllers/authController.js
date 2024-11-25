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

        console.log('Dados recebidos:', { 
            nomeCompleto, 
            email, 
            telefone, 
            tipoTelhado, 
            cep, 
            numero 
        });

        const connection = await pool.getConnection();

        try {
            // Verificar se usuário já existe
            const [existingUser] = await connection.execute(
                'SELECT id FROM usuarios WHERE email = ?',
                [email]
            );

            if (existingUser.length > 0) {
                return res.status(400).json({ msg: 'Usuário já existe' });
            }

            // Buscar dados do CEP
            const cepFormatado = cep.replace(/\D/g, '');
            console.log('CEP formatado:', cepFormatado);

            const enderecoResponse = await axios.get(`https://viacep.com.br/ws/${cepFormatado}/json/`);
            console.log('Resposta ViaCEP:', enderecoResponse.data);
            
            if (enderecoResponse.data.erro) {
                return res.status(400).json({ msg: 'CEP inválido' });
            }

            const endereco = enderecoResponse.data;

            // Iniciar transação
            await connection.beginTransaction();
            console.log('Transação iniciada');

            try {
                // 1. Inserir ou buscar estado
                const [estadoResult] = await connection.execute(
                    'INSERT IGNORE INTO estados (id, nome) VALUES (?, ?)',
                    [endereco.uf, endereco.uf]
                );
                console.log('Estado inserido/encontrado');

                // 2. Inserir ou buscar cidade
                let cidadeId;
                const [cidadeExistente] = await connection.execute(
                    'SELECT id FROM cidades WHERE estado_id = ? AND nome = ?',
                    [endereco.uf, endereco.localidade]
                );

                if (cidadeExistente.length > 0) {
                    cidadeId = cidadeExistente[0].id;
                } else {
                    const [cidadeResult] = await connection.execute(
                        'INSERT INTO cidades (estado_id, nome) VALUES (?, ?)',
                        [endereco.uf, endereco.localidade]
                    );
                    cidadeId = cidadeResult.insertId;
                }
                console.log('Cidade ID:', cidadeId);

                // 3. Inserir ou buscar bairro
                let bairroId;
                const [bairroExistente] = await connection.execute(
                    'SELECT id FROM bairros WHERE cidade_id = ? AND nome = ?',
                    [cidadeId, endereco.bairro]
                );

                if (bairroExistente.length > 0) {
                    bairroId = bairroExistente[0].id;
                } else {
                    const [bairroResult] = await connection.execute(
                        'INSERT INTO bairros (cidade_id, nome) VALUES (?, ?)',
                        [cidadeId, endereco.bairro]
                    );
                    bairroId = bairroResult.insertId;
                }
                console.log('Bairro ID:', bairroId);

                // 4. Inserir endereço
                const [enderecoResult] = await connection.execute(
                    'INSERT INTO enderecos (cep, rua, numero, bairro_id) VALUES (?, ?, ?, ?)',
                    [cepFormatado, endereco.logradouro, numero, bairroId]
                );
                const enderecoId = enderecoResult.insertId;
                console.log('Endereço ID:', enderecoId);

                // 5. Buscar ID do tipo de telhado
                console.log('Buscando tipo de telhado:', tipoTelhado.toLowerCase());
                const [tipoTelhadoResult] = await connection.execute(
                    'SELECT id, nome FROM tipos_telhado WHERE nome = ?',
                    [tipoTelhado.toLowerCase()]
                );

                console.log('Resultado da busca do tipo de telhado:', tipoTelhadoResult);

                if (tipoTelhadoResult.length === 0) {
                    // Verificar todos os tipos disponíveis para debug
                    const [todosTipos] = await connection.execute('SELECT * FROM tipos_telhado');
                    console.log('Tipos de telhado disponíveis:', todosTipos);
                    
                    await connection.rollback();
                    return res.status(400).json({ 
                        msg: 'Tipo de telhado inválido',
                        tipoInformado: tipoTelhado,
                        tiposDisponiveis: todosTipos.map(t => t.nome)
                    });
                }

                console.log('Tipo Telhado ID:', tipoTelhadoResult[0].id);

                // Hash da senha
                const salt = await bcrypt.genSalt(10);
                const senhaHash = await bcrypt.hash(senha, salt);

                // 6. Inserir usuário
                const [userResult] = await connection.execute(
                    `INSERT INTO usuarios (
                        nome_completo, email, senha, telefone,
                        endereco_id, tipo_telhado_id
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        nomeCompleto,
                        email,
                        senhaHash,
                        telefone,
                        enderecoId,
                        tipoTelhadoResult[0].id
                    ]
                );
                console.log('Usuário inserido com ID:', userResult.insertId);

                // Commit da transação
                await connection.commit();
                console.log('Transação commitada com sucesso');

                const token = jwt.sign(
                    { user: { id: userResult.insertId } },
                    process.env.JWT_SECRET,
                    { expiresIn: '5h' }
                );

                res.json({ token });

            } catch (err) {
                console.error('Erro durante a transação:', err);
                await connection.rollback();
                throw err;
            }

        } catch (err) {
            console.error('Erro no registro:', err);
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro geral:', err);
        res.status(500).json({ 
            msg: 'Erro no servidor', 
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        console.log('Tentativa de login:', { email });

        const connection = await pool.getConnection();

        try {
            const [users] = await connection.execute(
                `SELECT 
                    u.id, 
                    u.email, 
                    u.senha, 
                    u.is_admin,
                    u.nome_completo
                FROM usuarios u 
                WHERE u.email = ?`,
                [email]
            );

            console.log('Usuário encontrado:', users[0]);

            if (users.length === 0) {
                return res.status(400).json({ msg: 'Credenciais inválidas' });
            }

            const user = users[0];
            const isMatch = await bcrypt.compare(senha, user.senha);

            if (!isMatch) {
                return res.status(400).json({ msg: 'Credenciais inválidas' });
            }

            // Converter is_admin para booleano explicitamente
            const isAdmin = Boolean(user.is_admin);
            console.log('Status admin:', isAdmin);

            const token = jwt.sign(
                { 
                    user: { 
                        id: user.id,
                        isAdmin: isAdmin
                    } 
                },
                process.env.JWT_SECRET,
                { expiresIn: '5h' }
            );

            // Enviar resposta
            res.json({ 
                token,
                isAdmin: isAdmin,
                msg: 'Login successful'
            });

        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
}; 