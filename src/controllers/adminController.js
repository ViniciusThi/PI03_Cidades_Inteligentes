const pool = require('../config/mysql');
const RelayState = require('../models/RelayState');

exports.getClientes = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            // Buscar todos os usuários não-admin
            const [clientes] = await connection.execute(`
                SELECT 
                    id,
                    nomeCompleto,
                    email,
                    telefone,
                    tipoTelhado,
                    cep,
                    rua,
                    numero,
                    bairro,
                    cidade,
                    estado,
                    arduinoIp,
                    created_at
                FROM users 
                WHERE isAdmin = 0
                ORDER BY nomeCompleto
            `);

            // Buscar status atual de cada cliente
            const clientesComStatus = await Promise.all(clientes.map(async (cliente) => {
                // Buscar último estado do MongoDB
                const ultimoEstado = await RelayState.findOne(
                    { userId: cliente.id.toString() },
                    {},
                    { sort: { timestamp: -1 } }
                );

                const enderecoCompleto = `${cliente.rua}, ${cliente.numero}, ${cliente.cidade}, ${cliente.estado}`;

                return {
                    ...cliente,
                    ultimaAtividade: ultimoEstado ? ultimoEstado.timestamp : cliente.created_at,
                    sistemaAtivo: cliente.arduinoIp ? true : false, // Se tem IP do Arduino, está vinculado
                    status: ultimoEstado ? ultimoEstado.status : 'desconectado',
                    enderecoCompleto,
                    equipamentoConectado: Boolean(cliente.arduinoIp)
                };
            }));

            res.json(clientesComStatus);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        res.status(500).send('Erro no servidor');
    }
};

exports.getClienteById = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            const [cliente] = await connection.execute(`
                SELECT 
                    id,
                    nomeCompleto,
                    email,
                    telefone,
                    tipoTelhado,
                    cep,
                    rua,
                    numero,
                    bairro,
                    cidade,
                    estado,
                    created_at
                FROM users 
                WHERE id = ? AND isAdmin = 0
            `, [req.params.id]);

            if (cliente.length === 0) {
                return res.status(404).json({ msg: 'Cliente não encontrado' });
            }

            const ultimoSensor = await SensorData.findOne(
                { userId: req.params.id.toString() },
                {},
                { sort: { timestamp: -1 } }
            );

            const clienteCompleto = {
                ...cliente[0],
                ultimaAtividade: ultimoSensor ? ultimoSensor.timestamp : cliente[0].created_at,
                sistemaAtivo: ultimoSensor ? 
                    (new Date(ultimoSensor.timestamp) > new Date(Date.now() - 3600000)) : 
                    false,
                enderecoCompleto: `${cliente[0].rua}, ${cliente[0].numero}, ${cliente[0].cidade}, ${cliente[0].estado}`,
                dadosSensor: ultimoSensor ? {
                    umidadeSolo: ultimoSensor.umidadeSolo,
                    consumoAgua: ultimoSensor.consumoAgua,
                    consumoEnergia: ultimoSensor.consumoEnergia,
                    timestamp: ultimoSensor.timestamp
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