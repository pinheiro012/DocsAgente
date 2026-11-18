/**
 * DocuAgent AI — Servidor Web Nativo em Node.js (Zero Dependências Externas)
 * Serve a interface web completa e a API de documentos e processamento.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
// Mapeamento de tipos MIME
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

const AZURE_CONFIG_PATH = path.join(__dirname, 'azure-config.json');

// ---------- Azure AI Foundry (Agente por nome, via Responses API) ----------
const { exec } = require('child_process');

function loadAzureConfig() {
  if (!fs.existsSync(AZURE_CONFIG_PATH)) {
    throw new Error('Arquivo azure-config.json não encontrado na pasta do projeto.');
  }
  const cfg = JSON.parse(fs.readFileSync(AZURE_CONFIG_PATH, 'utf-8'));
  if (!cfg.projectEndpoint) throw new Error('Preencha "projectEndpoint" no azure-config.json.');
  if (!cfg.agentName) throw new Error('Preencha "agentName" no azure-config.json.');
  cfg.projectEndpoint = cfg.projectEndpoint.trim().replace(/\/+$/, '');
  return cfg;
}

// O Foundry Agent Service não aceita API key: precisa de token do Entra ID.
// Pegamos o token do Azure CLI (rode "az login" uma vez) e guardamos até expirar.
let cachedToken = null; // { token, expiresAt }
function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return Promise.resolve(cachedToken.token);
  }
  return new Promise((resolve, reject) => {
    exec('az account get-access-token --resource https://ai.azure.com/ -o json',
      { windowsHide: true, timeout: 60000 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = String(stderr || err.message);
          if (/not recognized|not found|ENOENT|não é reconhecido/i.test(msg)) {
            return reject(new Error('Azure CLI não instalado. Instale (https://aka.ms/installazurecliwindows), feche e abra o terminal, rode "az login" e reinicie o servidor.'));
          }
          return reject(new Error('Não consegui o token do Azure. Rode "az login" no terminal e tente de novo. Detalhe: ' + msg.trim().split('\n')[0]));
        }
        try {
          const j = JSON.parse(stdout);
          const exp = j.expires_on ? j.expires_on * 1000 : new Date(j.expiresOn).getTime();
          cachedToken = { token: j.accessToken, expiresAt: exp || Date.now() + 30 * 60 * 1000 };
          resolve(j.accessToken);
        } catch (e) {
          reject(new Error('Resposta inesperada do Azure CLI.'));
        }
      });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 20e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

// Extrai o texto da resposta (REST não traz output_text pronto em todas as versões)
function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const c of item.content || []) {
        if (c.type === 'output_text' && c.text) parts.push(c.text);
      }
    }
  }
  return parts.join('\n').trim();
}

async function handleAzure(req, res) {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  try {
    const cfg = loadAzureConfig();
    const { prompt, tab, docName, docContent, previousResponseId } = await readBody(req);
    if (!prompt) return send(400, { error: 'Mensagem vazia.' });

    // As instruções do agente ficam no Foundry; aqui vai só o contexto da tela + a pergunta
    let input = `[ABA ATUAL: ${String(tab || '').toUpperCase()}]\n`;
    if (docContent) input += `[ARQUIVO SELECIONADO: "${docName}"]\n${docContent}\n\n`;
    input += `[SOLICITAÇÃO DO USUÁRIO]\n${prompt}`;

    const body = {
      input,
      agent_reference: { name: cfg.agentName, type: 'agent_reference' }
    };
    if (cfg.agentVersion) body.agent_reference.version = String(cfg.agentVersion);
    if (previousResponseId) body.previous_response_id = previousResponseId;

    const token = await getAccessToken();
    const url = `${cfg.projectEndpoint}/openai/v1/responses`;
    const call = () => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    let r = await call();
    // 429 = limite de tokens por minuto do Azure: espera o tempo que ele pede e tenta de novo (até 2x)
    for (let tentativa = 1; r.status === 429 && tentativa <= 2; tentativa++) {
      const espera = Math.min(Number(r.headers.get('retry-after')) || 10, 30);
      console.warn(`[Azure] 429 (limite de tokens). Tentando de novo em ${espera}s...`);
      await new Promise(ok => setTimeout(ok, espera * 1000));
      r = await call();
    }
    let data = await r.json().catch(() => ({}));

    // Se a conversa anterior expirou/sumiu, tenta de novo sem ela
    if (!r.ok && previousResponseId && r.status === 400 && /previous_response/i.test(JSON.stringify(data))) {
      delete body.previous_response_id;
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      data = await r.json().catch(() => ({}));
    }

    if (!r.ok) {
      const msg = data?.error?.message || r.statusText;
      console.error(`[Azure] HTTP ${r.status}: ${msg}`);
      let hint = '';
      if (r.status === 401) { cachedToken = null; hint = ' (token inválido: rode "az login" de novo)'; }
      if (r.status === 403) hint = ' (sua conta precisa da função "Azure AI User" no projeto do Foundry)';
      if (r.status === 429) {
        return send(429, { error: 'O limite de uso do modelo no Azure estourou (tokens por minuto). Espere 1 minuto e tente de novo. Para resolver de vez, aumente o limite de tokens por minuto da implantação no Foundry.' });
      }
      if (r.status === 404) hint = ' (confira projectEndpoint e agentName no azure-config.json)';
      return send(502, { error: `Azure respondeu ${r.status}: ${msg}${hint}` });
    }
    const text = extractText(data) || '(o agente não retornou texto)';
    send(200, { text, responseId: data.id });
  } catch (e) {
    console.error('[Azure]', e.message);
    send(500, { error: e.message });
  }
}

// Criar o servidor HTTP nativo
const server = http.createServer((req, res) => {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  try { pathname = decodeURIComponent(pathname); } catch (e) {}

  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rota de Health Check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'DocuAgent AI Server', version: '2026.1' }));
    return;
  }

  // Rota do agente no Azure AI Foundry
  if (pathname === '/api/azure' && req.method === 'POST') {
    handleAzure(req, res);
    return;
  }

  // Rota estática padrão
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Resolver caminho do arquivo no diretório público
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  // Verificar se o arquivo existe
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Se não for arquivo, tentar index.html (SPA Fallback)
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 — Arquivo não encontrado');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    // Obter tipo MIME correspondente
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Ler e enviar arquivo
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 — Erro interno ao ler arquivo');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

// Tratamento de porta em uso e inicialização
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  DOCUAGENT AI — SERVIDOR WEB INICIADO COM SUCESSO `);
  console.log(`===================================================`);
  console.log(`  Endereço local: http://localhost:${PORT}`);
  console.log(`  Modo: 8 Abas Especialistas + Bloqueio de Escopo + Plano B`);
  console.log(`  Diretório público: ${PUBLIC_DIR}`);
  try { const c = loadAzureConfig(); console.log(`  Agente Azure: ${c.agentName}`); } catch (e) { console.log(`  Azure: ${e.message}`); }
  console.log(`===================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`Aviso: Porta ${PORT} em uso. Tentando porta ${nextPort}...`);
    server.listen(nextPort);
  } else {
    console.error('Erro no servidor:', err);
  }
});
