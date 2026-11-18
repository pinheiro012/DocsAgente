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

## ⚙️ Configuração de IA (Opcional)
- **Modo Local / Embutido (Padrão):** Funciona 100% offline, sem necessidade de chaves de API externas.
- **Provedores de Nuvem (Opcional):** Suporte nativo no botão de configurações para inserir chave do **Google Gemini** (Gemini 2.5 / 1.5 Flash), **OpenAI** (GPT-4o) ou servidores locais (Ollama).

---

## ☁️ Conectar ao Agente do Azure AI Foundry
O site chama o agente **green-agent-445575jz9p** pela Responses API do projeto. Os dados já estão no `azure-config.json`.

O Foundry **não aceita chave de API para agentes**, só login do Azure. Por isso:
1. Instale o **Azure CLI** (uma vez): https://aka.ms/installazurecliwindows
2. Abra um terminal novo e rode `az login`. Entre com a conta que tem acesso ao projeto do Foundry.
3. Rode `iniciar.bat` e acesse `http://localhost:3000`. Não abra o `index.html` direto.
4. No topo deve aparecer `Motor: Azure AI Foundry`.

Erros comuns (aparecem no chat):
- **401**: rode `az login` de novo.
- **403**: sua conta precisa da função **Azure AI User** no projeto (Foundry → Configurações → Usuários / IAM).
- **404**: confira `projectEndpoint` e `agentName` no `azure-config.json`.

As instruções do agente são as que estão configuradas no Foundry. O site envia só a aba atual, o arquivo selecionado e a pergunta.
