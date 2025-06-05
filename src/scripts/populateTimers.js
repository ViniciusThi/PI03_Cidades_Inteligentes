const mongoose = require('mongoose');
const TimerPadrao = require('../models/TimerPadrao');
require('dotenv').config();

const timersData = {
    intensivo: [
        { diaSemana: 'segunda', hora: '06:00' },
        { diaSemana: 'segunda', hora: '18:00' },
        { diaSemana: 'quarta', hora: '06:00' },
        { diaSemana: 'quarta', hora: '18:00' },
        { diaSemana: 'sexta', hora: '06:00' },
        { diaSemana: 'sexta', hora: '18:00' }
    ],
    semiintensivo: [
        { diaSemana: 'segunda', hora: '07:00' },
        { diaSemana: 'quarta', hora: '07:00' },
        { diaSemana: 'sexta', hora: '07:00' }
    ],
    extensivo: [
        { diaSemana: 'terca', hora: '07:00' },
        { diaSemana: 'quinta', hora: '07:00' }
    ]
};

async function populateTimers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado ao MongoDB');

        // Limpar timers existentes
        await TimerPadrao.deleteMany({});
        console.log('Timers antigos removidos');

        // Inserir novos timers
        for (const [tipo, horarios] of Object.entries(timersData)) {
            await TimerPadrao.create({
                tipoTelhado: tipo,
                horarios: horarios
            });
            console.log(`Timers para telhado ${tipo} criados`);
        }

        console.log('Timers padrão populados com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

populateTimers(); 