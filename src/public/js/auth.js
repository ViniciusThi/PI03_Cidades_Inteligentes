document.addEventListener('DOMContentLoaded', () => {
    // Adicionar funcionalidade de mostrar/ocultar senha
    const addPasswordToggle = (inputId) => {
        const input = document.getElementById(inputId);
        if (!input) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn btn-outline-secondary password-toggle';
        toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
        toggleBtn.style.position = 'absolute';
        toggleBtn.style.right = '10px';
        toggleBtn.style.top = '50%';
        toggleBtn.style.transform = 'translateY(-50%)';
        toggleBtn.style.zIndex = '10';
        
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(toggleBtn);

        toggleBtn.addEventListener('click', () => {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            toggleBtn.innerHTML = type === 'password' ? 
                '<i class="bi bi-eye"></i>' : 
                '<i class="bi bi-eye-slash"></i>';
        });
    };

    // Adicionar placeholders aos campos
    const placeholders = {
        'nomeCompleto': 'Ex: João da Silva',
        'email': 'Ex: joao@email.com',
        'telefone': 'Ex: (11) 99999-9999',
        'senha': 'Mínimo 6 caracteres',
        'confirmarSenha': 'Confirme sua senha',
        'tipoTelhado': 'Selecione o tipo de telhado'
    };

    Object.entries(placeholders).forEach(([id, placeholder]) => {
        const element = document.getElementById(id);
        if (element) {
            element.placeholder = placeholder;
        }
    });

    // Adicionar toggle de senha para campos de senha
    addPasswordToggle('senha');
    if (document.getElementById('confirmarSenha')) {
        addPasswordToggle('confirmarSenha');
    }

    // Verifica se já está logado
    const token = localStorage.getItem('token');
    if (token && window.location.pathname.includes('index.html')) {
        window.location.href = 'dashboard.html';
    }

    // Form de Registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const senha = document.getElementById('senha').value;
            const confirmarSenha = document.getElementById('confirmarSenha').value;

            if (senha !== confirmarSenha) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'As senhas não coincidem!'
                });
                return;
            }

            const formData = {
                nomeCompleto: document.getElementById('nomeCompleto').value,
                email: document.getElementById('email').value,
                telefone: document.getElementById('telefone').value,
                senha: senha,
                tipoTelhado: document.getElementById('tipoTelhado').value,
                cep: document.getElementById('cep').value,
                numero: document.getElementById('numero').value
            };

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: 'Registro realizado com sucesso!'
                    }).then(() => {
                        window.location.href = 'dashboard.html';
                    });
                } else {
                    throw new Error(data.msg || 'Erro ao registrar');
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message
                });
            }
        });
    }

    // Form de Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
                email: document.getElementById('email').value,
                senha: document.getElementById('senha').value
            };

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    // Limpar qualquer token ou status anterior
                    localStorage.clear();
                    
                    // Salvar novos dados
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('isAdmin', data.isAdmin ? '1' : '0');

                    console.log('Login successful, isAdmin:', data.isAdmin);

                    // Redirecionar uma única vez
                    if (data.isAdmin) {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    throw new Error(data.msg || 'Erro ao fazer login');
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message
                });
            }
        });
    }

    // Adicionar função para buscar endereço pelo CEP
    function buscarEndereco(cep) {
        const cepLimpo = cep.replace(/\D/g, '');
        
        if (cepLimpo.length !== 8) return;

        fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
            .then(response => response.json())
            .then(data => {
                if (!data.erro) {
                    document.getElementById('rua').value = data.logradouro;
                    document.getElementById('bairro').value = data.bairro;
                    document.getElementById('cidade').value = data.localidade;
                    document.getElementById('estado').value = data.uf;
                    document.getElementById('numero').focus();
                }
            })
            .catch(error => console.error('Erro ao buscar CEP:', error));
    }

    // Adicionar evento para o campo de CEP
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('blur', () => buscarEndereco(cepInput.value));
    }
}); 