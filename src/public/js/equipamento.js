document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const configForm = document.getElementById('configForm');
    const btnTestar = document.getElementById('btnTestar');
    const btnDesconectar = document.getElementById('btnDesconectar');
    const btnIrrigar = document.getElementById('btnIrrigar');
    const btnPararIrrigacao = document.getElementById('btnPararIrrigacao');
    const connectionStatus = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    let arduinoConfig = {
        ip: localStorage.getItem('arduinoIp') || '',
        port: localStorage.getItem('arduinoPort') || '80',
        connected: false
    };

    let updateInterval;
    let connectionCheckInterval;

    // Verificar conexão periodicamente
    function startConnectionCheck() {
        if (connectionCheckInterval) {
            clearInterval(connectionCheckInterval);
        }
        connectionCheckInterval = setInterval(verificarConexao, 10000); // Verifica a cada 10 segundos
    }

    async function verificarConexao() {
        if (!arduinoConfig.connected) return;

        try {
            const response = await fetch('/arduino/status', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });
            
            if (!response.ok) {
                throw new Error('Conexão perdida');
            }

            const data = await response.json();
            if (!data.status || data.status !== 'online') {
                throw new Error('Arduino offline');
            }
        } catch (error) {
            console.error('Erro na verificação de conexão:', error);
            handleDisconnect();
        }
    }

    function handleDisconnect() {
        updateConnectionStatus(false);
        stopDataUpdates();
        stopConnectionCheck();
        Swal.fire({
            icon: 'error',
            title: 'Conexão Perdida',
            text: 'A conexão com o Arduino foi perdida. Tente reconectar.'
        });
    }

    function stopConnectionCheck() {
        if (connectionCheckInterval) {
            clearInterval(connectionCheckInterval);
            connectionCheckInterval = null;
        }
    }

    // Carregar estado anterior da conexão
    function loadPreviousConnection() {
        const wasConnected = localStorage.getItem('arduinoConnected') === 'true';
        const lastConnectionTime = parseInt(localStorage.getItem('lastConnectionTime'));
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - lastConnectionTime;

        // Se estava conectado e não passou muito tempo (menos de 1 minuto)
        if (wasConnected && timeDiff < 60000) {
            testarConexao();
        }
    }

    // Evento de visibilidade da página
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadPreviousConnection();
        }
    });

    // Carregar configurações salvas e estado anterior
    if (arduinoConfig.ip) {
        document.getElementById('arduinoIp').value = arduinoConfig.ip;
        document.getElementById('arduinoPort').value = arduinoConfig.port;
        loadPreviousConnection();
    }

    // Evento de beforeunload para salvar estado
    window.addEventListener('beforeunload', () => {
        if (arduinoConfig.connected) {
            localStorage.setItem('arduinoConnected', 'true');
            localStorage.setItem('lastConnectionTime', new Date().getTime());
        }
    });

    function updateConnectionStatus(isConnected) {
        arduinoConfig.connected = isConnected;
        localStorage.setItem('arduinoConnected', isConnected); // Salva o estado no localStorage
        localStorage.setItem('lastConnectionTime', new Date().getTime()); // Salva o timestamp da última conexão
        
        if (isConnected) {
            connectionStatus.classList.remove('inactive');
            connectionStatus.classList.add('active');
            statusText.textContent = 'Conectado';
            btnIrrigar.disabled = false;
            btnPararIrrigacao.disabled = false;
            btnDesconectar.style.display = 'inline-block';
            btnTestar.style.display = 'none';
            startConnectionCheck();
            startDataUpdates();
        } else {
            connectionStatus.classList.remove('active');
            connectionStatus.classList.add('inactive');
            statusText.textContent = 'Desconectado';
            btnIrrigar.disabled = true;
            btnPararIrrigacao.disabled = true;
            btnDesconectar.style.display = 'none';
            btnTestar.style.display = 'inline-block';
            stopDataUpdates();
            stopConnectionCheck();
        }
    }

    // Evento de desconexão
    btnDesconectar.addEventListener('click', async () => {
        try {
            const response = await fetch('/arduino/desconectar', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Falha ao desconectar do Arduino');
            }

            updateConnectionStatus(false);
            
            Swal.fire({
                icon: 'success',
                title: 'Desconectado',
                text: 'Arduino desconectado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao desconectar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível desconectar do Arduino'
            });
        }
    });

    function startDataUpdates() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
        atualizarLeituras();
        updateInterval = setInterval(atualizarLeituras, 5000);
    }

    function stopDataUpdates() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        document.getElementById('umidadeSoloReal').textContent = '---';
        document.getElementById('ultimaAtualizacao').textContent = '---';
    }

    // Salvar configurações do Arduino
    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const arduinoData = {
            ip: document.getElementById('arduinoIp').value,
            port: document.getElementById('arduinoPort').value
        };

        try {
            // Primeiro, vincular o Arduino ao usuário
            const vincularResponse = await fetch('/arduino/vincular', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(arduinoData)
            });

            if (!vincularResponse.ok) {
                throw new Error('Falha ao vincular Arduino');
            }

            // Se vinculou com sucesso, salvar configurações locais
            arduinoConfig = {
                ip: arduinoData.ip,
                port: arduinoData.port,
                connected: false
            };
            
            localStorage.setItem('arduinoIp', arduinoConfig.ip);
            localStorage.setItem('arduinoPort', arduinoConfig.port);

            // Agora testar a conexão
            await testarConexao();
            
        } catch (error) {
            console.error('Erro ao configurar Arduino:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível configurar o Arduino'
            });
        }
    });

    // Testar conexão com o Arduino
    async function testarConexao() {
        try {
            updateConnectionStatus(false); // Reset status antes de tentar conectar
            
            const response = await fetch('/arduino/status', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha na conexão');
            }

            const data = await response.json();
            if (data.status === 'online') {
                updateConnectionStatus(true);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Conectado!',
                    text: 'Conexão estabelecida com sucesso'
                });
            } else {
                throw new Error('Arduino não está respondendo corretamente');
            }
        } catch (error) {
            console.error('Erro de conexão:', error);
            handleDisconnect();
            Swal.fire({
                icon: 'error',
                title: 'Erro de Conexão',
                text: error.message
            });
        }
    }

    btnTestar.addEventListener('click', testarConexao);

    // Controle de irrigação
    btnIrrigar.addEventListener('click', async () => {
        if (!arduinoConfig.connected) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Arduino não está conectado'
            });
            return;
        }

        try {
            const response = await fetch('/arduino/irrigar', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Falha ao ativar irrigação');
            }

            Swal.fire({
                icon: 'success',
                title: 'Sucesso',
                text: 'Sistema de irrigação ativado'
            });
        } catch (error) {
            console.error('Erro ao irrigar:', error);
            handleDisconnect();
        }
    });

    // Adicionar evento para o botão de parar irrigação
    btnPararIrrigacao.addEventListener('click', async () => {
        if (!arduinoConfig.connected) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Arduino não está conectado'
            });
            return;
        }

        try {
            const response = await fetch('/arduino/parar', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Falha ao parar irrigação');
            }

            const data = await response.json();
            if (data.status === 'parado') {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso',
                    text: 'Sistema de irrigação desativado'
                });
            } else {
                throw new Error('Falha ao parar irrigação');
            }
        } catch (error) {
            console.error('Erro ao parar irrigação:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível parar a irrigação'
            });
        }
    });

    // Atualização em tempo real
    async function atualizarLeituras() {
        if (!arduinoConfig.connected) return;

        try {
            const response = await fetch('/arduino/leituras', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao obter leituras');
            }

            const dados = await response.json();
            document.getElementById('umidadeSoloReal').textContent = `${dados.umidade}%`;
            document.getElementById('ultimaAtualizacao').textContent = 
                new Date().toLocaleTimeString();
        } catch (error) {
            console.error('Erro ao atualizar leituras:', error);
            handleDisconnect();
        }
    }

    // Logout
    document.getElementById('btnLogout').addEventListener('click', () => {
        if (arduinoConfig.connected) {
            stopDataUpdates();
            stopConnectionCheck();
            updateConnectionStatus(false);
        }
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
}); 