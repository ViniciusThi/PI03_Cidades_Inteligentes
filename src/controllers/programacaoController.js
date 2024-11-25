const Programacao = require('../models/Programacao');
const TimerPadrao = require('../models/TimerPadrao');
const pool = require('../config/mysql');

exports.getProgramacao = async (req, res) => {
    try {
        const programacoes = await Programacao.find({ userId: req.user.id.toString() });
        res.json(programacoes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
};

exports.addProgramacao = async (req, res) => {
    try {
        const { diaSemana, horario } = req.body;
        const novaProgramacao = new Programacao({
            userId: req.user.id.toString(),
            diaSemana,
            horario
        });

        await novaProgramacao.save();
        res.json(novaProgramacao);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
};

exports.updateProgramacao = async (req, res) => {
    try {
        const { ativo } = req.body;
        const programacao = await Programacao.findById(req.params.id);

        if (!programacao) {
            return res.status(404).json({ msg: 'Programação não encontrada' });
        }

        if (programacao.userId !== req.user.id.toString()) {
            return res.status(401).json({ msg: 'Não autorizado' });
        }

        programacao.ativo = ativo;
        await programacao.save();

        res.json(programacao);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
};

exports.deleteProgramacao = async (req, res) => {
    try {
        const programacao = await Programacao.findById(req.params.id);

        if (!programacao) {
            return res.status(404).json({ msg: 'Programação não encontrada' });
        }

        if (programacao.userId !== req.user.id.toString()) {
            return res.status(401).json({ msg: 'Não autorizado' });
        }

        await Programacao.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Programação removida' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
    }
};

exports.carregarTimersPadrao = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        try {
            // Buscar tipo de telhado do usuário
            const [users] = await connection.execute(
                'SELECT tt.nome as tipo_telhado FROM usuarios u ' +
                'JOIN tipos_telhado tt ON u.tipo_telhado_id = tt.id ' +
                'WHERE u.id = ?',
                [req.user.id]
            );

            if (users.length === 0) {
                return res.status(404).json({ msg: 'Usuário não encontrado' });
            }

            const tipoTelhado = users[0].tipo_telhado.toLowerCase();
            console.log('Tipo de telhado do usuário:', tipoTelhado);

            // Buscar timers padrão do MongoDB
            const timersPadrao = await TimerPadrao.findOne({ tipoTelhado });
            console.log('Timers padrão encontrados:', timersPadrao);

            if (!timersPadrao) {
                return res.status(404).json({ msg: 'Timers padrão não encontrados' });
            }

            // Limpar programações existentes do usuário
            await Programacao.deleteMany({ userId: req.user.id.toString() });

            // Inserir novas programações
            const programacoes = await Promise.all(timersPadrao.horarios.map(timer => {
                return new Programacao({
                    userId: req.user.id.toString(),
                    diaSemana: timer.diaSemana,
                    horario: timer.hora,
                    ativo: true
                }).save();
            }));

            console.log('Novas programações criadas:', programacoes);
            res.json(programacoes);

        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao carregar timers padrão:', err);
        res.status(500).json({ msg: 'Erro ao carregar programações padrão' });
    }
};

exports.verificarTimers = async () => {
    try {
        const agora = new Date();
        const diaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][agora.getDay()];
        const horaAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

        const programacoesAtivas = await Programacao.find({
            diaSemana: diaSemana,
            horario: horaAtual,
            ativo: true
        });

        for (const prog of programacoesAtivas) {
            try {
                const connection = await pool.getConnection();
                const [user] = await connection.execute(
                    'SELECT * FROM users WHERE id = ?',
                    [prog.userId]
                );
                connection.release();

                if (user[0].arduinoVinculado) {
                    // Ativar irrigação
                    try {
                        await fetch(`http://${user[0].arduinoVinculado.ip}:${user[0].arduinoVinculado.port}/irrigar`, {
                            method: 'POST'
                        });

                        // Agendar parada após 5 minutos
                        setTimeout(async () => {
                            try {
                                await fetch(`http://${user[0].arduinoVinculado.ip}:${user[0].arduinoVinculado.port}/parar`, {
                                    method: 'POST'
                                });
                            } catch (error) {
                                console.error('Erro ao parar irrigação:', error);
                            }
                        }, 5 * 60 * 1000); // 5 minutos
                    } catch (error) {
                        console.error('Erro ao iniciar irrigação:', error);
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar usuário:', error);
            }
        }
    } catch (error) {
        console.error('Erro ao verificar timers:', error);
    }
};