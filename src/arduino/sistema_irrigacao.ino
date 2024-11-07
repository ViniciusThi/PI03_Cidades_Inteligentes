#include <SPI.h>
#include <Ethernet.h>

// Configurações de rede (IP Fixo)
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };
IPAddress ip(192, 168, 0, 111);        // IP fixo do Arduino
IPAddress gateway(192, 168, 0, 1);     // Gateway da sua rede
IPAddress subnet(255, 255, 255, 0);      // Máscara de sub-rede        // DNS
EthernetServer server(80);

// Pinos
const int SENSOR_UMIDADE = A0;    // Sensor de umidade do solo
const int RELE_BOMBA = 8;         // Relé para controle da bomba d'água

// Variáveis globais
bool irrigacaoAtiva = false;
bool irrigacaoManual = false;  // Nova variável para controle manual
int umidadeSolo = 0;
bool servidorPronto = false;
bool clienteConectado = false;
unsigned long ultimaLeitura = 0;
const unsigned long INTERVALO_LEITURA = 10000; // 10 segundos
unsigned long ultimaVerificacao = 0;
const unsigned long INTERVALO_VERIFICACAO = 1000; // 1 segundo

// Adicionar variáveis para controle de conexão
unsigned long ultimaAtividade = 0;
const unsigned long TEMPO_INATIVIDADE = 300000; // 5 minutos em milissegundos
bool sistemaAtivo = true;

// Constantes para controle de umidade
const int UMIDADE_MINIMA = 25;
const int UMIDADE_MAXIMA = 80;
const int UMIDADE_BLOQUEIO = 60;
const unsigned long TEMPO_IRRIGACAO = 120000; // 2 minutos em milissegundos
unsigned long inicioIrrigacao = 0;

void setup() {
    Serial.begin(9600);
    Serial.println("\nIniciando Sistema de Irrigação...");
    
    // Configurar pinos
    pinMode(RELE_BOMBA, OUTPUT);
    digitalWrite(RELE_BOMBA, LOW);
    Serial.println("Relé da bomba: DESLIGADO");
    
    // Inicializar Ethernet
    inicializarRede();
}

void inicializarRede() {
    Serial.println("Configurando rede com IP fixo...");
    Ethernet.begin(mac, ip, gateway, subnet);
    delay(2000); // Aguardar estabilização

    if (Ethernet.hardwareStatus() == EthernetNoHardware) {
        Serial.println("Erro: Shield Ethernet não encontrado!");
        while (true) {
            delay(1000);
        }
    }

    if (Ethernet.linkStatus() == LinkOFF) {
        Serial.println("Erro: Cabo Ethernet não conectado!");
        while (Ethernet.linkStatus() == LinkOFF) {
            Serial.println("Aguardando conexão do cabo...");
            delay(1000);
        }
    }

    server.begin();
    Serial.print("Servidor iniciado em: ");
    Serial.println(Ethernet.localIP());
    servidorPronto = true;
    clienteConectado = false;  // Inicialmente desconectado
    pararTodasOperacoes();
    printSystemStatus();
}

void pararTodasOperacoes() {
    irrigacaoAtiva = false;
    digitalWrite(RELE_BOMBA, LOW);
    Serial.println("Sistema em espera - Aguardando conexão do cliente");
}

void printSystemStatus() {
    Serial.println("\n=== Status do Sistema ===");
    Serial.print("IP: ");
    Serial.println(Ethernet.localIP());
    Serial.print("Status da Rede: ");
    Serial.println(Ethernet.linkStatus() == LinkON ? "Conectado" : "Desconectado");
    Serial.print("Cliente: ");
    Serial.println(clienteConectado ? "Conectado" : "Desconectado");
    Serial.print("Bomba: ");
    Serial.println(irrigacaoAtiva ? "LIGADA" : "DESLIGADA");
    Serial.print("Modo: ");
    Serial.println(irrigacaoManual ? "MANUAL" : "AUTOMÁTICO");
    Serial.print("Umidade do Solo: ");
    Serial.print(umidadeSolo);
    Serial.println("%");
    Serial.println("=======================\n");
}

void processarRequisicao(EthernetClient& client) {
    String currentLine = "";
    String requestLine = "";
    unsigned long timeout = millis();
    
    while (client.connected() && millis() - timeout < 2000) {
        if (client.available()) {
            char c = client.read();
            
            if (requestLine == "" && c == '\n') {
                requestLine = currentLine;
                currentLine = "";
            } else if (c == '\n') {
                if (currentLine.length() == 0) {
                    ultimaAtividade = millis(); // Atualiza o timestamp da última atividade
                    
                    if (requestLine.indexOf("OPTIONS") >= 0) {
                        enviarRespostaCORS(client);
                        Serial.println("Respondendo OPTIONS");
                    } else if (requestLine.indexOf("GET /status") >= 0) {
                        Serial.println("Requisição de status recebida");
                        enviarStatus(client);
                    } else if (requestLine.indexOf("GET /leituras") >= 0) {
                        enviarLeituras(client);
                    } else if (requestLine.indexOf("POST /irrigar") >= 0) {
                        ativarIrrigacao(client);
                    } else if (requestLine.indexOf("POST /parar") >= 0) {
                        pararIrrigacao(client);
                    } else if (requestLine.indexOf("POST /desconectar") >= 0) {
                        clienteConectado = false;
                        pararTodasOperacoes();
                        enviarRespostaJSON(client, "{\"status\":\"desconectado\"}");
                        Serial.println("Cliente desconectado manualmente");
                    } else {
                        Serial.println("Requisição desconhecida");
                        enviarRespostaJSON(client, "{\"error\":\"Requisição inválida\"}");
                    }
                    break;
                } else {
                    currentLine = "";
                }
            } else if (c != '\r') {
                currentLine += c;
            }
            timeout = millis();
        }
    }
    
    delay(10);
    client.flush();
    client.stop();
}

void enviarRespostaCORS(EthernetClient& client) {
    client.println("HTTP/1.1 200 OK");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    client.println("Access-Control-Allow-Headers: Content-Type, x-auth-token");
    client.println("Access-Control-Max-Age: 86400");
    client.println("Content-Length: 0");
    client.println();
    client.flush();
}

void enviarStatus(EthernetClient& client) {
    String response = "{\"status\":\"online\",\"irrigacao\":" + 
                     String(irrigacaoAtiva ? "true" : "false") + 
                     ",\"umidade\":" + String(umidadeSolo) + "}";
    
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    client.println("Access-Control-Allow-Headers: Content-Type, x-auth-token");
    client.println("Connection: close");
    client.println("Content-Length: " + String(response.length()));
    client.println();
    client.println(response);
    
    Serial.println("Enviando status: " + response);
    client.flush();
}

void enviarLeituras(EthernetClient& client) {
    umidadeSolo = map(analogRead(SENSOR_UMIDADE), 0, 1023, 0, 100);
    String response = "{\"umidade\":" + String(umidadeSolo) + 
                     ",\"irrigando\":" + String(irrigacaoAtiva ? "true" : "false") + 
                     ",\"modoManual\":" + String(irrigacaoManual ? "true" : "false") + 
                     ",\"bloqueado\":" + String(umidadeSolo >= UMIDADE_BLOQUEIO ? "true" : "false") + "}";
    enviarRespostaJSON(client, response);
    Serial.println("Leituras enviadas ao cliente");
}

void ativarIrrigacao(EthernetClient& client) {
    // Modo manual ignora verificações de umidade
    irrigacaoManual = true;
    irrigacaoAtiva = true;
    digitalWrite(RELE_BOMBA, HIGH);
    String response = "{\"status\":\"irrigando\",\"modo\":\"manual\"}";
    enviarRespostaJSON(client, response);
    Serial.println("Irrigação MANUAL ATIVADA");
    printSystemStatus();
}

void pararIrrigacao(EthernetClient& client) {
    irrigacaoManual = false;  // Desativa modo manual
    irrigacaoAtiva = false;
    digitalWrite(RELE_BOMBA, LOW);
    String response = "{\"status\":\"parado\"}";
    enviarRespostaJSON(client, response);
    Serial.println("Irrigação DESATIVADA");
    Serial.println("Relé da bomba: DESLIGADO");
    printSystemStatus();
}

void enviarRespostaJSON(EthernetClient& client, String content) {
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Connection: close");
    client.println("Content-Length: " + String(content.length()));
    client.println();
    client.print(content); // Usa print em vez de println para o conteúdo
    client.flush(); // Garante que todos os dados sejam enviados
}

void enviarDadosSensor() {
    if (millis() - ultimaLeitura >= INTERVALO_LEITURA) {
        umidadeSolo = map(analogRead(SENSOR_UMIDADE), 0, 1023, 0, 100);
        Serial.print("Leitura periódica - Umidade: ");
        Serial.print(umidadeSolo);
        Serial.println("%");
        ultimaLeitura = millis();
    }
}

void verificarComandos() {
    if (millis() - ultimaVerificacao >= INTERVALO_VERIFICACAO) {
        EthernetClient client = server.available();
        if (client) {
            processarRequisicao(client);
        }
        ultimaVerificacao = millis();
    }
}

void verificarUmidade() {
    umidadeSolo = map(analogRead(SENSOR_UMIDADE), 0, 1023, 0, 100);
    
    // Só executa o controle automático se não estiver em modo manual
    if (!irrigacaoManual) {
        // Se a irrigação está ativa, verifica se deve parar
        if (irrigacaoAtiva) {
            if (umidadeSolo >= UMIDADE_MAXIMA || 
                (millis() - inicioIrrigacao >= TEMPO_IRRIGACAO && inicioIrrigacao != 0)) {
                pararIrrigacaoAutomatica();
            }
        } 
        // Se não está irrigando, verifica se deve começar
        else if (umidadeSolo <= UMIDADE_MINIMA && umidadeSolo < UMIDADE_BLOQUEIO) {
            iniciarIrrigacaoAutomatica();
        }
    }
}

void iniciarIrrigacaoAutomatica() {
    irrigacaoAtiva = true;
    digitalWrite(RELE_BOMBA, HIGH);
    inicioIrrigacao = millis();
    Serial.println("Irrigação automática ATIVADA");
    Serial.print("Umidade atual: ");
    Serial.print(umidadeSolo);
    Serial.println("%");
    printSystemStatus();
}

void pararIrrigacaoAutomatica() {
    irrigacaoAtiva = false;
    digitalWrite(RELE_BOMBA, LOW);
    inicioIrrigacao = 0;
    Serial.println("Irrigação automática DESATIVADA");
    Serial.print("Umidade atual: ");
    Serial.print(umidadeSolo);
    Serial.println("%");
    printSystemStatus();
}

void loop() {
    if (!servidorPronto || Ethernet.linkStatus() == LinkOFF) {
        Serial.println("Reconectando...");
        inicializarRede();
        delay(1000);
        return;
    }

    // Verificar umidade e regras de irrigação
    verificarUmidade();

    // Sempre verifica por novos clientes
    EthernetClient client = server.available();
    if (client) {
        Serial.println("\nNovo cliente conectado");
        processarRequisicao(client);
    }

    // Atualizar leituras periodicamente
    if (millis() - ultimaLeitura >= INTERVALO_LEITURA) {
        Serial.print("Leitura periódica - Umidade: ");
        Serial.print(umidadeSolo);
        Serial.println("%");
        ultimaLeitura = millis();
    }
} 