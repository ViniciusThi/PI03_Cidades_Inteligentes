document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const programacaoTable = document.getElementById('programacaoTable');
    const novaProgramacaoForm = document.getElementById('novaProgramacaoForm');
    const sistemaAtivo = document.getElementById('sistemaAtivo');

    // Função para configurar eventos dos switches
    function setupSwitchEvents() {
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

            if (programacoes.length === 0) {
                // Mostrar mensagem de carregamento
                Swal.fire({
                    title: 'Carregando programações...',
                    text: 'Configurando sua programação inicial baseada no seu tipo de telhado',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                // Recarregar após 2 segundos
                setTimeout(carregarProgramacoes, 2000);
                return;
            }

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

            // Configurar eventos dos switches
            setupSwitchEvents();
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
    if (novaProgramacaoForm) {
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
    }

    // Função para deletar programação (precisa ser global)
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
}); 