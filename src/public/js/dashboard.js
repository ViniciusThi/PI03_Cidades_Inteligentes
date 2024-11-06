document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Configuração dos gráficos
    const waterCtx = document.getElementById('waterChart').getContext('2d');
    const energyCtx = document.getElementById('energyChart').getContext('2d');

    const waterChart = new Chart(waterCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Consumo de Água (L)',
                data: [],
                borderColor: '#0d6efd',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    const energyChart = new Chart(energyCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Consumo de Energia (kWh)',
                data: [],
                borderColor: '#198754',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Adicionar após a configuração dos gráficos
    const socket = io();

    socket.on('sensorUpdate', (data) => {
        if (data.userId === getUserId()) { // Implementar função para pegar ID do usuário do token
            atualizarDadosInterface(data.data);
        }
    });

    function atualizarDadosInterface(dados) {
        document.getElementById('umidadeSolo').textContent = `${dados.umidadeSolo}%`;
        
        // Atualizar gráficos
        const timestamp = new Date(dados.timestamp).toLocaleTimeString();
        
        waterChart.data.labels.push(timestamp);
        waterChart.data.datasets[0].data.push(dados.consumoAgua);
        if (waterChart.data.labels.length > 10) {
            waterChart.data.labels.shift();
            waterChart.data.datasets[0].data.shift();
        }
        waterChart.update();

        energyChart.data.labels.push(timestamp);
        energyChart.data.datasets[0].data.push(dados.consumoEnergia);
        if (energyChart.data.labels.length > 10) {
            energyChart.data.labels.shift();
            energyChart.data.datasets[0].data.shift();
        }
        energyChart.update();
    }

    // Função para atualizar os dados
    async function atualizarDados() {
        try {
            const response = await fetch('/api/sensor', {
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar dados');
            }

            const dados = await response.json();
            
            // Atualizar umidade do solo
            if (dados.length > 0) {
                const ultimaLeitura = dados[0];
                document.getElementById('umidadeSolo').textContent = 
                    `${ultimaLeitura.umidadeSolo}%`;
            }

            // Preparar dados para os gráficos
            const labels = dados.map(d => new Date(d.timestamp).toLocaleDateString());
            const consumoAgua = dados.map(d => d.consumoAgua);
            const consumoEnergia = dados.map(d => d.consumoEnergia);

            // Atualizar gráficos
            waterChart.data.labels = labels.reverse();
            waterChart.data.datasets[0].data = consumoAgua.reverse();
            waterChart.update();

            energyChart.data.labels = labels;
            energyChart.data.datasets[0].data = consumoEnergia;
            energyChart.update();

            // Calcular economia de água
            if (dados.length > 1) {
                const consumoAtual = consumoAgua[0];
                const consumoAnterior = consumoAgua[1];
                const economia = ((consumoAnterior - consumoAtual) / consumoAnterior * 100).toFixed(1);
                document.getElementById('economiaAgua').textContent = `${economia}%`;
            }

        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Erro ao atualizar dados'
            });
        }
    }

    // Atualizar dados a cada 30 segundos
    atualizarDados();
    setInterval(atualizarDados, 30000);

    // Logout
    document.getElementById('btnLogout').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
}); 