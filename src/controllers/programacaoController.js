const Programacao = require('../models/Programacao');
const TimerPadrao = require('../models/TimerPadrao');
const pool = require('../config/mysql');
const axios = require('axios');

exports.getProgramacao = async (req, res) => {
    try {
        // Buscar programações do usuário
        const programacoes = await Programacao.find({ userId: req.user.id.toString() });

        // Se não houver programações, carregar as padrões
        if (programacoes.length === 0) {
            console.log('Primeiro acesso do usuário. Carregando programações padrão...');
            const novasProgramacoes = await carregarProgramacoesPadrao(req.user.id);
            return res.json(novasProgramacoes);
        }

        console.log(`Encontradas ${programacoes.length} programações para o usuário ${req.user.id}`);
        res.json(programacoes);
    } catch (err) {
        console.error('Erro ao buscar programações:', err.message);
        res.status(500).send('Erro no servidor');
    }
};

// Função auxiliar para carregar programações padrão
async function carregarProgramacoesPadrao(userId) {
    const connection = await pool.getConnection();
    
    try {
        // Buscar informações do usuário no MySQL
        const [users] = await connection.execute(
            `SELECT 
                u.id,
                u.nome_completo,
                tt.nome as tipo_telhado 
             FROM usuarios u 
             JOIN tipos_telhado tt ON u.tipo_telhado_id = tt.id 
             WHERE u.id = ?`,
            [userId]
        );

        if (users.length === 0) {
            throw new Error('Usuário não encontrado');
        }

        const usuario = users[0];
        const tipoTelhado = usuario.tipo_telhado.toLowerCase();
        
        console.log(`Carregando timers padrão para telhado tipo: ${tipoTelhado}`);

        // Buscar timers padrão do MongoDB
        const timersPadrao = await TimerPadrao.findOne({ tipoTelhado });
        
        if (!timersPadrao) {
            throw new Error('Timers padrão não encontrados');
        }

        // Criar programações personalizadas para o usuário
        const programacoes = await Promise.all(timersPadrao.horarios.map(timer => {
            return new Programacao({
                userId: userId.toString(),
                nomeUsuario: usuario.nome_completo,
                tipoTelhado: tipoTelhado,
                diaSemana: timer.diaSemana,
                horario: timer.hora,
                ativo: true
            }).save();
        }));

        console.log(`Criadas ${programacoes.length} programações para o usuário ${usuario.nome_completo}`);
        return programacoes;
    } finally {
        connection.release();
    }
}

exports.addProgramacao = async (req, res) => {
    try {
        const { diaSemana, horario } = req.body;

        // Validar entrada
        if (!diaSemana || !horario) {
            return res.status(400).json({ msg: 'Dia da semana e horário são obrigatórios' });
        }

        // Buscar informações do usuário no MySQL
        const connection = await pool.getConnection();
        try {
            const [users] = await connection.execute(
                `SELECT 
                    u.id,
                    u.nome_completo,
                    tt.nome as tipo_telhado 
                 FROM usuarios u 
                 JOIN tipos_telhado tt ON u.tipo_telhado_id = tt.id 
                 WHERE u.id = ?`,
                [req.user.id]
            );

            if (users.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            const usuario = users[0];

            // Criar nova programação com todos os dados necessários
            const novaProgramacao = new Programacao({
                userId: req.user.id.toString(),
                nomeUsuario: usuario.nome_completo,
                tipoTelhado: usuario.tipo_telhado.toLowerCase(),
                diaSemana,
                horario,
                ativo: true
            });

            await novaProgramacao.save();
            res.json(novaProgramacao);

        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Erro ao adicionar programação:', err.message);
        res.status(500).json({ msg: 'Erro ao adicionar programação', error: err.message });
    }
};

exports.updateProgramacao = async (req, res) => {
    try {
        const { ativo } = req.body;
        
        // Buscar e verificar se a programação existe
        const programacao = await Programacao.findById(req.params.id);
        if (!programacao) {
            return res.status(404).json({ msg: 'Programação não encontrada' });
        }

        // Verificar se a programação pertence ao usuário
        if (programacao.userId !== req.user.id.toString()) {
            return res.status(401).json({ msg: 'Não autorizado' });
        }

        // Atualizar status
        programacao.ativo = ativo;
        await programacao.save();

        res.json(programacao);
    } catch (err) {
        console.error('Erro ao atualizar programação:', err.message);
        res.status(500).send('Erro no servidor');
    }
};

exports.deleteProgramacao = async (req, res) => {
    try {
        // Buscar e verificar se a programação existe
        const programacao = await Programacao.findById(req.params.id);
        if (!programacao) {
            return res.status(404).json({ msg: 'Programação não encontrada' });
        }

        // Verificar se a programação pertence ao usuário
        if (programacao.userId !== req.user.id.toString()) {
            return res.status(401).json({ msg: 'Não autorizado' });
        }

        await Programacao.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Programação removida' });
    } catch (err) {
        console.error('Erro ao deletar programação:', err.message);
        res.status(500).send('Erro no servidor');
    }
};

// Função para verificar timers ativos
exports.verificarTimers = async () => {
    try {
        const agora = new Date();
        const diaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][agora.getDay()];
        const horaAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

        // Buscar programações ativas para o horário atual
        const programacoesAtivas = await Programacao.find({
            diaSemana: diaSemana,
            horario: horaAtual,
            ativo: true
        });

        // Processar cada programação ativa
        for (const prog of programacoesAtivas) {
            try {
                const connection = await pool.getConnection();
                const [user] = await connection.execute(
                    'SELECT ac.ip, ac.porta FROM usuarios u ' +
                    'JOIN arduino_config ac ON u.id = ac.usuario_id ' +
                    'WHERE u.id = ?',
                    [prog.userId]
                );
                connection.release();

                if (user[0]?.ip) {
                    // Ativar irrigação
                    await axios.post(`http://${user[0].ip}:${user[0].porta}/irrigar`);

                    // Agendar parada após 5 minutos
                    setTimeout(async () => {
                        try {
                            await axios.post(`http://${user[0].ip}:${user[0].porta}/parar`);
                        } catch (error) {
                            console.error('Erro ao parar irrigação:', error);
                        }
                    }, 5 * 60 * 1000);
                }
            } catch (error) {
                console.error('Erro ao processar programação:', error);
            }
        }
    } catch (error) {
        console.error('Erro ao verificar timers:', error);
    }
};