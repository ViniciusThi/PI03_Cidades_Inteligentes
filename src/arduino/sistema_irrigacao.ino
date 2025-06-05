#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <DHT.h>

// Configurações de WiFi
const char* ssid = "Ti";           // Nome da sua rede WiFi (3G do celular)
const char* password = "thi08012"; // Senha da sua rede WiFi

// Endereço do servidor
const char* serverUrl = "18.231.186.246"; // Seu servidor Node.js
const int serverPort = 5000;              // Porta do servidor
const char* wsPath = "/ws/arduino";       // Caminho do WebSocket

// Pinos
const int RELE_BOMBA = 5;          // Relé para controle da bomba d'água (GPIO5)
const int SENSOR_UMIDADE_SOLO = 34; // Sensor de umidade do solo (ADC)
const int DHTPIN = 32;             // Pino de dados do DHT22
const int DHTTYPE = DHT22;         // Tipo do sensor DHT (DHT22)

// Variáveis globais
bool irrigacaoAtiva = false;
bool sistemaAutomatico = false;
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

// Objetos
WiFiServer server(80);
WebSocketsClient webSocket;
DHT dht(DHTPIN, DHTTYPE);

// Variáveis para armazenar leituras dos sensores
float temperatura = 0;
float umidade = 0;
int umidadeSolo = 0;

void setup() {
    Serial.begin(115200);
    delay(1000); // Aguarda a inicialização do monitor serial
    Serial.println("\nIniciando Sistema de Irrigação...");
    
    // Inicializa pinos
    pinMode(RELE_BOMBA, OUTPUT);
    digitalWrite(RELE_BOMBA, LOW);
    Serial.println("Relé da bomba: DESLIGADO");
    
    pinMode(SENSOR_UMIDADE_SOLO, INPUT);
    
    // Inicializa o DHT22
    dht.begin();
    Serial.println("Sensores inicializados");
    
    // Conecta ao WiFi
    setupWiFi();
    
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
        Serial.println("\nConectado ao WiFi!");
        Serial.print("IP: ");
        Serial.println(meuIP);
        Serial.print("MAC: ");
        Serial.println(WiFi.macAddress());
        Serial.print("Gateway: ");
        Serial.println(WiFi.gatewayIP());
        Serial.print("Máscara de sub-rede: ");
        Serial.println(WiFi.subnetMask());
        Serial.print("DNS: ");
        Serial.println(WiFi.dnsIP());
        
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
    Serial.println("Configurando WebSocket...");
    
    // Configura a conexão WebSocket
    webSocket.begin(serverUrl, serverPort, wsPath);
    
    // Configura o evento de callback
    webSocket.onEvent(webSocketEvent);
    
    // Tenta manter a conexão ativa com ping a cada 5 segundos
    webSocket.setReconnectInterval(5000);
    
    Serial.println("WebSocket configurado!");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("WebSocket desconectado!");
            break;
        case WStype_CONNECTED:
            Serial.println("WebSocket conectado!");
            
            // Envia informações do dispositivo ao conectar
            enviarInfoDispositivo();
            break;
        case WStype_TEXT:
            Serial.println("Recebido do WebSocket: ");
            Serial.println((char*)payload);
            
            // Processa a mensagem recebida
            processarMensagemWebSocket((char*)payload);
            break;
        case WStype_ERROR:
            Serial.println("Erro no WebSocket!");
            break;
    }
}

void enviarInfoDispositivo() {
    StaticJsonDocument<200> doc;
    doc["type"] = "info";
    doc["mac"] = WiFi.macAddress();
    doc["ip"] = meuIP;
    
    String msg;
    serializeJson(doc, msg);
    
    webSocket.sendTXT(msg);
    Serial.println("Enviado para WebSocket: " + msg);
}

void processarMensagemWebSocket(String mensagem) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, mensagem);
    
    if (error) {
        Serial.print("Erro ao parsear JSON: ");
        Serial.println(error.c_str());
        return;
    }
    
    // Processa o comando recebido
    String tipo = doc["type"];
    
    if (tipo == "config") {
        // Atualiza o ID do usuário
        if (doc.containsKey("userId")) {
            userId = doc["userId"].as<String>();
            Serial.println("ID do usuário atualizado: " + userId);
        }
    } 
    else if (tipo == "comando") {
        String comando = doc["comando"];
        
        if (comando == "irrigar") {
            ativarIrrigacao();
        } 
        else if (comando == "parar") {
            pararIrrigacao();
        } 
        else if (comando == "automatico") {
            bool estado = doc["estado"];
            toggleAutomatico(estado);
        }
    }
}

void enviarDadosSensores() {
    if (WiFi.status() == WL_CONNECTED && webSocket.isConnected()) {
        StaticJsonDocument<200> doc;
        doc["type"] = "sensor_data";
        doc["mac"] = WiFi.macAddress();
        doc["temperatura"] = temperatura;
        doc["umidade"] = umidade;
        doc["umidadeSolo"] = umidadeSolo;
        doc["irrigacaoAtiva"] = irrigacaoAtiva;
        doc["automatico"] = sistemaAutomatico;
        
        String msg;
        serializeJson(doc, msg);
        
        webSocket.sendTXT(msg);
        Serial.println("Dados dos sensores enviados via WebSocket");
    }
}

void lerSensores() {
    // Lê temperatura e umidade do DHT22
    float novaTempuratura = dht.readTemperature();
    float novaUmidade = dht.readHumidity();
    
    // Verifica se as leituras são válidas
    if (!isnan(novaTempuratura)) {
        temperatura = novaTempuratura;
    }
    
    if (!isnan(novaUmidade)) {
        umidade = novaUmidade;
    }
    
    // Lê umidade do solo (conversão do ADC para percentual)
    int valorBruto = analogRead(SENSOR_UMIDADE_SOLO);
    // Calibrar estes valores conforme seu sensor específico
    umidadeSolo = map(valorBruto, 4095, 0, 0, 100); // Ajuste os valores min/max conforme seu sensor
    
    // Limita valores para o intervalo válido
    umidadeSolo = constrain(umidadeSolo, 0, 100);
    
    Serial.println("Leitura dos sensores:");
    Serial.println("Temperatura: " + String(temperatura) + "°C");
    Serial.println("Umidade do ar: " + String(umidade) + "%");
    Serial.println("Umidade do solo: " + String(umidadeSolo) + "%");
    
    // Controle automático de irrigação se estiver ativado
    if (sistemaAutomatico) {
        // Lógica simplificada: ativa a irrigação se umidade do solo < 30%
        if (umidadeSolo < 30 && !irrigacaoAtiva) {
            Serial.println("Ativando irrigação automaticamente");
            ativarIrrigacao();
        } 
        // Desativa a irrigação se umidade do solo > 70%
        else if (umidadeSolo > 70 && irrigacaoAtiva) {
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
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Verificando conexão com o servidor AWS...");
        
        String httpUrl = "http://" + String(serverUrl) + ":" + String(serverPort);
        if (testarConexao(httpUrl)) {
            Serial.println("Conexão com o servidor AWS OK!");
            falhasConsecutivas = 0; // Reseta contador de falhas
        } else {
            falhasConsecutivas++;
            Serial.println("Falha na conexão com o servidor AWS. Verificando rede... Falha " + String(falhasConsecutivas));
            
            // Verifica se o IP mudou (comum em redes móveis)
            String novoIP = WiFi.localIP().toString();
            if (novoIP != meuIP) {
                Serial.println("IP mudou de " + meuIP + " para " + novoIP);
                meuIP = novoIP;
            }
            
            // Testa conexão com um serviço externo confiável
            if (testarConexao("http://8.8.8.8")) {
                Serial.println("Conexão com a Internet OK. Problema específico com o servidor AWS.");
            } else {
                Serial.println("Sem conexão com a Internet. Problema na rede móvel.");
                // Tenta reconectar ao WiFi
                setupWiFi();
            }
            
            if (falhasConsecutivas >= maxFalhasConsecutivas) {
                Serial.println("Número máximo de falhas atingido. Reiniciando...");
                ESP.restart();
            }
        }
    } else {
        Serial.println("WiFi desconectado. Reconectando...");
        setupWiFi();
    }
}

void enviarHeartbeatServidor() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = "http://" + String(serverUrl) + ":" + String(serverPort) + "/api/arduino/heartbeat";
        
        Serial.print("Enviando heartbeat para: ");
        Serial.println(url);
        
        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.setConnectTimeout(15000); // Aumenta o timeout para 15 segundos
        
        StaticJsonDocument<200> doc;
        doc["ip"] = WiFi.localIP().toString();
        doc["mac"] = WiFi.macAddress();
        doc["status"] = "online";
        doc["irrigacao"] = irrigacaoAtiva;
        doc["automatico"] = sistemaAutomatico;
        doc["temperatura"] = temperatura;
        doc["umidade"] = umidade;
        doc["umidadeSolo"] = umidadeSolo;
        
        String requestBody;
        serializeJson(doc, requestBody);
        
        int httpResponseCode = http.POST(requestBody);
        
        if (httpResponseCode > 0) {
            String response = http.getString();
            Serial.println("Resposta do servidor: " + response);
            Serial.println("Código HTTP: " + String(httpResponseCode));
            falhasConsecutivas = 0; // Reseta contador de falhas
        } else {
            falhasConsecutivas++;
            Serial.print("Erro no envio do heartbeat. Código de erro: ");
            Serial.println(httpResponseCode);
            Serial.println("Erro: " + http.errorToString(httpResponseCode));
            Serial.println("Falha " + String(falhasConsecutivas));
            
            // Tenta reconectar ao WiFi se houver erro de conexão
            if (httpResponseCode == -1) {
                Serial.println("Tentando reconectar ao WiFi...");
                setupWiFi();
            }
            
            if (falhasConsecutivas >= maxFalhasConsecutivas) {
                Serial.println("Número máximo de falhas atingido. Reiniciando...");
                ESP.restart();
            }
        }
        
        http.end();
    } else {
        Serial.println("WiFi desconectado. Não foi possível enviar heartbeat.");
        setupWiFi(); // Tenta reconectar
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

void ativarIrrigacao() {
    irrigacaoAtiva = true;
    digitalWrite(RELE_BOMBA, HIGH);
    Serial.println("Irrigação ATIVADA");
    
    // Envia o novo estado via WebSocket
    if (webSocket.isConnected()) {
        StaticJsonDocument<100> doc;
        doc["type"] = "estado";
        doc["irrigacaoAtiva"] = true;
        
        String msg;
        serializeJson(doc, msg);
        webSocket.sendTXT(msg);
    }
}

void pararIrrigacao() {
    irrigacaoAtiva = false;
    digitalWrite(RELE_BOMBA, LOW);
    Serial.println("Irrigação DESATIVADA");
    
    // Envia o novo estado via WebSocket
    if (webSocket.isConnected()) {
        StaticJsonDocument<100> doc;
        doc["type"] = "estado";
        doc["irrigacaoAtiva"] = false;
        
        String msg;
        serializeJson(doc, msg);
        webSocket.sendTXT(msg);
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

void loop() {
    // Mantém a conexão WebSocket ativa
    webSocket.loop();
    
    // Verifica conexão WiFi a cada iteração
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi desconectado. Reconectando...");
        setupWiFi();
        
        // Reconecta o WebSocket
        if (WiFi.status() == WL_CONNECTED) {
            setupWebSocket();
        }
    }

    // Verifica se é hora de ler os sensores e enviar os dados
    unsigned long tempoAtual = millis();
    if (tempoAtual - ultimoEnvioDadosSensores >= intervaloDadosSensores) {
        lerSensores();
        enviarDadosSensores();
        ultimoEnvioDadosSensores = tempoAtual;
    }

    // Verifica se é hora de enviar um heartbeat para o servidor
    if (tempoAtual - ultimoEnvioHeartbeat >= intervaloHeartbeat) {
        enviarHeartbeatServidor();
        ultimoEnvioHeartbeat = tempoAtual;
    }
    
    // Verifica periodicamente a conexão com o servidor AWS
    if (tempoAtual - ultimoTesteServidor >= intervaloTesteServidor) {
        testarServidorAWS();
        ultimoTesteServidor = tempoAtual;
    }

    // Verifica se há clientes HTTP conectados
    WiFiClient client = server.available();
    if (client) {
        Serial.println("Novo cliente conectado");
        handleClient(client);
    }
    
    // Pequeno delay para estabilidade
    delay(10);
} 