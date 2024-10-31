// Funções de validação
function validarTelefone(telefone) {
    // Aceita formatos: (XX) XXXXX-XXXX ou XXXXXXXXXXX
    const regex = /^\(?([0-9]{2})\)?[-. ]?([0-9]{5})[-. ]?([0-9]{4})$/;
    return regex.test(telefone);
}

function validarSenha(senha) {
    // Mínimo 8 caracteres, pelo menos uma letra maiúscula, uma minúscula e um número
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return regex.test(senha);
}

function mostrarErro(elemento, mensagem) {
    const parentElement = elemento.parentElement;
    const errorDiv = parentElement.querySelector('.error-message') || document.createElement('div');
    errorDiv.className = 'error-message text-danger mt-1';
    errorDiv.textContent = mensagem;
    
    if (!parentElement.querySelector('.error-message')) {
        parentElement.appendChild(errorDiv);
    }
    
    elemento.classList.add('is-invalid');
}

function limparErro(elemento) {
    const parentElement = elemento.parentElement;
    const errorDiv = parentElement.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
    elemento.classList.remove('is-invalid');
}

// Função para alternar visibilidade da senha
function togglePasswordVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    
    button?.addEventListener('click', function() {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}

// Configurar toggle de senha para ambos os campos
togglePasswordVisibility('senha', 'toggleSenha');
togglePasswordVisibility('confirmarSenha', 'toggleConfirmarSenha');

// Validação de senha em tempo real
document.getElementById('confirmarSenha')?.addEventListener('input', function() {
    const senha = document.getElementById('senha').value;
    const confirmarSenha = this.value;
    
    if (senha !== confirmarSenha) {
        mostrarErro(this, 'As senhas não coincidem');
    } else {
        limparErro(this);
    }
});

// Simulação de envio de SMS
document.getElementById('btnValidarTelefone')?.addEventListener('click', function() {
    const telefone = document.getElementById('telefone');
    if (validarTelefone(telefone.value)) {
        // Simular envio de SMS
        document.getElementById('codigoSmsDiv').classList.remove('d-none');
        this.disabled = true;
        this.textContent = 'Código Enviado';
        
        // Simular código (em produção, isso viria do backend)
        window.codigoSimulado = '123456';
        alert('Código simulado: 123456');
    } else {
        mostrarErro(telefone, 'Digite um telefone válido antes de solicitar o código');
    }
});

// Verificação do código SMS
document.getElementById('btnVerificarCodigo')?.addEventListener('click', function() {
    const codigoInput = document.getElementById('codigoSms');
    const btnRegistrar = document.getElementById('btnRegistrar');
    
    if (codigoInput.value === window.codigoSimulado) {
        alert('Telefone validado com sucesso!');
        btnRegistrar.disabled = false;
        codigoInput.disabled = true;
        this.disabled = true;
    } else {
        mostrarErro(codigoInput, 'Código inválido');
    }
});

// Validação do formulário de registro
document.getElementById('registroForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    let isValid = true;

    const telefone = document.getElementById('telefone');
    const senha = document.getElementById('senha');
    const confirmarSenha = document.getElementById('confirmarSenha');
    
    // Validar telefone
    if (!validarTelefone(telefone.value)) {
        mostrarErro(telefone, 'Telefone inválido. Use o formato: (XX) XXXXX-XXXX');
        isValid = false;
    } else {
        limparErro(telefone);
    }

    // Validar senha
    if (!validarSenha(senha.value)) {
        mostrarErro(senha, 'A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, uma minúscula e um número');
        isValid = false;
    } else {
        limparErro(senha);
    }

    if (senha.value !== confirmarSenha.value) {
        mostrarErro(confirmarSenha, 'As senhas não coincidem');
        isValid = false;
    }

    if (isValid) {
        // Aqui você implementará a lógica de registro
        localStorage.setItem('userPhone', telefone.value);
        window.location.href = 'login.html';
    }
});

// Validação do formulário de login
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    let isValid = true;

    const email = document.getElementById('email');
    const password = document.getElementById('password');

    // Validar se é email ou telefone
    if (email.value.includes('@')) {
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.value)) {
            mostrarErro(email, 'Email inválido');
            isValid = false;
        } else {
            limparErro(email);
        }
    } else {
        // Validar telefone
        if (!validarTelefone(email.value)) {
            mostrarErro(email, 'Telefone inválido. Use o formato: (XX) XXXXX-XXXX');
            isValid = false;
        } else {
            limparErro(email);
        }
    }

    // Validar senha
    if (!validarSenha(password.value)) {
        mostrarErro(password, 'Senha inválida');
        isValid = false;
    } else {
        limparErro(password);
    }

    if (isValid) {
        window.location.href = 'dashboard.html';
    }
});

// Validação em tempo real do telefone
document.getElementById('telefone')?.addEventListener('input', function(e) {
    const telefone = e.target;
    if (telefone.value.length > 0) {
        if (!validarTelefone(telefone.value)) {
            mostrarErro(telefone, 'Telefone inválido. Use o formato: (XX) XXXXX-XXXX');
        } else {
            limparErro(telefone);
        }
    }
});

// Validação em tempo real da senha no registro
document.getElementById('senha')?.addEventListener('input', function(e) {
    const senha = e.target;
    if (senha.value.length > 0) {
        if (!validarSenha(senha.value)) {
            mostrarErro(senha, 'A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, uma minúscula e um número');
        } else {
            limparErro(senha);
        }
    }
});

// Controle do sistema de irrigação
document.getElementById('irrigacaoSwitch')?.addEventListener('change', function(e) {
    const status = e.target.checked;
    console.log('Sistema de irrigação: ' + (status ? 'Ligado' : 'Desligado'));
});

// Programação da irrigação
document.getElementById('programacaoForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const horario = document.getElementById('horario').value;
    const duracao = document.getElementById('duracao').value;
    console.log(`Irrigação programada para ${horario} com duração de ${duracao} minutos`);
});

// Função de logout
document.getElementById('btnLogout')?.addEventListener('click', function(e) {
    e.preventDefault();
    window.location.href = 'login.html';
});

// Configuração dos gráficos
document.addEventListener('DOMContentLoaded', function() {
    // Gráfico de consumo de água
    const waterCtx = document.getElementById('waterChart').getContext('2d');
    const waterChart = new Chart(waterCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
                label: 'Consumo de Água (L)',
                data: [300, 450, 320, 480, 350, 400],
                borderColor: 'rgb(54, 162, 235)',
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

    // Gráfico de consumo de energia
    const energyCtx = document.getElementById('energyChart').getContext('2d');
    const energyChart = new Chart(energyCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
                label: 'Consumo de Energia (kWh)',
                data: [50, 65, 45, 60, 55, 58],
                backgroundColor: 'rgb(255, 99, 132)',
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

    // Gráfico de vazão
    const vazaoCtx = document.getElementById('vazaoChart')?.getContext('2d');
    if (vazaoCtx) {
        const vazaoChart = new Chart(vazaoCtx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Vazão (L/min)',
                    data: [2.1, 2.8, 3.2, 2.5, 2.9, 2.3],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 6
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Histórico de Vazão nas Últimas 24h'
                    }
                }
            }
        });

        // Atualiza a vazão a cada 5 segundos
        setInterval(atualizarVazao, 5000);
        // Primeira atualização imediata
        atualizarVazao();
    }
});

// Função para atualizar a vazão (simulada)
function atualizarVazao() {
    const vazaoMinima = 1.0;
    const vazaoMaxima = 5.5;
    const vazaoAtual = (Math.random() * (vazaoMaxima - vazaoMinima) + vazaoMinima).toFixed(1);
    
    document.getElementById('vazaoAgua').textContent = `${vazaoAtual} L/min`;
    document.getElementById('vazaoAtual').textContent = vazaoAtual;
    
    // Calcula a porcentagem para a barra de progresso
    const porcentagem = ((vazaoAtual - vazaoMinima) / (vazaoMaxima - vazaoMinima) * 100).toFixed(0);
    const progressBar = document.getElementById('vazaoProgress');
    progressBar.style.width = `${porcentagem}%`;
    
    // Ajusta a cor da barra baseado na vazão
    if (porcentagem > 80) {
        progressBar.className = 'progress-bar bg-danger';
    } else if (porcentagem > 60) {
        progressBar.className = 'progress-bar bg-warning';
    } else {
        progressBar.className = 'progress-bar bg-success';
    }
} 