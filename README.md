# DocuAgent AI — Sistema Especialista Documental (2026)

Aplicação web completa construída estritamente com base no **Prompt de Sistema de Análise, Organização, Criação e Consulta Restrita de Documentos**, integrando o **Mecanismo de Desambiguação (Plano B)**, o **Sistema de Controle e Bloqueio Rígido de Escopo** e o **Sistema de Exibição Bilíngue**.

---

## 🚀 Como Iniciar

### Opção 1: Inicialização em 1 Clique (Recomendado no Windows)
Dê um duplo clique no arquivo:
```
iniciar.bat
```
Ele abrirá seu navegador automaticamente em `http://localhost:3000` e iniciará o servidor Node.js.

### Opção 2: Via Terminal (Node.js)
```bash
npm start
# ou
node server.js
```
Acesse no seu navegador: [http://localhost:3000](http://localhost:3000)

### Opção 3: Execução Direta (Sem Servidor)
Basta abrir diretamente o arquivo no seu navegador (Chrome, Edge, Firefox):
```
public/index.html
```

---

## 🧭 As 8 Abas do Sistema

| # | Aba | Regra & Finalidade |
|---|---|---|
| 1 | **🔍 Analisar** | Interpretação minuciosa, extração de dados estruturados, resumo executivo, identificação de riscos e inconsistências factuais sem alucinação. |
| 2 | **🗂️ Organizar** | Classificação em categorias, sugestão de nomenclatura padronizada de arquivos, proposição de árvore de diretórios e detecção de duplicidades. |
| 3 | **✍️ Criar** | Assistente guiado para elaboração de minutas e pareceres, com validação de tipo, público-alvo, objetivo e checagem de dados essenciais faltantes. |
| 4 | **📝 Revisar** | Auditoria ortográfica, gramatical, coesão, formalidade e estilo, preservando integralmente o conteúdo factual e a intenção do autor. |
| 5 | **⚖️ Comparar** | Confronto analítico direto entre dois documentos (A vs B): divergências de cláusulas, valores, prazos, aditamentos e exclusões. |
| 6 | **🔒 Consultar Arquivo (Restrito)** | **Isolamento Absoluto:** Especialista restrito unicamente ao arquivo ativo. Se a resposta não estiver comprovada no texto, responde exatamente: **`não sei`**. |
| 7 | **📚 Conhecimento** | Recuperação de informações e busca semântica cruzada em todos os arquivos autorizados na base documental. |
| 8 | **🌐 Tradução (Bilíngue)** | Identificação automática de idioma, preservação do tom e contexto, com **visualização pareada** (Original + 🇧🇷 Português). |

---

## 🛡️ Mecanismos Inteligentes Integrados

### 1. Sistema de Bloqueio Rígido de Escopo
- Se o usuário fizer perguntas não documentais (ex.: *"previsão do tempo"*, *"quem ganhou a copa"*, *"como fazer lasanha"*, *"me ensine python"*, esportes ou política):
- O sistema bloqueia imediatamente com a resposta oficial:
  > **"Não sei. Esse assunto está fora do escopo deste agente."**
- Na aba restrita **Consultar Arquivo**, perguntas fora do texto do arquivo recebem exatamente:
  > **"não sei"**

### 2. Mecanismo de Plano B (Desambiguação e Confirmação)
- Tolera pequenos erros de digitação (ex: *"analize o contrto"* é corrigido internamente para *"Analise o contrato"*).
- Diante de solicitações vagas ou ambíguas (ex.: *"analise"*, *"compare"*, *"faz isso"*), aciona a confirmação antes de executar:
  > *"Plano B — Confirmação de Intenção: Acho que você quis dizer: '...'. É isso mesmo?"*

### 3. Exibição Bilíngue Espelhada (Aba Tradução)
- Exibe lado a lado em duas colunas sincronizadas:
  - **Coluna 1:** Idioma original do usuário (Inglês, Espanhol, Francês, etc.).
  - **Coluna 2:** Tradução correspondente em Português do Brasil.

---

## 🧪 Casos de Teste Prontos (Documentos de Exemplo Inclusos)

A aplicação já vem com dois documentos pré-carregados para validação imediata das regras:

1. **`Especificacao_Tecnica_Colheitadeira_TC500.txt`**
   - **Teste 1 (Pergunta direta):** *"Quantas etapas o projeto possui?"* ➔ Responde com base na Seção 2 (*planejamento, desenvolvimento e testes*).
   - **Teste 2 (Informação ausente):** *"Qual é o consumo de combustível?"* ➔ Responde exatamente: **`não sei`**.
   - **Teste 3 (Inferência proibida):** *"Então ele precisa de uma carreta especial?"* ➔ Responde exatamente: **`não sei`**.
   - **Teste 4 (Pergunta fora do assunto):** *"Qual é a capital da França?"* ➔ Responde exatamente: **`não sei`**.

2. **`Contrato_Prestacao_Servicos_Agro.txt`**
   - Permite testar a aba **Comparar** entre as especificações do equipamento e o contrato de prestação de serviços (R$ 4.500,00 mensais).

---

## 🤖 Integração com o Agente do Azure AI Foundry

O site já vem configurado para conversar com o agente **`green-agent-445575jz9p`** do projeto
`felipeagente-suporte`. O navegador nunca fala direto com o Azure: o `server.js` pega o token,
chama o agente e devolve a resposta (assim nenhuma credencial fica exposta no site).

### Passo a passo (primeira vez)
1. Instale o **Node.js 18 ou superior** e o **Azure CLI** (https://aka.ms/installazurecliwindows).
2. No terminal, faça login na conta que tem acesso ao projeto do Foundry:
   ```bash
   az login --tenant b1051c4b-3b94-41ab-9441-e73a72342fdd
   ```
3. Inicie o site com `iniciar.bat` (ou `npm start`) e abra http://localhost:3000.
4. No rodapé da barra lateral deve aparecer **"Motor: Azure AI Foundry"** e uma mensagem
   "Conectado ao agente green-agent-445575jz9p".

> O site **precisa** ser aberto pelo servidor (http://localhost:3000). Abrindo o `index.html` direto, o agente do Foundry não funciona.

### Como funciona
| Item | Detalhe |
|---|---|
| Rota do site | `POST /api/foundry/chat` e `GET /api/foundry/status` (no `server.js`) |
| API do Foundry | `POST {endpoint}/openai/v1/responses` com `agent_reference` |
| Histórico | Uma conversa do Foundry por aba (o agente lembra do que foi dito naquela aba) |
| Contexto enviado | Nome da aba + conteúdo do arquivo ativo (Comparar envia A e B; Conhecimento envia a base toda; Criar envia o formulário) |
| Autenticação | `az login` (padrão) ou Service Principal no `.env` |

### Configurações opcionais (`.env`)
Copie `.env.example` para `.env` para trocar endpoint, nome/versão do agente ou usar um
Service Principal (`AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`) em vez do Azure CLI.

### Erros comuns
- **"Azure CLI não encontrado"** → instale o Azure CLI ou preencha o Service Principal no `.env`.
- **403 / Acesso negado** → a conta precisa da função **Azure AI User** no projeto do Foundry (IAM do recurso).
- **404** → confira o endpoint e o nome do agente.
- Para voltar ao modo offline, clique em **Configurar Motor IA** e escolha **Motor Local**.

---

## ⚙️ Configuração de IA (Opcional)
- **Modo Local / Embutido (Padrão):** Funciona 100% offline, sem necessidade de chaves de API externas.
- **Provedores de Nuvem (Opcional):** Suporte nativo no botão de configurações para inserir chave do **Google Gemini** (Gemini 2.5 / 1.5 Flash), **OpenAI** (GPT-4o) ou servidores locais (Ollama).
