const SensorData = require('../models/SensorData');
const User = require('../models/User');

exports.addSensorData = async (req, res) => {
  try {
    const { consumoAgua, consumoEnergia, umidadeSolo } = req.body;
    const userId = req.user.id;

    const sensorData = new SensorData({
      userId,
      consumoAgua,
      consumoEnergia,
      umidadeSolo
    });

    await sensorData.save();

    // Enviar dados em tempo real para o dashboard
    global.io.emit('sensorUpdate', {
      userId,
      data: sensorData
    });

    res.json(sensorData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};

exports.getSensorData = async (req, res) => {
  try {
    const userId = req.user.id;
    const sensorData = await SensorData.find({ userId })
      .sort({ timestamp: -1 })
      .limit(30);
    res.json(sensorData);
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