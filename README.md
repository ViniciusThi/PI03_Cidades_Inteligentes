<h1 align="center">PI03 Cidades Inteligentes - Sistema de Irrigação Inteligente</h1>

## Descrição do Projeto
Sistema web integrado com ESP32 para automação de irrigação em telhados verdes. O sistema permite o monitoramento em tempo real da umidade do solo, controle manual e automático da irrigação, programação de horários e análise de consumo de água e energia.

<p>Participantes:</p>
<ul>
  <li>Vinícius Santos Tibério</li>
  <li>Luan Rocha</li>
  <li>Lidiane Marques da Silva</li>
  <li>Mikelly Letran Plaça de Oliveira</li>
  <li>Micaella Letran Plaça de Oliveira</li>
  <li>José Victor Dias Rodrigues</li>
</ul>

### Características Principais
- Dashboard com monitoramento em tempo real
- Controle manual e automático da irrigação
- Programação semanal de irrigação
- Diferentes perfis baseados no tipo de telhado (intensivo, semi-intensivo, extensivo)
- Sistema automático baseado em sensores de umidade
- Interface responsiva e moderna

## Ferramentas
- Trelo: [Kanban do projeto](https://trello.com/b/Iawcvsdz/sistema-de-irriga%C3%A7%C3%A3o)
- Canvas: [Slides apresentação - GreenSystem](https://www.canva.com/design/DAGWfwGYtGU/E_X0rWK87MzV-wM1KVsrJQ/edit?utm_content=DAGWfwGYtGU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)
## Tecnologias Utilizadas

### Backend
- Node.js (v14+ recomendado)
- Express.js
- MongoDB
- Socket.IO
- JWT (JSON Web Tokens)
- Bcrypt.js
- CORS

### Frontend
- HTML5
- CSS3
- JavaScript (ES6+)
- Bootstrap 5
- SweetAlert2
- Chart.js


## Pré-requisitos

### Software
1. Node.js: [Download](https://nodejs.org/)
2. MongoDB: [Download](https://www.mongodb.com/try/download/community)
3. Arduino IDE: [Download](https://www.arduino.cc/en/software)
4. Visual Studio Code (ou editor de sua preferência): [Download](https://code.visualstudio.com/)
5. Git: [Download](https://git-scm.com/)

### Hardware
1. 2X Modulo DHT22 
2. Modulo Rele 1 canal 5V
3. Sensor de fluxo de vazao de agua YF-S401 
4. 2X Sensor de Umidade de solo capacitivo hd-38
5. Bomba de aquario HBO-300
6. Tubo de plastico de 1/4 de polegada de diametro 
7. Voltimetro Amperimetro Pzem-004t V3.0
8. ESP32 NodeMCU 

## Ligações Elétricas dos Componentes

### ESP32 NodeMCU - Pinagem
O ESP32 é o controlador central do sistema, abaixo estão os pinos utilizados para cada componente:

| Componente | Pino ESP32 | Descrição |
|------------|------------|-----------|
| DHT22 (Temperatura/Umidade) | GPIO32 | Pino de dados do sensor |
| Relé (Bomba d'água) | GPIO5 | Controle do relé |
| Sensor de Umidade do Solo | GPIO34 (ADC) | Leitura analógica do sensor |
| Sensor de Fluxo de Água | GPIO25 | Leitura de pulsos do sensor |
| PZEM-004T V3 (Energia) | GPIO16 (RX2) e GPIO17 (TX2) | Comunicação serial |

### Diagrama de Ligações

#### DHT22 (Sensor de Temperatura e Umidade)
- VCC: 3.3V do ESP32
- GND: GND do ESP32
- DATA: GPIO32 do ESP32

#### Relé (Controle da Bomba)
- VCC: 5V do ESP32 ou fonte externa 5V
- GND: GND do ESP32
- IN: GPIO5 do ESP32

#### Sensor de Umidade do Solo Capacitivo
- VCC: 3.3V do ESP32
- GND: GND do ESP32
- OUT (Analógico): GPIO34 do ESP32

#### Sensor de Fluxo de Água YF-S401
- VCC: 5V do ESP32
- GND: GND do ESP32
- Sinal (Pulsos): GPIO25 do ESP32

#### PZEM-004T V3 (Sensor de Energia)
- 5V: 5V do ESP32 (ou fonte externa)
- GND: GND do ESP32
- TX: GPIO16 (RX2) do ESP32
- RX: GPIO17 (TX2) do ESP32

**Atenção**: O PZEM-004T também deve ser conectado corretamente à rede elétrica para monitoramento. Siga as instruções do fabricante para conexão segura à rede elétrica.

#### Bomba de Aquário HBO-300
- Alimentação: Controlada pelo relé
- Fase: Conectada ao contato normalmente aberto (NO) do relé
- Neutro: Direto para a fonte de alimentação

### Recomendações de Segurança
1. **Sempre desconecte a alimentação antes de fazer qualquer alteração nas ligações.**
2. **Use uma fonte de alimentação adequada para o ESP32 e para a bomba d'água.**
3. **Isole adequadamente todas as conexões, especialmente aquelas próximas à água.**
4. **Utilize diodos de proteção nos relés para evitar correntes de retorno ao ESP32.**
5. **Para ligações em ambientes externos, use caixas à prova d'água para proteger os componentes eletrônicos.**

### Alimentação do Sistema
- ESP32: Alimentado via USB (5V) ou regulador de tensão externo
- Bomba d'água: Fonte separada, controlada pelo relé (verifique a especificação da bomba)
- Sensores: Alimentados diretamente pelo ESP32 (3.3V ou 5V conforme especificação)

Para mais detalhes sobre a pinagem do ESP32, consulte a [documentação oficial](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html).


