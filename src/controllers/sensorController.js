const SensorData = require('../models/SensorData');
const User = require('../models/User');
const pool = require('../config/mysql');
const RelayState = require('../models/RelayState');

// Salvar dados dos sensores recebidos via WebSocket
exports.salvarDadosSensores = async (data) => {
  try {
    // Buscar usuário associado ao MAC do dispositivo
    const connection = await pool.getConnection();
    let userId = null;
    
    try {
      const [rows] = await connection.execute(
        'SELECT usuario_id FROM arduino_config WHERE mac_address = ?',
        [data.mac]
      );
      
      if (rows.length > 0) {
        userId = rows[0].usuario_id;
      } else {
        console.log(`Nenhum usuário encontrado para o dispositivo ${data.mac}`);
        // Se não encontrar um usuário associado, tenta pela última vinculação
        const [lastConfig] = await connection.execute(
          'SELECT usuario_id FROM arduino_config WHERE ip = ? ORDER BY last_update DESC LIMIT 1',
          [data.ip]
        );
        
        if (lastConfig.length > 0) {
          userId = lastConfig[0].usuario_id;
          
          // Atualizar o MAC do dispositivo na configuração
          await connection.execute(
            'UPDATE arduino_config SET mac_address = ? WHERE usuario_id = ?',
            [data.mac, userId]
          );
        }
      }
    } finally {
      connection.release();
    }
    
    if (!userId) {
      console.log(`Não foi possível determinar o usuário para o dispositivo ${data.mac}`);
      return;
    }
    
    // Salvar dados no MongoDB
    const sensorData = new SensorData({
      userId: userId.toString(),
      deviceMac: data.mac,
      temperatura: data.temperatura,
      umidade: data.umidade,
      umidadeSolo: data.umidadeSolo,
      irrigacaoAtiva: data.irrigacaoAtiva
    });
    
    await sensorData.save();
    
    // Atualizar o estado do relé se necessário
    const ultimoEstado = await RelayState.findOne(
      { userId: userId.toString() },
      {},
      { sort: { timestamp: -1 } }
    );
    
    if (!ultimoEstado || 
        ultimoEstado.estado !== data.irrigacaoAtiva || 
        ultimoEstado.sistemaAutomatico !== data.automatico) {
      
      const novoEstado = new RelayState({
        userId: userId.toString(),
        estado: data.irrigacaoAtiva,
        sistemaAutomatico: data.automatico,
        status: data.irrigacaoAtiva ? 'irrigando' : 'online'
      });
      
      await novoEstado.save();
    }
    
    return sensorData;
  } catch (err) {
    console.error('Erro ao salvar dados dos sensores:', err);
    throw err;
  }
};

// Adicionar dados de sensores via API REST
exports.addSensorData = async (req, res) => {
  try {
    const { temperatura, umidade, umidadeSolo, irrigacaoAtiva } = req.body;
    const userId = req.user.id;

    const sensorData = new SensorData({
      userId,
      deviceMac: req.body.mac || 'unknown',
      temperatura,
      umidade,
      umidadeSolo,
      irrigacaoAtiva
    });

    await sensorData.save();

    // Enviar dados em tempo real para o dashboard
    if (global.broadcastSensorData) {
      global.broadcastSensorData({
        type: 'sensor_data',
        mac: req.body.mac || 'unknown',
        temperatura,
        umidade,
        umidadeSolo,
        irrigacaoAtiva,
        userId
      });
    }

    res.json(sensorData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};

// Obter histórico de leituras dos sensores
exports.getSensorData = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;
    const days = parseInt(req.query.days) || 1;
    
    // Calcular data de início para filtrar
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const sensorData = await SensorData.find({ 
      userId,
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: -1 })
      .limit(limit);
    
    res.json(sensorData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};

// Obter dados agregados por períodos (hora, dia, semana)
exports.getAggregatedData = async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'day'; // 'hour', 'day', 'week'
    const days = parseInt(req.query.days) || 7;
    
    // Calcular data de início para filtrar
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Definir o formato de agrupamento baseado no período
    let groupFormat;
    switch (period) {
      case 'hour':
        groupFormat = { 
          year: { $year: "$timestamp" },
          month: { $month: "$timestamp" },
          day: { $dayOfMonth: "$timestamp" },
          hour: { $hour: "$timestamp" }
        };
        break;
      case 'day':
        groupFormat = { 
          year: { $year: "$timestamp" },
          month: { $month: "$timestamp" },
          day: { $dayOfMonth: "$timestamp" }
        };
        break;
      case 'week':
        groupFormat = { 
          year: { $year: "$timestamp" },
          week: { $week: "$timestamp" }
        };
        break;
      default:
        groupFormat = { 
          year: { $year: "$timestamp" },
          month: { $month: "$timestamp" },
          day: { $dayOfMonth: "$timestamp" }
        };
    }
    
    // Agregar os dados
    const aggregatedData = await SensorData.aggregate([
      { 
        $match: { 
          userId: userId.toString(),
          timestamp: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: groupFormat,
          avgTemperatura: { $avg: "$temperatura" },
          avgUmidade: { $avg: "$umidade" },
          avgUmidadeSolo: { $avg: "$umidadeSolo" },
          minTemperatura: { $min: "$temperatura" },
          maxTemperatura: { $max: "$temperatura" },
          count: { $sum: 1 },
          lastTimestamp: { $max: "$timestamp" }
        }
      },
      { $sort: { lastTimestamp: -1 } }
    ]);
    
    res.json(aggregatedData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};

// Nova função para vincular Arduino
exports.vincularArduino = async (req, res) => {
  try {
    const { ip, port } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    user.arduinoVinculado = {
      ip,
      port,
      isVinculado: true
    };

    await user.save();

    res.json({ msg: 'Arduino vinculado com sucesso', arduinoVinculado: user.arduinoVinculado });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};

// Nova função para desvincular Arduino
exports.desvincularArduino = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    user.arduinoVinculado = {
      ip: null,
      port: null,
      isVinculado: false
    };

    await user.save();

    res.json({ msg: 'Arduino desvinculado com sucesso' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
}; 