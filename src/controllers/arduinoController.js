const pool = require('../config/mysql');
const axios = require('axios');
const RelayState = require('../models/RelayState');
const Programacao = require('../models/Programacao');

exports.vincularArduino = async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            // Inserir ou atualizar configuração do Arduino
            await connection.execute(
                `INSERT INTO arduino_config (usuario_id, ip, porta, ultimo_status) 
                 VALUES (?, ?, ?, 'online')
                 ON DUPLICATE KEY UPDATE 
                 ip = VALUES(ip), 
                 porta = VALUES(porta),
                 ultimo_status = 'online'`,
                [req.user.id, '192.168.185.208', '80']
            );

            res.json({ msg: 'Arduino vinculado com sucesso' });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao vincular Arduino:', err);
        res.status(500).json({ msg: 'Erro ao vincular Arduino' });
    }
};

exports.getStatus = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            // Atualizado de 'users' para 'usuarios'
            const [user] = await connection.execute(
                'SELECT ac.ip as arduinoIp, ac.porta as arduinoPort ' +
                'FROM usuarios u ' +
                'LEFT JOIN arduino_config ac ON u.id = ac.usuario_id ' +
                'WHERE u.id = ?',
                [req.user.id]
            );

            // Verificar se o usuário tem um Arduino vinculado
            const vinculado = Boolean(user[0]?.arduinoIp && user[0]?.arduinoPort);

            // Buscar último estado no MongoDB
            const ultimoEstado = await RelayState.findOne(
                { userId: req.user.id.toString() },
                {},
                { sort: { timestamp: -1 } }
            );

            res.json({
                vinculado,
                status: ultimoEstado ? ultimoEstado.status : 'desconectado',
                irrigando: ultimoEstado ? ultimoEstado.estado : false,
                automatico: ultimoEstado ? ultimoEstado.sistemaAutomatico : false
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao buscar status:', err);
        res.status(500).json({ msg: 'Erro ao buscar status do Arduino' });
    }
};

exports.getLeituras = async (req, res) => {
    try {
        // Buscar último estado do relé
        const ultimoEstado = await RelayState.findOne(
            { userId: req.user.id.toString() },
            {},
            { sort: { timestamp: -1 } }
        );

        // Se não encontrar estado, retorna valores padrão
        if (!ultimoEstado) {
            return res.json({
                estado: false,
                status: 'desconectado',
                timestamp: new Date()
            });
        }

        // Retorna o estado atual
        res.json({
            estado: ultimoEstado.estado,
            status: ultimoEstado.status,
            timestamp: ultimoEstado.timestamp
        });

    } catch (err) {
        console.error('Erro ao buscar leituras:', err);
        res.status(500).json({ msg: 'Erro ao buscar leituras' });
    }
};

exports.irrigar = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            const [user] = await connection.execute(
                'SELECT arduinoIp, arduinoPort FROM users WHERE id = ?',
                [req.user.id]
            );

            if (!user[0].arduinoIp) {
                return res.status(400).json({ msg: 'Arduino não vinculado' });
            }

            const arduinoUrl = `http://${user[0].arduinoIp}:${user[0].arduinoPort}/irrigar`;
            const response = await axios.post(arduinoUrl);
            
            // Salvar estado no MongoDB
            await this.salvarEstadoRele(req.user.id, true);
            
            res.json(response.data);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao iniciar irrigação:', err);
        res.status(500).json({ msg: 'Erro ao iniciar irrigação' });
    }
};

exports.parar = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            const [user] = await connection.execute(
                'SELECT arduinoIp, arduinoPort FROM users WHERE id = ?',
                [req.user.id]
            );

            if (!user[0].arduinoIp) {
                return res.status(400).json({ msg: 'Arduino não vinculado' });
            }

            const arduinoUrl = `http://${user[0].arduinoIp}:${user[0].arduinoPort}/parar`;
            const response = await axios.post(arduinoUrl);
            
            // Salvar estado no MongoDB
            await this.salvarEstadoRele(req.user.id, false);
            
            res.json(response.data);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao parar irrigação:', err);
        res.status(500).json({ msg: 'Erro ao parar irrigação' });
    }
};

exports.desconectar = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            await connection.execute(
                'UPDATE users SET arduinoIp = NULL, arduinoPort = NULL WHERE id = ?',
                [req.user.id]
            );

            res.json({ msg: 'Arduino desvinculado com sucesso' });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao desvincular Arduino:', err);
        res.status(500).json({ msg: 'Erro ao desvincular Arduino' });
    }
};

exports.salvarEstadoRele = async (userId, estado) => {
    try {
        const novoEstado = new RelayState({
            userId: userId.toString(),
            estado: estado
        });
        await novoEstado.save();
    } catch (err) {
        console.error('Erro ao salvar estado do relé:', err);
    }
};

exports.getUltimoEstado = async (req, res) => {
    try {
        const ultimoEstado = await RelayState.findOne(
            { userId: req.user.id.toString() },
            {},
            { sort: { timestamp: -1 } }
        );

        res.json({
            estado: ultimoEstado ? ultimoEstado.estado : false,
            sistemaAutomatico: ultimoEstado ? ultimoEstado.sistemaAutomatico : false
        });
    } catch (err) {
        console.error('Erro ao buscar estado do relé:', err);
        res.status(500).json({ msg: 'Erro ao buscar estado' });
    }
};

exports.atualizarStatus = async (req, res) => {
    try {
        const { status, estado } = req.body;
        const novoEstado = new RelayState({
            userId: req.user.id.toString(),
            estado: estado,
            status: status // 'desconectado', 'online' ou 'irrigando'
        });
        await novoEstado.save();
        res.json({ msg: 'Status atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar status:', err);
        res.status(500).json({ msg: 'Erro ao atualizar status' });
    }
};

exports.verificarTimers = async () => {
    try {
        const agora = new Date();
        const diaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][agora.getDay()];
        const horaAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

        console.log(`Verificando timers para ${diaSemana} às ${horaAtual}`);

        // Buscar todas as programações ativas para o dia e hora atual
        const programacoesAtivas = await Programacao.find({
            diaSemana: diaSemana,
            horario: horaAtual,
            ativo: true
        });

        console.log(`Encontradas ${programacoesAtivas.length} programações ativas`);

        // Para cada programação ativa
        for (const prog of programacoesAtivas) {
            try {
                // Verificar se o sistema está ativo (switch ligado)
                const ultimoEstado = await RelayState.findOne(
                    { userId: prog.userId },
                    {},
                    { sort: { timestamp: -1 } }
                );

                if (ultimoEstado && ultimoEstado.sistemaAutomatico) {
                    console.log(`Sistema automático ativo para usuário ${prog.userId}`);
                    
                    // Buscar dados do Arduino do usuário
                    const connection = await pool.getConnection();
                    const [user] = await connection.execute(
                        'SELECT arduinoIp, arduinoPort FROM users WHERE id = ?',
                        [prog.userId]
                    );
                    connection.release();

                    if (user[0].arduinoIp) {
                        console.log(`Iniciando irrigação programada para usuário ${prog.userId}`);
                        
                        // Ativar irrigação
                        await axios.post(`http://${user[0].arduinoIp}:${user[0].arduinoPort}/irrigar`);
                        
                        // Registrar estado
                        await new RelayState({
                            userId: prog.userId,
                            estado: true,
                            sistemaAutomatico: true,
                            status: 'irrigando'
                        }).save();

                        // Agendar parada após 40 segundos
                        setTimeout(async () => {
                            try {
                                console.log(`Parando irrigação programada para usuário ${prog.userId}`);
                                
                                await axios.post(`http://${user[0].arduinoIp}:${user[0].arduinoPort}/parar`);
                                await new RelayState({
                                    userId: prog.userId,
                                    estado: false,
                                    sistemaAutomatico: true,
                                    status: 'online'
                                }).save();
                            } catch (error) {
                                console.error('Erro ao parar irrigação:', error);
                            }
                        }, 40000); // 40 segundos
                    }
                } else {
                    console.log(`Sistema automático desativado para usuário ${prog.userId}`);
                }
            } catch (error) {
                console.error(`Erro ao processar timer para usuário ${prog.userId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erro ao verificar timers:', error);
    }
};

// Adicionar rota para atualizar estado do sistema automático
exports.toggleSistemaAutomatico = async (req, res) => {
    try {
        const { ativo } = req.body;
        
        await new RelayState({
            userId: req.user.id.toString(),
            estado: false,
            sistemaAutomatico: ativo,
            status: 'online'
        }).save();

        res.json({ msg: 'Estado do sistema automático atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar sistema automático:', err);
        res.status(500).json({ msg: 'Erro ao atualizar sistema automático' });
    }
}; 