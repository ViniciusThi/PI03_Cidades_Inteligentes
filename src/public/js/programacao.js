document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const programacaoTable = document.getElementById('programacaoTable');
    const novaProgramacaoForm = document.getElementById('novaProgramacaoForm');
    const sistemaAtivo = document.getElementById('sistemaAtivo');

    // Carregar estado do sistema
    sistemaAtivo.checked = localStorage.getItem('sistemaIrrigacaoAtivo') === 'true';

    // Evento para salvar estado do sistema
    sistemaAtivo.addEventListener('change', (e) => {
        localStorage.setItem('sistemaIrrigacaoAtivo', e.target.checked);
    });

    // Carregar programações padrão
    async function carregarProgramacoesPadrao() {
        try {
            const response = await fetch('/api/programacao/carregar-padrao', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar programações padrão');
            }

            await carregarProgramacoes();

            Swal.fire({
                icon: 'success',
                title: 'Programações padrão carregadas!',
                text: 'As programações foram configuradas de acordo com seu tipo de telhado.'
            });
        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message
            });
        }
    }

    // Verificar se é primeira vez e carregar programações padrão
    const programacoesCarregadas = localStorage.getItem('programacoesCarregadas');
    if (!programacoesCarregadas) {
        carregarProgramacoesPadrao();
        localStorage.setItem('programacoesCarregadas', 'true');
    }

    // Carregar programações
    async function carregarProgramacoes() {
        try {
            const response = await fetch('/api/programacao', {
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar programações');
            }

            const programacoes = await response.json();
            programacaoTable.innerHTML = '';

            programacoes.forEach(prog => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${prog.diaSemana}</td>
                    <td>${prog.horario}</td>
                    <td>
                        <div class="form-check form-switch">
                            <input class="form-check-input prog-status" type="checkbox" 
                                data-id="${prog._id}" ${prog.ativo ? 'checked' : ''}>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deletarProgramacao('${prog._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;
                programacaoTable.appendChild(row);
            });

            // Adicionar eventos aos switches
            document.querySelectorAll('.prog-status').forEach(switch_ => {
                switch_.addEventListener('change', async (e) => {
                    const id = e.target.dataset.id;
                    const ativo = e.target.checked;

                    try {
                        const response = await fetch(`/api/programacao/${id}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-auth-token': token
                            },
                            body: JSON.stringify({ ativo })
                        });

                        if (!response.ok) {
                            throw new Error('Erro ao atualizar status');
                        }

                        Swal.fire({
                            icon: 'success',
                            title: 'Status atualizado!',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    } catch (error) {
                        console.error('Erro:', error);
                        e.target.checked = !ativo; // Reverter o switch
                        Swal.fire({
                            icon: 'error',
                            title: 'Erro',
                            text: error.message
                        });
                    }
                });
            });
        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message
            });
        }
    }

    // Adicionar nova programação
    novaProgramacaoForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            diaSemana: document.getElementById('diaSemana').value,
            horario: document.getElementById('horario').value
        };

        try {
            const response = await fetch('/api/programacao', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Erro ao adicionar programação');
            }

            Swal.fire({
                icon: 'success',
                title: 'Programação adicionada!',
                showConfirmButton: false,
                timer: 1500
            });

            novaProgramacaoForm.reset();
            carregarProgramacoes();
        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message
            });
        }
    });

    // Função para deletar programação
    window.deletarProgramacao = async (id) => {
        try {
            const result = await Swal.fire({
                title: 'Tem certeza?',
                text: "Esta ação não pode ser revertida!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sim, deletar!',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                const response = await fetch(`/api/programacao/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'x-auth-token': token
                    }
                });

                if (!response.ok) {
                    throw new Error('Erro ao deletar programação');
                }

                Swal.fire(
                    'Deletado!',
                    'A programação foi removida.',
                    'success'
                );

                carregarProgramacoes();
            }
        } catch (error) {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message
            });
        }
    };

    // Carregar programações iniciais
    carregarProgramacoes();

    // Logout com limpeza seletiva
    document.getElementById('btnLogout').addEventListener('click', () => {
        // Não limpar o estado do sistema de irrigação
        const sistemaAtivo = localStorage.getItem('sistemaIrrigacaoAtivo');
        const programacoesCarregadas = localStorage.getItem('programacoesCarregadas');
        
        localStorage.clear();
        
        // Restaurar estado do sistema
        localStorage.setItem('sistemaIrrigacaoAtivo', sistemaAtivo);
        localStorage.setItem('programacoesCarregadas', programacoesCarregadas);
        
        window.location.href = 'index.html';
    });
}); 