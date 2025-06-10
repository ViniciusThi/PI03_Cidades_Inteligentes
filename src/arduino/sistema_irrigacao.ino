#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient_Generic.h>
#include <DHT22.h>
#include <time.h>

// Configurações de WiFi
const char* ssid = "dlink";           // Nome da sua rede WiFi (3G do celular)
const char* password = "661705550232"; // Senha da sua rede WiFi

// Endereço do servidor
const char* serverUrl = "18.231.177.75"; // Seu servidor Node.js
const int serverPort = 5000;              // Porta do servidor
const char* wsPath = "/ws/arduino";       // Caminho do WebSocket

// Pinos
const int RELE_BOMBA = 23;         // Relé para controle da bomba d'água (GPIO23)
const int SENSOR_UMIDADE_SOLO = 34; // Sensor de umidade do solo (ADC)
const int DHTPIN = 32;             // Pino de dados do DHT22

// Configurações de NTP
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = -3 * 3600;  // GMT-3 para horário de Brasília
const int   daylightOffset_sec = 0;

// Configurações do sistema
struct Timer {
    int horaInicio;
    int minutoInicio;
    int duracao;
    bool ativo;
};

struct ConfiguracaoTelhado {
    String tipo;
    int umidadeMinima;
    int umidadeMaxima;
    Timer timers[3];
};

// Variáveis globais
bool irrigacaoAtiva = false;
bool sistemaAutomatico = true; // Começa em automático por padrão
unsigned long ultimoEnvioHeartbeat = 0;
const unsigned long intervaloHeartbeat = 60000; // 60 segundos
unsigned long ultimoEnvioDadosSensores = 0;
const unsigned long intervaloDadosSensores = 10000; // 10 segundos
unsigned long ultimoTesteServidor = 0;
const unsigned long intervaloTesteServidor = 30000; // 30 segundos
String meuIP = "";
int falhasConsecutivas = 0;
const int maxFalhasConsecutivas = 5;
String userId = ""; // ID do usuário proprietário deste dispositivo
String tipoTelhado = ""; // Tipo do telhado (intensivo, semi-intensivo, extensivo)
ConfiguracaoTelhado configAtual;

// Objetos
WiFiServer server(80);
WebSocketsClient webSocket;
DHT22 dht(DHTPIN);

// Variáveis para armazenar leituras dos sensores
float temperatura = 0;
float umidade = 0;
int umidadeSolo = 0;

// Configurações de timeout e reconexão
const unsigned long WS_TIMEOUT = 30000;        // 30 segundos timeout para WebSocket
const unsigned long RECONNECT_INTERVAL = 5000;  // 5 segundos entre tentativas de reconexão
const unsigned long HEARTBEAT_INTERVAL = 60000; // 60 segundos entre heartbeats
const unsigned long SENSOR_INTERVAL = 10000;    // 10 segundos entre leituras de sensores
unsigned long lastReconnectAttempt = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
bool wsConnected = false;

// Configuração do relé
const bool RELE_ATIVO_BAIXO = false; // Mudando para lógica normal (HIGH para ligar)

void setup() {
    Serial.begin(115200);
    delay(1000); // Aguarda a inicialização do monitor serial
    Serial.println("\nIniciando Sistema de Irrigação...");
    
    // Inicializa pinos
    pinMode(RELE_BOMBA, OUTPUT);
    digitalWrite(RELE_BOMBA, LOW); // Começa desligado
    irrigacaoAtiva = false;
    
    // Teste inicial do relé
    Serial.println("\n=== TESTE INICIAL DO RELÉ ===");
    Serial.println("Desligando relé...");
    desligarRele();
    delay(2000);
    
    Serial.println("Ligando relé...");
    ligarRele();
    delay(2000);
    
    Serial.println("Desligando relé novamente...");
    desligarRele();
    delay(2000);
    Serial.println("=== TESTE CONCLUÍDO ===\n");
    
    pinMode(SENSOR_UMIDADE_SOLO, INPUT);
    
    // Inicializa o DHT22 - não precisa de begin(), a biblioteca já inicializa no construtor
    Serial.println("DHT22 inicializado");
    
    // Faz uma leitura inicial para testar o sensor
    float temp = dht.getTemperature();
    float hum = dht.getHumidity();
    if (isnan(temp) || isnan(hum)) {
        Serial.println("Falha ao ler o DHT22!");
    } else {
        Serial.println("DHT22 funcionando corretamente");
        Serial.println("Temperatura inicial: " + String(temp) + "°C");
        Serial.println("Umidade inicial: " + String(hum) + "%");
    }
    
    // Conecta ao WiFi
    setupWiFi();
    
    // Configura o servidor de tempo
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    Serial.println("NTP configurado");
    
    // Aguarda a primeira sincronização do tempo
    struct tm timeinfo;
    if(!getLocalTime(&timeinfo)){
        Serial.println("Falha ao obter tempo");
    } else {
        Serial.println("Tempo sincronizado");
        char timeStringBuff[50];
        strftime(timeStringBuff, sizeof(timeStringBuff), "%A, %B %d %Y %H:%M:%S", &timeinfo);
        Serial.println(timeStringBuff);
    }
    
    // Inicia o servidor HTTP
    server.begin();
    Serial.println("Servidor HTTP iniciado na porta 80");
    
    // Configura e conecta ao WebSocket
    setupWebSocket();
    
    // Faz leituras iniciais dos sensores
    lerSensores();
    
    // Envia um heartbeat inicial para o servidor após 5 segundos
    delay(5000);
    enviarHeartbeatServidor();
}

void setupWiFi() {
    Serial.print("Conectando ao WiFi");
    
    // Desconecta de qualquer conexão anterior
    WiFi.disconnect(true);
    delay(1000);
    
    WiFi.mode(WIFI_STA); // Define explicitamente o modo como estação
    delay(1000);
    
    WiFi.begin(ssid, password);
    
    int tentativas = 0;
    while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
        delay(500);
        Serial.print(".");
        tentativas++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        falhasConsecutivas = 0; // Reseta contador de falhas
        meuIP = WiFi.localIP().toString();
        Serial.println("\n========== INFORMAÇÕES DO DISPOSITIVO ==========");
        Serial.println("Status: Conectado ao WiFi!");
        Serial.println("----------------------------------------");
        Serial.println("IP: " + meuIP);
        Serial.println("MAC: " + WiFi.macAddress());
        Serial.println("----------------------------------------");
        Serial.println("Gateway: " + WiFi.gatewayIP().toString());
        Serial.println("Máscara: " + WiFi.subnetMask().toString());
        Serial.println("DNS: " + WiFi.dnsIP().toString());
        Serial.println("==============================================\n");
        
        // Teste de conectividade com o servidor AWS
        String httpUrl = "http://" + String(serverUrl) + ":" + String(serverPort);
        Serial.print("Testando conectividade com o servidor AWS... ");
        if (testarConexao(httpUrl)) {
            Serial.println("OK!");
        } else {
            Serial.println("Falha! Continuando mesmo assim...");
        }
    } else {
        falhasConsecutivas++;
        Serial.println("\nFalha ao conectar ao WiFi. Tentativa " + String(falhasConsecutivas));
        
        if (falhasConsecutivas >= maxFalhasConsecutivas) {
            Serial.println("Número máximo de falhas atingido. Reiniciando...");
            ESP.restart();
        }
    }
}

void setupWebSocket() {
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Configurando WebSocket...");
        
        // Configura o WebSocket com o caminho completo incluindo o MAC
        String macAddress = WiFi.macAddress();
        String fullPath = String(wsPath) + "?mac=" + macAddress;
        
        // Mudando para conexão não-SSL
        webSocket.begin(serverUrl, serverPort, fullPath.c_str());
        webSocket.onEvent(webSocketEvent);
        webSocket.setReconnectInterval(5000); // Reduzindo para 5 segundos
        webSocket.enableHeartbeat(15000, 3000, 2);
        
        Serial.println("WebSocket configurado!");
        Serial.print("Servidor: ");
        Serial.println(serverUrl);
        Serial.print("Porta: ");
        Serial.println(serverPort);
        Serial.print("Caminho: ");
        Serial.println(fullPath);
    } else {
        Serial.println("WiFi não conectado. Não é possível configurar WebSocket.");
    }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("WebSocket desconectado!");
            Serial.println("Tentando reconectar...");
            wsConnected = false;
            break;
            
        case WStype_CONNECTED:
            Serial.println("WebSocket conectado!");
            Serial.println("Enviando informações do dispositivo...");
            wsConnected = true;
            enviarInfoDispositivo();
            break;
            
        case WStype_TEXT:
            Serial.println("Recebido do WebSocket: ");
            Serial.write(payload, length);
            Serial.println();
            processarMensagemWebSocket((char*)payload);
            break;
            
        case WStype_ERROR:
            Serial.println("Erro no WebSocket!");
            Serial.print("Código do erro: ");
            Serial.println((char*)payload);
            wsConnected = false;
            break;
            
        case WStype_PING:
            Serial.println("Recebido ping");
            break;
            
        case WStype_PONG:
            Serial.println("Recebido pong");
            break;
    }
}

void enviarInfoDispositivo() {
    if (!wsConnected) {
        Serial.println("WebSocket não conectado. Tentando reconectar...");
        return;
    }

    StaticJsonDocument<512> doc;
    doc["type"] = "info";
    doc["mac"] = WiFi.macAddress();
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI(); // Força do sinal WiFi
    doc["versao"] = "2.0.0";
    
    String msg;
    serializeJson(doc, msg);
    
    webSocket.sendTXT(msg);
    Serial.println("Informações do dispositivo enviadas");
}

void processarMensagemWebSocket(String mensagem) {
    Serial.println("Processando mensagem WebSocket: " + mensagem);
    
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, mensagem);
    
    if (error) {
        Serial.print("Erro ao parsear JSON: ");
        Serial.println(error.c_str());
        return;
    }
    
    String tipo = doc["type"];
    Serial.println("Tipo da mensagem: " + tipo);
    
    if (tipo == "config") {
        // Atualiza o ID do usuário e tipo de telhado
        if (doc.containsKey("userId")) {
            userId = doc["userId"].as<String>();
            Serial.println("ID do usuário atualizado: " + userId);
        }
        if (doc.containsKey("tipoTelhado")) {
            tipoTelhado = doc["tipoTelhado"].as<String>();
            Serial.println("Tipo de telhado atualizado: " + tipoTelhado);
            
            // Atualiza configurações baseadas no tipo de telhado
            if (tipoTelhado == "intensivo") {
                configAtual.umidadeMinima = 40;
                configAtual.umidadeMaxima = 80;
            } else if (tipoTelhado == "semi-intensivo") {
                configAtual.umidadeMinima = 30;
                configAtual.umidadeMaxima = 70;
            } else if (tipoTelhado == "extensivo") {
                configAtual.umidadeMinima = 20;
                configAtual.umidadeMaxima = 60;
            }
        }
        
        // Processa configurações de timer se presentes
        if (doc.containsKey("timers")) {
            JsonArray timers = doc["timers"];
            int i = 0;
            for (JsonObject timer : timers) {
                if (i < 3) { // Máximo de 3 timers
                    configAtual.timers[i].horaInicio = timer["horaInicio"] | 0;
                    configAtual.timers[i].minutoInicio = timer["minutoInicio"] | 0;
                    configAtual.timers[i].duracao = timer["duracao"] | 0;
                    configAtual.timers[i].ativo = timer["ativo"] | false;
                    i++;
                }
            }
            Serial.println("Timers atualizados");
        }
    } 
    else if (tipo == "comando") {
        String comando = doc["comando"];
        Serial.println("Comando recebido: " + comando);
        
        if (comando == "irrigar") {
            Serial.println("Iniciando irrigação...");
            ativarIrrigacao();
            // Confirma recebimento do comando
            StaticJsonDocument<100> response;
            response["type"] = "comando_recebido";
            response["comando"] = "irrigar";
            response["status"] = "success";
            
            String msg;
            serializeJson(response, msg);
            webSocket.sendTXT(msg);
        } 
        else if (comando == "parar") {
            Serial.println("Parando irrigação...");
            pararIrrigacao();
            // Confirma recebimento do comando
            StaticJsonDocument<100> response;
            response["type"] = "comando_recebido";
            response["comando"] = "parar";
            response["status"] = "success";
            
            String msg;
            serializeJson(response, msg);
            webSocket.sendTXT(msg);
        } 
        else if (comando == "automatico") {
            bool estado = doc["estado"];
            Serial.println("Alterando modo automático para: " + String(estado));
            toggleAutomatico(estado);
            // Confirma recebimento do comando
            StaticJsonDocument<100> response;
            response["type"] = "comando_recebido";
            response["comando"] = "automatico";
            response["status"] = "success";
            
            String msg;
            serializeJson(response, msg);
            webSocket.sendTXT(msg);
        }
    }
}

void enviarDadosServidor() {
    if (!wsConnected) {
        return; // Não tenta enviar se não estiver conectado
    }

    StaticJsonDocument<512> doc;
    doc["type"] = "sensor_data";
    doc["mac"] = WiFi.macAddress();
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["userId"] = userId;
    doc["tipoTelhado"] = tipoTelhado;
    doc["temperatura"] = temperatura;
    doc["umidade"] = umidade;
    doc["umidadeSolo"] = umidadeSolo;
    doc["irrigacaoAtiva"] = irrigacaoAtiva;
    doc["automatico"] = sistemaAutomatico;
    
    String msg;
    serializeJson(doc, msg);
    
    webSocket.sendTXT(msg);
    Serial.println("Dados enviados via WebSocket");
}

void lerSensores() {
    Serial.println("\nLeitura dos sensores:");
    
    // Lê temperatura e umidade do DHT22
    temperatura = dht.getTemperature();
    umidade = dht.getHumidity();
    
    // Lê umidade do solo
    int valorBruto = analogRead(SENSOR_UMIDADE_SOLO);
    umidadeSolo = map(valorBruto, 4095, 0, 0, 100); // Inverte a escala e converte para porcentagem
    
    // Exibe as leituras
    Serial.println("Temperatura: " + String(temperatura) + "°C");
    Serial.println("Umidade do ar: " + String(umidade) + "%");
    Serial.println("Umidade do solo: " + String(umidadeSolo) + "%");
    
    // Exibe informações do dispositivo
    Serial.println("\nInformações do dispositivo:");
    Serial.println("IP: " + WiFi.localIP().toString());
    Serial.println("MAC: " + WiFi.macAddress());
    Serial.println("Status WebSocket: " + String(wsConnected ? "Conectado" : "Desconectado"));
    
    // Controle automático de irrigação se estiver ativado
    if (sistemaAutomatico) {
        // Verifica se está dentro do horário de algum timer
        time_t now = time(nullptr);
        struct tm timeinfo;
        gmtime_r(&now, &timeinfo);
        
        bool dentroTimer = false;
        for (int i = 0; i < 3; i++) {
            Timer timer = configAtual.timers[i];
            if (timer.ativo) {
                if (timeinfo.tm_hour == timer.horaInicio && 
                    timeinfo.tm_min >= timer.minutoInicio && 
                    timeinfo.tm_min < (timer.minutoInicio + timer.duracao)) {
                    dentroTimer = true;
                    break;
                }
            }
        }
        
        // Ativa irrigação se umidade estiver abaixo do mínimo E estiver dentro do horário de um timer
        if (umidadeSolo < configAtual.umidadeMinima && dentroTimer && !irrigacaoAtiva) {
            Serial.println("Ativando irrigação automaticamente");
            ativarIrrigacao();
        } 
        // Desativa irrigação se umidade estiver acima do máximo OU fora do horário dos timers
        else if ((umidadeSolo > configAtual.umidadeMaxima || !dentroTimer) && irrigacaoAtiva) {
            Serial.println("Desativando irrigação automaticamente");
            pararIrrigacao();
        }
    }
}

bool testarConexao(String host) {
    HTTPClient http;
    http.setConnectTimeout(10000); // 10 segundos de timeout
    
    String url = host;
    if (!host.startsWith("http")) {
        url = "http://" + host;
    }
    
    Serial.print("Tentando conectar a: " + url + " ... ");
    http.begin(url);
    int httpCode = http.GET();
    http.end();
    
    Serial.println("Código de resposta: " + String(httpCode));
    
    // Retorna true se conseguiu fazer a requisição (mesmo com erro HTTP)
    return httpCode != -1;
}

void testarServidorAWS() {
    // Removido pois não é mais necessário testar via HTTP
    Serial.println("Conexão com servidor será verificada via WebSocket");
}

void enviarHeartbeatServidor() {
    // Substituído pelo sistema de heartbeat do WebSocket
    if (wsConnected) {
        enviarDadosServidor();
    }
}

void handleClient(WiFiClient client) {
    String currentLine = "";
    String requestLine = "";
    unsigned long timeout = millis();
    
    Serial.println("Cliente conectado - processando requisição");
    
    while (client.connected() && millis() - timeout < 10000) { // 10 segundos de timeout
        if (client.available()) {
            char c = client.read();
            Serial.write(c); // Imprimir os dados recebidos para depuração
            
            if (requestLine == "" && c == '\n') {
                requestLine = currentLine;
                currentLine = "";
            } else if (c == '\n') {
                if (currentLine.length() == 0) {
                    Serial.println("Requisição recebida: " + requestLine);
                    
                    // Responder ao preflight CORS
                    if (requestLine.indexOf("OPTIONS") >= 0) {
                        enviarRespostaCORS(client);
                    } else if (requestLine.indexOf("GET /status") >= 0) {
                        Serial.println("Processando GET /status");
                        enviarStatus(client);
                    } else if (requestLine.indexOf("GET /ping") >= 0 || requestLine.indexOf("GET / ") >= 0) {
                        Serial.println("Processando GET /ping");
                        enviarPing(client);
                    } else if (requestLine.indexOf("GET /heartbeat") >= 0) {
                        Serial.println("Processando GET /heartbeat");
                        enviarHeartbeat(client);
                    } else if (requestLine.indexOf("POST /irrigar") >= 0 || requestLine.indexOf("GET /irrigar") >= 0) {
                        Serial.println("Processando /irrigar");
                        ativarIrrigacao();
                        enviarStatusIrrigacao(client);
                    } else if (requestLine.indexOf("POST /parar") >= 0 || requestLine.indexOf("GET /parar") >= 0) {
                        Serial.println("Processando /parar");
                        pararIrrigacao();
                        enviarStatusIrrigacao(client);
                    } else if (requestLine.indexOf("POST /automatico") >= 0 || requestLine.indexOf("GET /automatico") >= 0) {
                        Serial.println("Processando /automatico");
                        toggleAutomatico(!sistemaAutomatico);
                        enviarStatusAutomatico(client);
                    } else if (requestLine.indexOf("GET /sensores") >= 0) {
                        Serial.println("Processando GET /sensores");
                        lerSensores();
                        enviarDadosSensoresHTTP(client);
                    } else if (requestLine.indexOf("GET /testar-servidor") >= 0) {
                        Serial.println("Processando GET /testar-servidor");
                        testarServidorAWS();
                        enviarRespostaJSON(client, "{\"message\":\"Teste de servidor iniciado\"}");
                    } else if (requestLine.indexOf("GET /reset") >= 0) {
                        Serial.println("Processando GET /reset");
                        enviarRespostaJSON(client, "{\"message\":\"Reiniciando ESP32...\"}");
                        delay(1000);
                        ESP.restart();
                    } else if (requestLine.indexOf("GET /testar-rele/ligar") >= 0) {
                        Serial.println("Teste manual: LIGAR relé");
                        ligarRele();
                        enviarRespostaJSON(client, "{\"message\":\"Relé ligado manualmente\"}");
                    }
                    else if (requestLine.indexOf("GET /testar-rele/desligar") >= 0) {
                        Serial.println("Teste manual: DESLIGAR relé");
                        desligarRele();
                        enviarRespostaJSON(client, "{\"message\":\"Relé desligado manualmente\"}");
                    }
                    else if (requestLine.indexOf("GET /status-rele") >= 0) {
                        int estadoRele = digitalRead(RELE_BOMBA);
                        String estado = estadoRele == HIGH ? "HIGH" : "LOW";
                        String response = "{\"pino\":" + String(RELE_BOMBA) + ",\"estado\":\"" + estado + "\"}";
                        enviarRespostaJSON(client, response);
                    } else {
                        Serial.println("Requisição inválida");
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
    
    client.stop();
    Serial.println("Cliente desconectado");
}

// Funções para controle do relé
void ligarRele() {
    Serial.println("Tentando LIGAR relé");
    Serial.print("Estado anterior do pino: ");
    Serial.println(digitalRead(RELE_BOMBA) == HIGH ? "HIGH" : "LOW");
    
    if (RELE_ATIVO_BAIXO) {
        digitalWrite(RELE_BOMBA, LOW);
        Serial.println("Definindo pino como LOW");
    } else {
        digitalWrite(RELE_BOMBA, HIGH);
        Serial.println("Definindo pino como HIGH");
    }
    
    delay(100); // Pequeno delay para estabilizar
    
    // Verifica se o comando foi aplicado corretamente
    int estadoRele = digitalRead(RELE_BOMBA);
    Serial.print("Novo estado do pino: ");
    Serial.println(estadoRele == HIGH ? "HIGH" : "LOW");
}

void desligarRele() {
    Serial.println("Tentando DESLIGAR relé");
    Serial.print("Estado anterior do pino: ");
    Serial.println(digitalRead(RELE_BOMBA) == HIGH ? "HIGH" : "LOW");
    
    if (RELE_ATIVO_BAIXO) {
        digitalWrite(RELE_BOMBA, HIGH);
        Serial.println("Definindo pino como HIGH");
    } else {
        digitalWrite(RELE_BOMBA, LOW);
        Serial.println("Definindo pino como LOW");
    }
    
    delay(100); // Pequeno delay para estabilizar
    
    // Verifica se o comando foi aplicado corretamente
    int estadoRele = digitalRead(RELE_BOMBA);
    Serial.print("Novo estado do pino: ");
    Serial.println(estadoRele == HIGH ? "HIGH" : "LOW");
}

void ativarIrrigacao() {
    irrigacaoAtiva = true;
    digitalWrite(RELE_BOMBA, HIGH);
    Serial.println("Irrigação ATIVADA");
    Serial.println("Relé LIGADO");
    
    // Envia o novo estado via WebSocket
    if (wsConnected) {
        StaticJsonDocument<100> doc;
        doc["type"] = "estado";
        doc["irrigacaoAtiva"] = true;
        doc["rele"] = "HIGH";
        
        String msg;
        serializeJson(doc, msg);
        webSocket.sendTXT(msg);
        Serial.println("Estado enviado via WebSocket");
    }
}

void pararIrrigacao() {
    irrigacaoAtiva = false;
    digitalWrite(RELE_BOMBA, LOW);
    Serial.println("Irrigação DESATIVADA");
    Serial.println("Relé DESLIGADO");
    
    // Envia o novo estado via WebSocket
    if (wsConnected) {
        StaticJsonDocument<100> doc;
        doc["type"] = "estado";
        doc["irrigacaoAtiva"] = false;
        doc["rele"] = "LOW";
        
        String msg;
        serializeJson(doc, msg);
        webSocket.sendTXT(msg);
        Serial.println("Estado enviado via WebSocket");
    }
}

void toggleAutomatico(bool estado) {
    sistemaAutomatico = estado;
    Serial.println(sistemaAutomatico ? "Modo Automático ATIVADO" : "Modo Automático DESATIVADO");
    
    // Envia o novo estado via WebSocket
    if (webSocket.isConnected()) {
        StaticJsonDocument<100> doc;
        doc["type"] = "estado";
        doc["automatico"] = sistemaAutomatico;
        
        String msg;
        serializeJson(doc, msg);
        webSocket.sendTXT(msg);
    }
}

void enviarRespostaCORS(WiFiClient& client) {
    client.println("HTTP/1.1 200 OK");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    client.println("Access-Control-Allow-Headers: Content-Type");
    client.println("Content-Type: text/plain");
    client.println("Content-Length: 0");
    client.println("Connection: close");
    client.println();
    Serial.println("Resposta CORS enviada");
}

void enviarPing(WiFiClient& client) {
    StaticJsonDocument<200> doc;
    doc["message"] = "pong";
    doc["device"] = "ESP32";
    doc["ip"] = WiFi.localIP().toString();
    doc["falhas"] = falhasConsecutivas;
    
    String response;
    serializeJson(doc, response);
    
    Serial.println("Enviando resposta de ping: " + response);
    enviarRespostaJSON(client, response);
}

void enviarHeartbeat(WiFiClient& client) {
    StaticJsonDocument<200> doc;
    doc["status"] = "online";
    doc["device"] = "ESP32";
    doc["ip"] = WiFi.localIP().toString();
    doc["mac"] = WiFi.macAddress();
    doc["irrigacao"] = irrigacaoAtiva;
    doc["automatico"] = sistemaAutomatico;
    doc["falhas"] = falhasConsecutivas;
    
    String response;
    serializeJson(doc, response);
    
    Serial.println("Enviando resposta de heartbeat: " + response);
    enviarRespostaJSON(client, response);
}

void enviarStatus(WiFiClient& client) {
    StaticJsonDocument<200> doc;
    doc["status"] = "online";
    doc["irrigacao"] = irrigacaoAtiva;
    doc["automatico"] = sistemaAutomatico;
    doc["ip"] = WiFi.localIP().toString();
    doc["falhas"] = falhasConsecutivas;
    
    String response;
    serializeJson(doc, response);
    
    Serial.println("Enviando resposta de status: " + response);
    enviarRespostaJSON(client, response);
}

void enviarStatusIrrigacao(WiFiClient& client) {
    StaticJsonDocument<100> doc;
    doc["status"] = irrigacaoAtiva ? "irrigando" : "parado";
    
    String response;
    serializeJson(doc, response);
    
    Serial.println("Enviando resposta de status irrigação: " + response);
    enviarRespostaJSON(client, response);
}

void enviarStatusAutomatico(WiFiClient& client) {
    StaticJsonDocument<100> doc;
    doc["automatico"] = sistemaAutomatico;
    
    String response;
    serializeJson(doc, response);
    
    Serial.println("Enviando resposta de modo automático: " + response);
    enviarRespostaJSON(client, response);
}

void enviarDadosSensoresHTTP(WiFiClient& client) {
    StaticJsonDocument<200> doc;
    doc["temperatura"] = temperatura;
    doc["umidade"] = umidade;
    doc["umidadeSolo"] = umidadeSolo;
    doc["irrigacao"] = irrigacaoAtiva;
    doc["automatico"] = sistemaAutomatico;
    
    String response;
    serializeJson(doc, response);
    
    Serial.println("Enviando dados dos sensores: " + response);
    enviarRespostaJSON(client, response);
}

void enviarRespostaJSON(WiFiClient& client, String content) {
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    client.println("Access-Control-Allow-Headers: Content-Type");
    client.println("Connection: close");
    client.println("Content-Length: " + String(content.length()));
    client.println();
    client.print(content); // Usando print em vez de println para evitar \n extra
    Serial.println("Resposta enviada com sucesso");
}

void verificarConexoes() {
    unsigned long agora = millis();
    
    // Verifica conexão WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi desconectado. Reconectando...");
        WiFi.disconnect();
        delay(1000);
        WiFi.begin(ssid, password);
        
        int tentativas = 0;
        while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
            delay(500);
            Serial.print(".");
            tentativas++;
        }
        
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("\nWiFi reconectado!");
            Serial.println("IP: " + WiFi.localIP().toString());
            Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
            configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
        } else {
            Serial.println("\nFalha ao reconectar WiFi");
            return; // Sai da função se não conseguiu conectar ao WiFi
        }
    }
    
    // Tenta reconectar WebSocket se necessário
    if (!wsConnected && (agora - lastReconnectAttempt >= RECONNECT_INTERVAL)) {
        setupWebSocket();
        lastReconnectAttempt = agora;
    }
    
    // Envia heartbeat se conectado
    if (wsConnected && (agora - lastHeartbeat >= HEARTBEAT_INTERVAL)) {
        enviarDadosServidor();
        lastHeartbeat = agora;
    }
    
    // Lê sensores periodicamente
    if (agora - lastSensorRead >= SENSOR_INTERVAL) {
        lerSensores();
        verificarUmidadeSolo();
        if (wsConnected) {
            enviarDadosServidor();
        }
        lastSensorRead = agora;
    }
}

void verificarUmidadeSolo() {
    // Lê umidade do solo
    int valorBruto = analogRead(SENSOR_UMIDADE_SOLO);
    umidadeSolo = map(valorBruto, 4095, 0, 0, 100); // Inverte a escala e converte para porcentagem
    
    // Se estiver no modo automático, controla a irrigação baseado na umidade
    if (sistemaAutomatico) {
        if (umidadeSolo < 20 && !irrigacaoAtiva) {
            Serial.println("Umidade baixa (< 20%). Ativando irrigação...");
            ativarIrrigacao();
        }
        else if (umidadeSolo >= 50 && irrigacaoAtiva) {
            Serial.println("Umidade adequada (>= 50%). Desativando irrigação...");
            pararIrrigacao();
        }
    }
}

void loop() {
    unsigned long agora = millis();
    
    // Verifica conexões e WebSocket
    if (WiFi.status() == WL_CONNECTED) {
        webSocket.loop();
    }
    
    // Verifica sensores e controle automático
    if (agora - lastSensorRead >= SENSOR_INTERVAL) {
        lerSensores();
        verificarUmidadeSolo();
        if (wsConnected) {
            enviarDadosServidor();
        }
        lastSensorRead = agora;
    }
    
    verificarConexoes();
    
    // Pequeno delay para estabilidade
    delay(10);
} 