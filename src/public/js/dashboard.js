document.addEventListener('DOMContentLoaded', () => {
    // Verificar se não é admin
    const isAdmin = localStorage.getItem('isAdmin') === '1';
    if (isAdmin) {
        window.location.replace('admin.html');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Configuração dos gráficos
    const waterCtx = document.getElementById('waterChart').getContext('2d');
    const energyCtx = document.getElementById('energyChart').getContext('2d');

    // Dados fictícios
    const ultimosSeteDias = Array.from({length: 7}, (_, i) => {
        const data = new Date();
        data.setDate(data.getDate() - i);
        return data.toLocaleDateString();
    }).reverse();

    // Dados fictícios de consumo de água
    const consumoAgua = [120, 115, 125, 110, 130, 120, 115];
    
    // Dados fictícios de consumo de energia
    const consumoEnergia = [2.5, 2.3, 2.6, 2.4, 2.7, 2.5, 2.4];

    const waterChart = new Chart(waterCtx, {
        type: 'line',
        data: {
            labels: ultimosSeteDias,
            datasets: [{
                label: 'Consumo de Água (L)',
                data: consumoAgua,
                borderColor: '#0d6efd',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Litros'
                    }
                }
            }
        }
    });

    const energyChart = new Chart(energyCtx, {
        type: 'line',
        data: {
            labels: ultimosSeteDias,
            datasets: [{
                label: 'Consumo de Energia (kWh)',
                data: consumoEnergia,
                borderColor: '#198754',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'kWh'
                    }
                }
            }
        }
    });

    // Função para atualizar dados fictícios
    function atualizarDadosFicticios() {
        // Umidade do solo (valor entre 60% e 80%)
        const umidade = Math.floor(Math.random() * (80 - 60 + 1)) + 60;
        document.getElementById('umidadeSolo').textContent = `${umidade}%`;

        // Economia de água (valor entre 15% e 25%)
        const economia = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
        document.getElementById('economiaAgua').textContent = `${economia}%`;

        // Atualizar gráficos com novos valores
        const novoConsumoAgua = consumoAgua[consumoAgua.length - 1] + (Math.random() * 10 - 5);
        const novoConsumoEnergia = consumoEnergia[consumoEnergia.length - 1] + (Math.random() * 0.4 - 0.2);

        // Remover primeiro valor e adicionar novo
        waterChart.data.datasets[0].data.shift();
        waterChart.data.datasets[0].data.push(novoConsumoAgua);
        
        energyChart.data.datasets[0].data.shift();
        energyChart.data.datasets[0].data.push(novoConsumoEnergia);

        // Atualizar data
        const novaData = new Date();
        novaData.setDate(new Date(waterChart.data.labels[waterChart.data.labels.length - 1]).getDate() + 1);
        
        waterChart.data.labels.shift();
        waterChart.data.labels.push(novaData.toLocaleDateString());
        
        energyChart.data.labels.shift();
        energyChart.data.labels.push(novaData.toLocaleDateString());

        // Atualizar gráficos
        waterChart.update();
        energyChart.update();
    }

    // Atualizar dados a cada 30 segundos
    atualizarDadosFicticios();
    setInterval(atualizarDadosFicticios, 30000);

    // Adicionar evento de logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }

    // Função para atualizar status do sistema
    async function atualizarStatusSistema() {
        try {
            const response = await fetch('/arduino/status', {
                headers: {
                    'x-auth-token': localStorage.getItem('token')
                }
            });

            if (!response.ok) throw new Error('Erro ao buscar status');

            const data = await response.json();
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');

            // Atualizar indicador visual
            statusIndicator.className = 'status-indicator';
            switch (data.status) {
                case 'online':
                    statusIndicator.classList.add('status-active');
                    statusText.textContent = 'Online';
                    break;
                case 'irrigando':
                    statusIndicator.classList.add('status-irrigating');
                    statusText.textContent = 'Irrigando';
                    break;
                default:
                    statusIndicator.classList.add('status-inactive');
                    statusText.textContent = 'Desconectado';
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    }

    // Atualizar status a cada 5 segundos
    setInterval(atualizarStatusSistema, 5000);
}); 