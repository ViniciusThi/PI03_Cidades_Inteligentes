const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado ao MongoDB');

        // Listar todas as coleções
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\nColeções existentes:');
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });

        // Buscar e mostrar programações
        const Programacao = require('../models/Programacao');
        const programacoes = await Programacao.find({});
        
        console.log('\nProgramações salvas:');
        programacoes.forEach(prog => {
            console.log(`\nUsuário: ${prog.nomeUsuario}`);
            console.log(`ID do Usuário: ${prog.userId}`);
            console.log(`Tipo de Telhado: ${prog.tipoTelhado}`);
            console.log(`Dia: ${prog.diaSemana}`);
            console.log(`Horário: ${prog.horario}`);
            console.log(`Ativo: ${prog.ativo}`);
            console.log(`Data de Criação: ${prog.dataCriacao}`);
            console.log('------------------------');
        });

        // Buscar e mostrar timers padrão
        const TimerPadrao = require('../models/TimerPadrao');
        const timersPadrao = await TimerPadrao.find({});
        
        console.log('\nTimers Padrão:');
        timersPadrao.forEach(timer => {
            console.log(`\nTipo de Telhado: ${timer.tipoTelhado}`);
            console.log('Horários:');
            timer.horarios.forEach(h => {
                console.log(`- ${h.diaSemana} às ${h.hora}`);
            });
            console.log('------------------------');
        });

        mongoose.connection.close();
    } catch (error) {
        console.error('Erro:', error);
    }
}

checkCollections(); 