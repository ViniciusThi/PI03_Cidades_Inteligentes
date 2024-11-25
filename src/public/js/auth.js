window.addEventListener('load', () => {
    console.log('Status atual:');
    console.log('Token:', localStorage.getItem('token'));
    console.log('IsAdmin:', localStorage.getItem('isAdmin'));
    console.log('Pathname:', window.location.pathname);

    // Verificar e redirecionar se necessário
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === '1';
    
    if (token) {
        if (isAdmin) {
            window.location.replace('admin.html');
        } else {
            window.location.replace('dashboard.html');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Função para alternar visibilidade da senha
    const setupPasswordToggle = () => {
        document.querySelectorAll('.password-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                const input = e.target.closest('.input-group').querySelector('input');
                const icon = e.target.closest('.password-toggle').querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('bi-eye');
                    icon.classList.add('bi-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('bi-eye-slash');
                    icon.classList.add('bi-eye');
                }
            });
        });
    };

    // Função para validar requisitos da senha
    const setupPasswordValidation = () => {
        const senhaInput = document.getElementById('senha');
        if (!senhaInput) return;

        const requirements = {
            length: { regex: /.{8,16}/, element: document.getElementById('req-length') },
            lowercase: { regex: /[a-z]/, element: document.getElementById('req-lowercase') },
            uppercase: { regex: /[A-Z]/, element: document.getElementById('req-uppercase') },
            number: { regex: /[0-9]/, element: document.getElementById('req-number') },
            special: { regex: /[@$!%*?&]/, element: document.getElementById('req-special') }
        };

        const updateRequirement = (element, valid) => {
            if (!element) return;
            const icon = element.querySelector('i');
            icon.classList.remove(valid ? 'bi-x-circle' : 'bi-check-circle');
            icon.classList.remove(valid ? 'text-danger' : 'text-success');
            icon.classList.add(valid ? 'bi-check-circle' : 'bi-x-circle');
            icon.classList.add(valid ? 'text-success' : 'text-danger');
        };

        senhaInput.addEventListener('input', () => {
            const senha = senhaInput.value;
            
            Object.entries(requirements).forEach(([key, requirement]) => {
                const valid = requirement.regex.test(senha);
                updateRequirement(requirement.element, valid);
            });
        });
    };

    // Adicionar placeholders aos campos
    const placeholders = {
        'nomeCompleto': 'Ex: João da Silva',
        'email': 'Ex: joao@email.com',
        'telefone': 'Ex: (11) 99999-9999',
        'senha': 'Min 8 e max 16 caracteres: letras, números e caracteres especiais',
        'confirmarSenha': 'Confirme sua senha',
        'tipoTelhado': 'Selecione o tipo de telhado'
    };

    Object.entries(placeholders).forEach(([id, placeholder]) => {
        const element = document.getElementById(id);
        if (element) {
            element.placeholder = placeholder;
        }
    });

    // Verificar estado atual do login e redirecionar se necessário
    const currentToken = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === '1';
    const currentPath = window.location.pathname;

    if (currentToken) {
        if (currentPath === '/' || currentPath === '/index.html') {
            if (isAdmin) {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        }
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

            console.log('Tentando login com:', formData.email);

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                console.log('Resposta do servidor:', data);

                if (!response.ok) {
                    throw new Error(data.msg || 'Erro ao fazer login');
                }

                // Limpar qualquer token ou status anterior
                localStorage.clear();
                
                // Salvar novos dados
                localStorage.setItem('token', data.token);
                localStorage.setItem('isAdmin', data.isAdmin ? '1' : '0');

                console.log('Login successful, isAdmin:', data.isAdmin);

                // Redirecionar baseado no tipo de usuário
                if (data.isAdmin) {
                    console.log('Redirecionando para admin.html');
                    window.location.href = '/admin.html';
                } else {
                    console.log('Redirecionando para dashboard.html');
                    window.location.href = '/dashboard.html';
                }

            } catch (error) {
                console.error('Erro no login:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message
                });
            }
        });
    }

    // Form de Registro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const senha = document.getElementById('senha').value;
            const confirmarSenha = document.getElementById('confirmarSenha').value;

            // Validação de senha
            const senhaRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
            
            if (!senhaRegex.test(senha)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Senha Inválida',
                    text: 'A senha deve ter entre 8 e 16 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.'
                });
                return;
            }

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
                tipoTelhado: document.getElementById('tipoTelhado').value.toLowerCase(),
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

    // Inicializar funcionalidades
    setupPasswordToggle();
    setupPasswordValidation();

    // Adicionar evento para o campo de CEP
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('blur', () => {
            const cepLimpo = cepInput.value.replace(/\D/g, '');
            if (cepLimpo.length === 8) {
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
        });
    }
}); 