const Programacao = require('../models/Programacao');
const TimerPadrao = require('../models/TimerPadrao');
const User = require('../models/User');

exports.getProgramacao = async (req, res) => {
  try {
    const programacao = await Programacao.find({ userId: req.user.id });
    res.json(programacao);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};

exports.addProgramacao = async (req, res) => {
  try {
    const { diaSemana, horario } = req.body;
    const novaProgramacao = new Programacao({
      userId: req.user.id,
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

    if (programacao.userId.toString() !== req.user.id) {
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

    if (programacao.userId.toString() !== req.user.id) {
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
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'Usuário não encontrado' });
        }

        const timersPadrao = await TimerPadrao.findOne({ 
            tipoTelhado: user.tipoTelhado 
        });

        if (!timersPadrao) {
            return res.status(404).json({ msg: 'Timers padrão não encontrados' });
        }

        // Criar programações para cada horário padrão
        const programacoes = await Promise.all(timersPadrao.horarios.map(async timer => {
            const novaProgramacao = new Programacao({
                userId: req.user.id,
                diaSemana: timer.diaSemana,
                horario: timer.hora,
                duracao: timer.duracao,
                ativo: true
            });
            return await novaProgramacao.save();
        }));

        res.json(programacoes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erro no servidor');
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
        }).populate('userId');

        for (const prog of programacoesAtivas) {
            if (prog.userId.arduinoVinculado && prog.userId.arduinoVinculado.isVinculado) {
                // Ativar irrigação
                try {
                    await fetch(`http://${prog.userId.arduinoVinculado.ip}:${prog.userId.arduinoVinculado.port}/irrigar`, {
                        method: 'POST'
                    });

                    // Agendar parada após 5 minutos
                    setTimeout(async () => {
                        try {
                            await fetch(`http://${prog.userId.arduinoVinculado.ip}:${prog.userId.arduinoVinculado.port}/parar`, {
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
        }
    } catch (error) {
        console.error('Erro ao verificar timers:', error);
    }
};