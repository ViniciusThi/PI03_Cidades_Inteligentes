const pool = require('../config/mysql');
const axios = require('axios');
const RelayState = require('../models/RelayState');
const Programacao = require('../models/Programacao');
const SensorData = require('../models/SensorData');

exports.vincularArduino = async (req, res) => {
    try {
        const { ip, porta, mac } = req.body;

        if (!ip || !porta) {
            return res.status(400).json({ msg: 'IP e porta são obrigatórios' });
        }

        // Testar conexão antes de vincular
        try {
            const response = await axios.get(`http://${ip}:${porta}/status`, {
                timeout: 5000 // timeout de 5 segundos
            });

            if (!response.data) {
                throw new Error('Arduino não respondeu corretamente');
            }
        } catch (error) {
            console.error('Erro ao testar conexão:', error);
            return res.status(400).json({ 
                msg: 'Não foi possível conectar ao Arduino. Verifique o IP e porta.'
            });
        }

        const connection = await pool.getConnection();

        try {
            // Verificar se a tabela possui a coluna mac_address
            const [columns] = await connection.execute(
                "SHOW COLUMNS FROM arduino_config LIKE 'mac_address'"
            );
            
            // Se a coluna não existir, adicioná-la
            if (columns.length === 0) {
                await connection.execute(
                    "ALTER TABLE arduino_config ADD COLUMN mac_address VARCHAR(20) NULL AFTER porta, ADD COLUMN last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                );
                console.log("Coluna mac_address adicionada à tabela arduino_config");
            }

            // Inserir ou atualizar configuração do Arduino
            await connection.execute(
                `INSERT INTO arduino_config (usuario_id, ip, porta, mac_address, ultimo_status) 
                 VALUES (?, ?, ?, ?, 'online')
                 ON DUPLICATE KEY UPDATE 
                 ip = VALUES(ip), 
                 porta = VALUES(porta),
                 mac_address = VALUES(mac_address),
                 ultimo_status = 'online'`,
                [req.user.id, ip, porta, mac || null]
            );

            res.json({ 
                msg: 'Arduino vinculado com sucesso',
                status: 'online'
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao vincular Arduino:', err);
        res.status(500).json({ 
            msg: 'Erro ao vincular Arduino',
            error: err.message 
        });
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
                'SELECT ac.ip, ac.porta FROM usuarios u ' +
                'JOIN arduino_config ac ON u.id = ac.usuario_id ' +
                'WHERE u.id = ?',
                [req.user.id]
            );

            if (!user[0]?.ip) {
                return res.status(400).json({ msg: 'Arduino não vinculado' });
            }

            const arduinoUrl = `http://${user[0].ip}:${user[0].porta}/irrigar`;
            
            try {
                const response = await axios.post(arduinoUrl);
                
                // Salvar estado no MongoDB
                await new RelayState({
                    userId: req.user.id.toString(),
                    estado: true,
                    status: 'irrigando'
                }).save();
                
                res.json({ msg: 'Irrigação iniciada com sucesso' });
            } catch (error) {
                console.error('Erro ao comunicar com Arduino:', error);
                res.status(500).json({ msg: 'Erro ao comunicar com Arduino' });
            }
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
                'SELECT ac.ip, ac.porta FROM usuarios u ' +
                'JOIN arduino_config ac ON u.id = ac.usuario_id ' +
                'WHERE u.id = ?',
                [req.user.id]
            );

            if (!user[0]?.ip) {
                return res.status(400).json({ msg: 'Arduino não vinculado' });
            }

            const arduinoUrl = `http://${user[0].ip}:${user[0].porta}/parar`;
            
            try {
                const response = await axios.post(arduinoUrl);
                
                // Salvar estado no MongoDB
                await new RelayState({
                    userId: req.user.id.toString(),
                    estado: false,
                    status: 'online'
                }).save();
                
                res.json({ msg: 'Irrigação parada com sucesso' });
            } catch (error) {
                console.error('Erro ao comunicar com Arduino:', error);
                res.status(500).json({ msg: 'Erro ao comunicar com Arduino' });
            }
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

// Função para atualizar o estado com dados do heartbeat
exports.processarHeartbeat = async (data) => {
    try {
        // Buscar usuário associado ao MAC
        const connection = await pool.getConnection();
        let userId = null;
        
        try {
            // Verificar se a tabela possui a coluna mac_address
            const [columns] = await connection.execute(
                "SHOW COLUMNS FROM arduino_config LIKE 'mac_address'"
            );
            
            // Se a coluna não existir, adicioná-la
            if (columns.length === 0) {
                await connection.execute(
                    "ALTER TABLE arduino_config ADD COLUMN mac_address VARCHAR(20) NULL AFTER porta, ADD COLUMN last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                );
                console.log("Coluna mac_address adicionada à tabela arduino_config");
            }
            
            // Buscar por MAC address
            if (data.mac) {
                const [rows] = await connection.execute(
                    'SELECT usuario_id FROM arduino_config WHERE mac_address = ?',
                    [data.mac]
                );
                
                if (rows.length > 0) {
                    userId = rows[0].usuario_id;
                }
            }
            
            // Se não encontrou por MAC, buscar por IP
            if (!userId && data.ip) {
                const [rows] = await connection.execute(
                    'SELECT usuario_id FROM arduino_config WHERE ip = ?',
                    [data.ip]
                );
                
                if (rows.length > 0) {
                    userId = rows[0].usuario_id;
                    
                    // Atualizar o MAC se não estiver definido
                    if (data.mac) {
                        await connection.execute(
                            'UPDATE arduino_config SET mac_address = ? WHERE usuario_id = ?',
                            [data.mac, userId]
                        );
                    }
                }
            }
        } finally {
            connection.release();
        }
        
        if (!userId) {
            console.log('Nenhum usuário encontrado para o dispositivo');
            return null;
        }
        
        // Salvar dados dos sensores
        if (data.temperatura !== undefined && data.umidade !== undefined && data.umidadeSolo !== undefined) {
            const sensorData = new SensorData({
                userId: userId.toString(),
                deviceMac: data.mac || 'unknown',
                temperatura: data.temperatura,
                umidade: data.umidade,
                umidadeSolo: data.umidadeSolo,
                irrigacaoAtiva: data.irrigacao || false
            });
            
            await sensorData.save();
            
            // Enviar dados em tempo real para os clientes
            if (global.broadcastSensorData) {
                global.broadcastSensorData({
                    type: 'sensor_data',
                    mac: data.mac || 'unknown',
                    temperatura: data.temperatura,
                    umidade: data.umidade,
                    umidadeSolo: data.umidadeSolo,
                    irrigacaoAtiva: data.irrigacao || false,
                    automatico: data.automatico || false,
                    userId: userId.toString()
                });
            }
        }
        
        // Atualizar estado do relé
        const ultimoEstado = await RelayState.findOne(
            { userId: userId.toString() },
            {},
            { sort: { timestamp: -1 } }
        );
        
        if (!ultimoEstado || 
            ultimoEstado.estado !== (data.irrigacao || false) || 
            ultimoEstado.sistemaAutomatico !== (data.automatico || false)) {
            
            const novoEstado = new RelayState({
                userId: userId.toString(),
                estado: data.irrigacao || false,
                sistemaAutomatico: data.automatico || false,
                status: (data.irrigacao || false) ? 'irrigando' : 'online'
            });
            
            await novoEstado.save();
            
            // Notificar clientes da mudança de estado
            if (global.broadcastArduinoState) {
                global.broadcastArduinoState({
                    type: 'estado',
                    mac: data.mac || 'unknown',
                    irrigacaoAtiva: data.irrigacao || false,
                    automatico: data.automatico || false,
                    status: (data.irrigacao || false) ? 'irrigando' : 'online',
                    userId: userId.toString()
                });
            }
        }
        
        return {
            userId: userId.toString(),
            mac: data.mac,
            status: 'online'
        };
    } catch (err) {
        console.error('Erro ao processar heartbeat:', err);
        throw err;
    }
};

// Buscar todos os dispositivos (para administradores)
exports.getAllDevices = async (req, res) => {
    try {
        // Verificar se o usuário é administrador
        if (!req.user.isAdmin) {
            return res.status(403).json({ msg: 'Acesso negado. Função exclusiva para administradores.' });
        }

        const connection = await pool.getConnection();
        
        try {
            const [devices] = await connection.execute(
                `SELECT ac.id, ac.usuario_id, u.nome, ac.ip, ac.porta, ac.mac_address, ac.ultimo_status, ac.last_update
                 FROM arduino_config ac
                 JOIN usuarios u ON ac.usuario_id = u.id
                 ORDER BY ac.last_update DESC`
            );
            
            // Para cada dispositivo, buscar o último estado
            const devicesWithStatus = await Promise.all(devices.map(async (device) => {
                const ultimoEstado = await RelayState.findOne(
                    { userId: device.usuario_id.toString() },
                    {},
                    { sort: { timestamp: -1 } }
                );
                
                return {
                    ...device,
                    estado: ultimoEstado ? ultimoEstado.estado : false,
                    sistemaAutomatico: ultimoEstado ? ultimoEstado.sistemaAutomatico : false,
                    status: ultimoEstado ? ultimoEstado.status : 'desconectado',
                    ultimaAtualizacao: ultimoEstado ? ultimoEstado.timestamp : null
                };
            }));
            
            res.json(devicesWithStatus);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao buscar dispositivos:', err);
        res.status(500).json({ msg: 'Erro ao buscar dispositivos' });
    }
};

// Vincular dispositivo a outro usuário (para administradores)
exports.vincularDispositivoUsuario = async (req, res) => {
    try {
        // Verificar se o usuário é administrador
        if (!req.user.isAdmin) {
            return res.status(403).json({ msg: 'Acesso negado. Função exclusiva para administradores.' });
        }
        
        const { deviceId, userId } = req.body;
        
        if (!deviceId || !userId) {
            return res.status(400).json({ msg: 'ID do dispositivo e ID do usuário são obrigatórios' });
        }
        
        const connection = await pool.getConnection();
        
        try {
            // Verificar se o usuário existe
            const [user] = await connection.execute(
                'SELECT id, nome FROM usuarios WHERE id = ?',
                [userId]
            );
            
            if (user.length === 0) {
                return res.status(404).json({ msg: 'Usuário não encontrado' });
            }
            
            // Verificar se o dispositivo existe
            const [device] = await connection.execute(
                'SELECT id, ip, porta, mac_address FROM arduino_config WHERE id = ?',
                [deviceId]
            );
            
            if (device.length === 0) {
                return res.status(404).json({ msg: 'Dispositivo não encontrado' });
            }
            
            // Vincular o dispositivo ao novo usuário
            await connection.execute(
                'UPDATE arduino_config SET usuario_id = ? WHERE id = ?',
                [userId, deviceId]
            );
            
            res.json({ 
                msg: `Dispositivo vinculado com sucesso ao usuário ${user[0].nome}`,
                usuario: {
                    id: user[0].id,
                    nome: user[0].nome
                },
                dispositivo: {
                    id: device[0].id,
                    ip: device[0].ip,
                    porta: device[0].porta,
                    mac: device[0].mac_address
                }
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao vincular dispositivo:', err);
        res.status(500).json({ msg: 'Erro ao vincular dispositivo' });
    }
};

// Obter lista de dispositivos vinculados a um usuário
exports.getDispositivosUsuario = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const connection = await pool.getConnection();
        
        try {
            const [devices] = await connection.execute(
                `SELECT id, ip, porta, mac_address, ultimo_status, last_update
                 FROM arduino_config
                 WHERE usuario_id = ?
                 ORDER BY last_update DESC`,
                [userId]
            );
            
            // Para cada dispositivo, buscar o último estado
            const devicesWithStatus = await Promise.all(devices.map(async (device) => {
                const ultimoEstado = await RelayState.findOne(
                    { userId: userId.toString() },
                    {},
                    { sort: { timestamp: -1 } }
                );
                
                // Verificar se o dispositivo está online (ativo nos últimos 5 minutos)
                const cincoMinutosAtras = new Date();
                cincoMinutosAtras.setMinutes(cincoMinutosAtras.getMinutes() - 5);
                
                const isOnline = device.last_update && new Date(device.last_update) > cincoMinutosAtras;
                
                return {
                    ...device,
                    estado: ultimoEstado ? ultimoEstado.estado : false,
                    sistemaAutomatico: ultimoEstado ? ultimoEstado.sistemaAutomatico : false,
                    status: isOnline ? (ultimoEstado ? ultimoEstado.status : 'online') : 'desconectado',
                    ultimaAtualizacao: ultimoEstado ? ultimoEstado.timestamp : null,
                    online: isOnline
                };
            }));
            
            res.json(devicesWithStatus);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao buscar dispositivos do usuário:', err);
        res.status(500).json({ msg: 'Erro ao buscar dispositivos' });
    }
}; 