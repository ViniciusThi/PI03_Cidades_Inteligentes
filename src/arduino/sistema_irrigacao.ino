#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// Configurações de WiFi
const char* ssid = "Ti";           // Nome da sua rede WiFi (3G do celular)
const char* password = "thi08012"; // Senha da sua rede WiFi

// Configurações de IP Fixo para o ESP8266
IPAddress staticIP(192, 168, 249, 208);    // IP fixo do ESP8266
IPAddress gateway(192, 168, 249, 27);      // Gateway da sua rede
IPAddress subnet(255, 255, 255, 0);         // Máscara de sub-rede
IPAddress dns(8, 8, 8, 8);                  // DNS do Google

// Endereço do servidor
const char* serverUrl = "http://192.168.249.207:5000"; // Seu servidor Node.js

// Pinos
const int RELE_BOMBA = D1;        // Relé para controle da bomba d'água (GPIO5)

// Variáveis globais
bool irrigacaoAtiva = false;
bool sistemaAutomatico = false;

WiFiServer server(80);

void setup() {
    Serial.begin(115200);
    Serial.println("\nIniciando Sistema de Irrigação...");
    
    pinMode(RELE_BOMBA, OUTPUT);
    digitalWrite(RELE_BOMBA, LOW);
    Serial.println("Relé da bomba: DESLIGADO");
    
    setupWiFi();
    server.begin();
    Serial.println("Servidor HTTP iniciado na porta 80");
}

void setupWiFi() {
    Serial.print("Conectando ao WiFi");
    
    // Configurar IP fixo
    if (!WiFi.config(staticIP, gateway, subnet, dns)) {
        Serial.println("Falha ao configurar IP fixo!");
    }
    
    WiFi.begin(ssid, password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\nConectado ao WiFi!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

void handleClient(WiFiClient client) {
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
                    if (requestLine.indexOf("GET /status") >= 0) {
                        enviarStatus(client);
                    } else if (requestLine.indexOf("POST /irrigar") >= 0) {
                        ativarIrrigacao(client);
                    } else if (requestLine.indexOf("POST /parar") >= 0) {
                        pararIrrigacao(client);
                    } else if (requestLine.indexOf("POST /automatico") >= 0) {
                        toggleAutomatico(client);
                    } else {
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
}

void enviarStatus(WiFiClient& client) {
    StaticJsonDocument<200> doc;
    doc["status"] = "online";
    doc["irrigacao"] = irrigacaoAtiva;
    doc["automatico"] = sistemaAutomatico;
    
    String response;
    serializeJson(doc, response);
    
    enviarRespostaJSON(client, response);
}

void ativarIrrigacao(WiFiClient& client) {
    irrigacaoAtiva = true;
    digitalWrite(RELE_BOMBA, HIGH);
    
    StaticJsonDocument<100> doc;
    doc["status"] = "irrigando";
    
    String response;
    serializeJson(doc, response);
    
    enviarRespostaJSON(client, response);
    Serial.println("Irrigação ATIVADA");
}

void pararIrrigacao(WiFiClient& client) {
    irrigacaoAtiva = false;
    digitalWrite(RELE_BOMBA, LOW);
    
    StaticJsonDocument<100> doc;
    doc["status"] = "parado";
    
    String response;
    serializeJson(doc, response);
    
    enviarRespostaJSON(client, response);
    Serial.println("Irrigação DESATIVADA");
}

void toggleAutomatico(WiFiClient& client) {
    sistemaAutomatico = !sistemaAutomatico;
    
    StaticJsonDocument<100> doc;
    doc["automatico"] = sistemaAutomatico;
    
    String response;
    serializeJson(doc, response);
    
    enviarRespostaJSON(client, response);
    Serial.println(sistemaAutomatico ? "Modo Automático ATIVADO" : "Modo Automático DESATIVADO");
}

void enviarRespostaJSON(WiFiClient& client, String content) {
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Connection: close");
    client.println();
    client.println(content);
}

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Reconectando ao WiFi...");
        setupWiFi();
    }

    WiFiClient client = server.available();
    if (client) {
        Serial.println("Novo cliente conectado");
        handleClient(client);
    }
} 