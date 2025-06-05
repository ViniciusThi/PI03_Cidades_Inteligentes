document.addEventListener('DOMContentLoaded', () => {
    // Verificar se é admin
    const isAdmin = localStorage.getItem('isAdmin') === '1';
    if (!isAdmin) {
        window.location.replace('index.html');
        return;
    }

    // Inicializar mapa quando o script do Google Maps estiver carregado
    if (window.google && window.google.maps) {
        initMap();
    }
});

let map;
let markers = [];
let infoWindows = [];

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -23.550520, lng: -46.633308 }, // São Paulo
        zoom: 10,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });
    carregarClientes();
}

async function carregarClientes() {
    try {
        console.log('Token:', localStorage.getItem('token')); // Debug
        const response = await fetch('/api/admin/clientes', {
            headers: {
                'x-auth-token': localStorage.getItem('token'),
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status); // Debug

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Erro ao carregar dados');
        }

        const clientes = await response.json();
        console.log('Clientes carregados:', clientes); // Debug
        await atualizarTabelaClientes(clientes);
        await atualizarMarcadores(clientes);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        if (error.message === 'Não autorizado' || error.message === 'Token inválido') {
            localStorage.clear();
            window.location.href = 'index.html';
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Erro ao carregar dados dos clientes'
            });
        }
    }
}

// Atualizar tabela de clientes
function atualizarTabelaClientes(clientes) {
    const tbody = document.getElementById('clientesTable');
    tbody.innerHTML = '';

    clientes.forEach(cliente => {
        const row = document.createElement('tr');
        const ultimaAtividade = cliente.ultimaAtividade ? 
            new Date(cliente.ultimaAtividade).toLocaleString() : 
            'Nunca ativo';

        row.innerHTML = `
            <td>${cliente.nomeCompleto}</td>
            <td>${cliente.email}</td>
            <td>${cliente.telefone || '-'}</td>
            <td>${cliente.rua}, ${cliente.numero} - ${cliente.cidade}/${cliente.estado}</td>
            <td>${cliente.tipoTelhado}</td>
            <td>
                <span class="status-indicator ${cliente.equipamentoConectado ? 'status-active' : 'status-inactive'}"></span>
                ${cliente.equipamentoConectado ? 'Conectado' : 'Desconectado'}
            </td>
            <td>
                <span class="status-indicator ${getStatusClass(cliente.status)}"></span>
                ${cliente.status}
            </td>
            <td>${ultimaAtividade}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="verDetalhes(${cliente.id})">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getStatusClass(status) {
    switch(status) {
        case 'online':
            return 'status-active';
        case 'irrigando':
            return 'status-irrigating';
        default:
            return 'status-inactive';
    }
}

// Atualizar marcadores no mapa
async function atualizarMarcadores(clientes) {
    // Limpar marcadores existentes
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Centralizar mapa no Brasil
    map.setCenter({ lat: -15.7801, lng: -47.9292 });
    map.setZoom(4);

    // Adicionar novos marcadores
    for (const cliente of clientes) {
        try {
            const position = await getLatLng(cliente.enderecoCompleto);
            
            const marker = new google.maps.Marker({
                position,
                map,
                title: cliente.nomeCompleto,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: cliente.sistemaAtivo ? '#28a745' : '#dc3545',
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: '#ffffff',
                    scale: 10
                }
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px;">
                        <h6 style="margin-bottom: 5px;">${cliente.nomeCompleto}</h6>
                        <p style="margin: 2px 0;"><strong>Status:</strong> ${cliente.sistemaAtivo ? 'Ativo' : 'Inativo'}</p>
                        <p style="margin: 2px 0;"><strong>Tipo:</strong> ${cliente.tipoTelhado}</p>
                        <p style="margin: 2px 0;"><strong>Endereço:</strong> ${cliente.enderecoCompleto}</p>
                        ${cliente.dadosSensor ? `
                            <p style="margin: 2px 0;"><strong>Umidade:</strong> ${cliente.dadosSensor.umidadeSolo}%</p>
                        ` : ''}
                    </div>
                `
            });

            marker.addListener('click', () => {
                // Fechar outras janelas de info abertas
                infoWindows.forEach(iw => iw.close());
                infoWindow.open(map, marker);
            });

            markers.push(marker);
            infoWindows.push(infoWindow);
        } catch (error) {
            console.error(`Erro ao geocodificar endereço para ${cliente.nomeCompleto}:`, error);
        }
    }

    // Ajustar zoom para mostrar todos os marcadores se houver marcadores
    if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
    }
}

// Função para converter endereço em coordenadas
async function getLatLng(endereco) {
    const geocoder = new google.maps.Geocoder();
    
    return new Promise((resolve, reject) => {
        geocoder.geocode({ address: endereco }, (results, status) => {
            if (status === 'OK') {
                resolve(results[0].geometry.location);
            } else {
                reject(new Error('Geocoding failed'));
            }
        });
    });
}

// Ver detalhes do cliente
async function verDetalhes(clienteId) {
    try {
        const response = await fetch(`/api/admin/cliente/${clienteId}`, {
            headers: {
                'x-auth-token': localStorage.getItem('token')
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar detalhes');

        const cliente = await response.json();
        const ultimaAtividade = cliente.ultimaAtividade ? 
            new Date(cliente.ultimaAtividade).toLocaleString() : 
            'Nunca ativo';

        Swal.fire({
            title: cliente.nomeCompleto,
            html: `
                <div class="text-start">
                    <p><strong>Email:</strong> ${cliente.email}</p>
                    <p><strong>Telefone:</strong> ${cliente.telefone || '-'}</p>
                    <p><strong>Endereço:</strong> ${cliente.rua}, ${cliente.numero}</p>
                    <p><strong>Cidade:</strong> ${cliente.cidade}/${cliente.estado}</p>
                    <p><strong>Tipo de Telhado:</strong> ${cliente.tipoTelhado}</p>
                    <p><strong>Status:</strong> ${cliente.sistemaAtivo ? 'Ativo' : 'Inativo'}</p>
                    <p><strong>Última Atividade:</strong> ${ultimaAtividade}</p>
                    ${cliente.sensorData ? `
                        <hr>
                        <p><strong>Umidade do Solo:</strong> ${cliente.sensorData.umidadeSolo}%</p>
                        <p><strong>Consumo de Água:</strong> ${cliente.sensorData.consumoAgua}L</p>
                        <p><strong>Consumo de Energia:</strong> ${cliente.sensorData.consumoEnergia}kWh</p>
                    ` : ''}
                </div>
            `,
            width: '600px'
        });
    } catch (error) {
        console.error('Erro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Erro ao carregar detalhes do cliente'
        });
    }
}

// Atualizar dados a cada 30 segundos
setInterval(carregarClientes, 30000);

// Logout
document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}); 