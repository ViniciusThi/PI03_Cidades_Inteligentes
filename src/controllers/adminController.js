const pool = require('../config/mysql');
const RelayState = require('../models/RelayState');

exports.getClientes = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            // Ajustando a query para garantir que todos os campos sejam selecionados corretamente
            const [clientes] = await connection.execute(`
                SELECT 
                    u.id,
                    u.nome_completo,
                    u.email,
                    u.telefone,
                    u.created_at,
                    tt.nome as tipo_telhado,
                    e.cep,
                    e.rua,
                    e.numero,
                    b.nome as bairro,
                    c.nome as cidade,
                    est.id as estado,
                    est.nome as estado_nome,
                    ac.ip as arduino_ip,
                    ac.ultimo_status as arduino_status,
                    ac.ultima_conexao
                FROM usuarios u 
                INNER JOIN tipos_telhado tt ON u.tipo_telhado_id = tt.id
                INNER JOIN enderecos e ON u.endereco_id = e.id
                INNER JOIN bairros b ON e.bairro_id = b.id
                INNER JOIN cidades c ON b.cidade_id = c.id
                INNER JOIN estados est ON c.estado_id = est.id
                LEFT JOIN arduino_config ac ON u.id = ac.usuario_id
                WHERE u.is_admin = 0
                ORDER BY u.nome_completo
            `);

            console.log('Dados brutos dos clientes:', clientes); // Debug

            // Buscar status atual de cada cliente
            const clientesComStatus = await Promise.all(clientes.map(async (cliente) => {
                // Buscar último estado do MongoDB
                const ultimoEstado = await RelayState.findOne(
                    { userId: cliente.id.toString() },
                    {},
                    { sort: { timestamp: -1 } }
                );

                // Garantir que os campos não sejam undefined
                const enderecoCompleto = `${cliente.rua || ''}, ${cliente.numero || ''} - ${cliente.cidade || ''}/${cliente.estado_nome || ''}`;

                return {
                    id: cliente.id,
                    nomeCompleto: cliente.nome_completo || 'Nome não informado',
                    email: cliente.email || '',
                    telefone: cliente.telefone || '',
                    tipoTelhado: cliente.tipo_telhado || 'Não informado',
                    endereco: {
                        rua: cliente.rua || '',
                        numero: cliente.numero || '',
                        bairro: cliente.bairro || '',
                        cidade: cliente.cidade || '',
                        estado: cliente.estado_nome || '',
                        cep: cliente.cep || ''
                    },
                    enderecoCompleto,
                    ultimaAtividade: ultimoEstado ? ultimoEstado.timestamp : cliente.created_at,
                    sistemaAtivo: Boolean(cliente.arduino_ip),
                    status: ultimoEstado ? ultimoEstado.status : 'desconectado',
                    equipamentoConectado: Boolean(cliente.arduino_ip),
                    arduino: {
                        ip: cliente.arduino_ip || null,
                        status: cliente.arduino_status || 'desconectado',
                        ultimaConexao: cliente.ultima_conexao || null
                    }
                };
            }));

            console.log('Dados processados dos clientes:', clientesComStatus); // Debug
            res.json(clientesComStatus);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        res.status(500).json({ 
            msg: 'Erro no servidor',
            error: err.message
        });
    }
};

exports.getClienteById = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            const [cliente] = await connection.execute(`
                SELECT 
                    u.id,
                    u.nome_completo,
                    u.email,
                    u.telefone,
                    u.created_at,
                    tt.nome as tipo_telhado,
                    e.cep,
                    e.rua,
                    e.numero,
                    b.nome as bairro,
                    c.nome as cidade,
                    est.id as estado,
                    ac.ip as arduino_ip,
                    ac.ultimo_status as arduino_status,
                    ac.ultima_conexao
                FROM usuarios u 
                LEFT JOIN tipos_telhado tt ON u.tipo_telhado_id = tt.id
                LEFT JOIN enderecos e ON u.endereco_id = e.id
                LEFT JOIN bairros b ON e.bairro_id = b.id
                LEFT JOIN cidades c ON b.cidade_id = c.id
                LEFT JOIN estados est ON c.estado_id = est.id
                LEFT JOIN arduino_config ac ON u.id = ac.usuario_id
                WHERE u.id = ? AND u.is_admin = 0
            `, [req.params.id]);

            if (cliente.length === 0) {
                return res.status(404).json({ msg: 'Cliente não encontrado' });
            }

            // Buscar dados do sensor do MongoDB
            const ultimoEstado = await RelayState.findOne(
                { userId: req.params.id.toString() },
                {},
                { sort: { timestamp: -1 } }
            );

            const clienteCompleto = {
                ...cliente[0],
                ultimaAtividade: ultimoEstado ? ultimoEstado.timestamp : cliente[0].created_at,
                sistemaAtivo: Boolean(cliente[0].arduino_ip),
                enderecoCompleto: `${cliente[0].rua}, ${cliente[0].numero}, ${cliente[0].cidade}/${cliente[0].estado}`,
                dadosSensor: ultimoEstado ? {
                    umidadeSolo: ultimoEstado.umidadeSolo,
                    consumoAgua: ultimoEstado.consumoAgua,
                    consumoEnergia: ultimoEstado.consumoEnergia,
                    timestamp: ultimoEstado.timestamp
                } : null
            };

            res.json(clienteCompleto);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao buscar cliente:', err);
        res.status(500).send('Erro no servidor');
    }
}; 