document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Elementos do DOM
    const configForm = document.getElementById('configForm');
    const btnTestar = document.getElementById('btnTestar');
    const btnDesconectar = document.getElementById('btnDesconectar');
    const btnIrrigar = document.getElementById('btnIrrigar');
    const btnPararIrrigacao = document.getElementById('btnPararIrrigacao');
    const statusConnection = document.getElementById('statusConnection');

    // Função para atualizar leituras em tempo real
    async function atualizarLeituras() {
        try {
            const response = await fetch('/arduino/leituras', {
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) throw new Error('Erro ao buscar leituras');

            const data = await response.json();
            
            // Atualizar campos na interface
            document.getElementById('umidadeSoloReal').textContent = `${data.estado ? 'Ligado' : 'Desligado'}`;
            document.getElementById('ultimaAtualizacao').textContent = new Date().toLocaleTimeString();

            // Atualizar status visual
            const statusIndicator = document.querySelector('.status-indicator');
            const statusText = document.getElementById('statusText');

            statusIndicator.className = 'status-indicator';
            if (data.estado) {
                statusIndicator.classList.add('status-irrigating');
                statusText.textContent = 'Irrigando';
            } else {
                statusIndicator.classList.add('status-active');
                statusText.textContent = 'Online';
            }

        } catch (error) {
            console.error('Erro ao atualizar leituras:', error);
            document.getElementById('umidadeSoloReal').textContent = '---';
            document.getElementById('ultimaAtualizacao').textContent = '---';
        }
    }

    // Função para iniciar atualizações periódicas
    function startDataUpdates() {
        // Primeira atualização imediata
        atualizarLeituras();
        // Configurar atualização a cada 2 segundos
        return setInterval(atualizarLeituras, 2000);
    }

    // Verificar Arduino e iniciar atualizações
    async function verificarArduinoVinculado() {
        try {
            const response = await fetch('/arduino/status', {
                headers: {
                    'x-auth-token': token
                }
            });

            const data = await response.json();
            
            if (response.ok && data.vinculado) {
                // Arduino já está vinculado
                configForm.style.display = 'none';
                btnTestar.style.display = 'none';
                btnDesconectar.style.display = 'inline-block';
                btnIrrigar.disabled = false;
                btnPararIrrigacao.disabled = false;
                updateConnectionStatus(true);
                startDataUpdates(); // Iniciar atualizações periódicas
            } else {
                // Arduino não vinculado ou erro
                configForm.style.display = 'block';
                btnTestar.style.display = 'inline-block';
                btnDesconectar.style.display = 'none';
                btnIrrigar.disabled = true;
                btnPararIrrigacao.disabled = true;
                updateConnectionStatus(false);
            }
        } catch (error) {
            console.error('Erro ao verificar Arduino:', error);
            updateConnectionStatus(false);
        }
    }

    // Atualizar status de conexão
    function updateConnectionStatus(connected) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.getElementById('statusText');

        statusIndicator.className = 'status-indicator';
        if (connected) {
            statusIndicator.classList.add('status-active');
            statusText.textContent = 'Conectado';
            btnIrrigar.disabled = false;
            btnPararIrrigacao.disabled = false;
        } else {
            statusIndicator.classList.add('status-inactive');
            statusText.textContent = 'Desconectado';
            btnIrrigar.disabled = true;
            btnPararIrrigacao.disabled = true;
        }
    }

    // Eventos dos botões de irrigação
    btnIrrigar.addEventListener('click', async () => {
        try {
            const response = await fetch('/arduino/irrigar', {
                method: 'POST',
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) throw new Error('Erro ao ativar irrigação');

            Swal.fire({
                icon: 'success',
                title: 'Sucesso',
                text: 'Irrigação ativada com sucesso!'
            });
        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Erro ao ativar irrigação'
            });
        }
    });

    btnPararIrrigacao.addEventListener('click', async () => {
        try {
            const response = await fetch('/arduino/parar', {
                method: 'POST',
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) throw new Error('Erro ao parar irrigação');

            Swal.fire({
                icon: 'success',
                title: 'Sucesso',
                text: 'Irrigação parada com sucesso!'
            });
        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Erro ao parar irrigação'
            });
        }
    });

    // Adicionar evento de submit ao formulário de configuração
    if (configForm) {
        configForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                // Mostrar loading
                Swal.fire({
                    title: 'Conectando...',
                    text: 'Tentando estabelecer conexão com o Arduino',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const response = await fetch('/arduino/vincular', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({
                        ip: document.getElementById('arduinoIp').value,
                        porta: document.getElementById('arduinoPort').value
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.msg || 'Erro ao vincular Arduino');
                }

                // Fechar loading e mostrar sucesso
                Swal.fire({
                    icon: 'success',
                    title: 'Conectado!',
                    text: 'Arduino vinculado com sucesso',
                    timer: 2000
                });

                // Atualizar interface
                configForm.style.display = 'none';
                btnTestar.style.display = 'none';
                btnDesconectar.style.display = 'inline-block';
                btnIrrigar.disabled = false;
                btnPararIrrigacao.disabled = false;
                updateConnectionStatus(true);
                startDataUpdates();

            } catch (error) {
                console.error('Erro ao vincular Arduino:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message || 'Erro ao vincular Arduino'
                });
            }
        });
    }

    // Adicionar evento ao botão de teste
    if (btnTestar) {
        btnTestar.addEventListener('click', async () => {
            try {
                const ip = document.getElementById('arduinoIp').value;
                const porta = document.getElementById('arduinoPort').value;

                if (!ip || !porta) {
                    throw new Error('Preencha o IP e a porta do Arduino');
                }

                Swal.fire({
                    title: 'Testando conexão...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const response = await fetch(`http://${ip}:${porta}/status`);
                const data = await response.json();

                Swal.fire({
                    icon: 'success',
                    title: 'Teste bem sucedido!',
                    text: 'Arduino respondeu corretamente'
                });

            } catch (error) {
                console.error('Erro no teste:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro no teste',
                    text: 'Não foi possível conectar ao Arduino'
                });
            }
        });
    }

    // Chamar verificação inicial
    await verificarArduinoVinculado();

    // Evento de logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
}); 