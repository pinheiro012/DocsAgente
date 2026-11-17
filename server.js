/**
 * DocuAgent AI — Servidor Web Nativo em Node.js (Zero Dependências Externas)
 * Serve a interface web completa e a API de documentos e processamento.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

// ---------------------------------------------------------------------------
// Carregar variáveis do arquivo .env (sem dependências externas)
// ---------------------------------------------------------------------------
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
})();

// ---------------------------------------------------------------------------
// Configuração do Agente no Azure AI Foundry
// ---------------------------------------------------------------------------
const FOUNDRY = {
  endpoint: (process.env.FOUNDRY_PROJECT_ENDPOINT ||
    'https://felipeagente-suporte-resource.services.ai.azure.com/api/projects/felipeagente-suporte').replace(/\/+$/, ''),
  agentName: process.env.FOUNDRY_AGENT_NAME || 'green-agent-445575jz9p',
  agentVersion: process.env.FOUNDRY_AGENT_VERSION || '', // vazio = versão padrão/ativa do agente
  tenantId: process.env.AZURE_TENANT_ID || 'b1051c4b-3b94-41ab-9441-e73a72342fdd',
  clientId: process.env.AZURE_CLIENT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  staticToken: process.env.FOUNDRY_ACCESS_TOKEN || '', // opcional (testes)
  scope: 'https://ai.azure.com/.default'
};

let cachedToken = { value: null, expiresAt: 0, source: null };

// Obtém token do Microsoft Entra ID:
//  1) Service Principal (AZURE_CLIENT_ID + AZURE_CLIENT_SECRET) se configurado no .env
//  2) Caso contrário, usa o login do Azure CLI (comando "az login")
async function getAzureToken() {
  if (FOUNDRY.staticToken) return { token: FOUNDRY.staticToken, source: 'FOUNDRY_ACCESS_TOKEN' };

  const now = Date.now();
  if (cachedToken.value && now < cachedToken.expiresAt - 5 * 60 * 1000) {
    return { token: cachedToken.value, source: cachedToken.source };
  }

  if (FOUNDRY.clientId && FOUNDRY.clientSecret) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: FOUNDRY.clientId,
      client_secret: FOUNDRY.clientSecret,
      scope: FOUNDRY.scope
    });
    const r = await fetch(`https://login.microsoftonline.com/${FOUNDRY.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
      throw new Error(`Falha ao autenticar o Service Principal: ${data.error_description || data.error || r.status}`);
    }
    cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in || 3600) * 1000, source: 'service-principal' };
    return { token: cachedToken.value, source: cachedToken.source };
  }

  // Azure CLI
  const cmd = `az account get-access-token --resource https://ai.azure.com --tenant ${FOUNDRY.tenantId} --output json`;
  const out = await new Promise((resolve, reject) => {
    exec(cmd, { timeout: 30000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').toString();
        if (/not recognized|not found|ENOENT|não é reconhecido/i.test(msg)) {
          return reject(new Error('Azure CLI não encontrado. Instale o Azure CLI e rode "az login", ou configure AZURE_CLIENT_ID/AZURE_CLIENT_SECRET no arquivo .env.'));
        }
        return reject(new Error('Não foi possível obter o token pelo Azure CLI. Rode "az login --tenant ' + FOUNDRY.tenantId + '" no terminal e tente de novo. Detalhe: ' + msg.trim().split('\n').pop()));
      }
      resolve(stdout);
    });
  });
  const data = JSON.parse(out);
  const expiresAt = data.expires_on ? Number(data.expires_on) * 1000 : (Date.parse(data.expiresOn) || now + 50 * 60 * 1000);
  cachedToken = { value: data.accessToken, expiresAt, source: 'azure-cli' };
  return { token: cachedToken.value, source: cachedToken.source };
}

async function foundryFetch(pathAndQuery, payload) {
  const { token } = await getAzureToken();
  const r = await fetch(`${FOUNDRY.endpoint}${pathAndQuery}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload || {})
  });
  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  const hdr = {
    errorCode: r.headers.get('x-ms-error-code') || r.headers.get('apim-error') || '',
    wwwAuth: r.headers.get('www-authenticate') || '',
    requestId: r.headers.get('apim-request-id') || r.headers.get('x-request-id') || r.headers.get('x-ms-request-id') || ''
  };
  if (!r.ok) console.error(`[Foundry] HTTP ${r.status} em ${pathAndQuery}`, hdr, raw.slice(0, 500));
  return { ok: r.ok, status: r.status, data, hdr };
}

// Lê (sem validar) as informações do token para mostrar qual conta está logada
function describeToken(token) {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
    return { conta: p.upn || p.unique_name || p.preferred_username || p.appid || p.oid, tenant: p.tid, audience: p.aud };
  } catch { return {}; }
}

function foundryErrorMessage(res) {
  const e = res.data && (res.data.error || res.data);
  let msg = (e && (e.message || e.raw)) || '';
  const extra = [res.hdr?.errorCode, res.hdr?.wwwAuth].filter(Boolean).join(' | ');
  msg = [msg, extra].filter(Boolean).join(' — ') || 'o Azure não enviou detalhes';
  const who = cachedToken.value ? describeToken(cachedToken.value) : {};
  if (who.conta) msg += ` (conta usada: ${who.conta})`;
  if (res.status === 401) return `Não autorizado (401). O token não é válido para este projeto. Detalhe: ${msg}`;
  if (res.status === 403) return `Acesso negado (403). Sua conta precisa da função "Azure AI User" no projeto do Foundry. Detalhe: ${msg}`;
  if (res.status === 404) return `Não encontrado (404). Confira o endpoint e o nome do agente. Detalhe: ${msg}`;
  return `Erro ${res.status} do Foundry: ${msg}`;
}

function extractOutputText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c.type === 'output_text' || c.type === 'text') && c.text) parts.push(typeof c.text === 'string' ? c.text : c.text.value);
      }
    }
  }
  return parts.join('\n\n');
}

// Cria uma conversa (histórico multi-turno) no Foundry
async function createFoundryConversation() {
  let res = await foundryFetch('/openai/v1/conversations', {});
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    res = await foundryFetch('/openai/conversations?api-version=2025-11-15-preview', {});
  }
  if (!res.ok) throw new Error(foundryErrorMessage(res));
  return res.data.id;
}

// Envia uma mensagem ao agente do Foundry
async function askFoundryAgent(input, conversationId) {
  const agentRef = { type: 'agent_reference', name: FOUNDRY.agentName };
  if (FOUNDRY.agentVersion) agentRef.version = String(FOUNDRY.agentVersion);

  const base = { input: [{ role: 'user', content: input }] };
  if (conversationId) base.conversation = conversationId;

  // Formato atual (API v1 do Foundry)
  let res = await foundryFetch('/openai/v1/responses', { ...base, agent_reference: agentRef });

  // Compatibilidade com o formato preview (caso o projeto ainda use)
  if (!res.ok && (res.status === 400 || res.status === 404)) {
    const alt = await foundryFetch('/openai/responses?api-version=2025-11-15-preview', { ...base, agent: agentRef });
    if (alt.ok) res = alt;
  }

  if (!res.ok) throw new Error(foundryErrorMessage(res));
  return { text: extractOutputText(res.data) || '(O agente não retornou texto.)', responseId: res.data.id };
}

function readJsonBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Requisição muito grande.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')); }
      catch { reject(new Error('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

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

// Criar o servidor HTTP nativo
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

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

  // Status da integração com o Foundry
  if (pathname === '/api/foundry/status' && req.method === 'GET') {
    getAzureToken()
      .then(({ token, source }) => sendJson(res, 200, {
        ok: true, endpoint: FOUNDRY.endpoint, agent: FOUNDRY.agentName,
        version: FOUNDRY.agentVersion || 'padrão', auth: source, ...describeToken(token)
      }))
      .catch((err) => sendJson(res, 200, {
        ok: false, endpoint: FOUNDRY.endpoint, agent: FOUNDRY.agentName, error: err.message
      }));
    return;
  }

  // Chat com o agente do Foundry
  if (pathname === '/api/foundry/chat' && req.method === 'POST') {
    (async () => {
      try {
        const body = await readJsonBody(req);
        const message = (body.message || '').toString();
        if (!message.trim()) return sendJson(res, 400, { error: 'Mensagem vazia.' });

        let conversationId = body.conversationId || null;
        if (!conversationId) {
          try { conversationId = await createFoundryConversation(); }
          catch (e) { console.warn('[Foundry] Não foi possível criar conversa, seguindo sem histórico:', e.message); }
        }

        const result = await askFoundryAgent(message, conversationId);
        sendJson(res, 200, { text: result.text, conversationId, responseId: result.responseId });
      } catch (err) {
        console.error('[Foundry] Erro:', err.message);
        sendJson(res, 502, { error: err.message });
      }
    })();
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
  console.log(`  Foundry: ${FOUNDRY.endpoint}`);
  console.log(`  Agente:  ${FOUNDRY.agentName}${FOUNDRY.agentVersion ? ' (v' + FOUNDRY.agentVersion + ')' : ''}`);
  console.log(`  Auth:    ${FOUNDRY.clientId ? 'Service Principal (.env)' : 'Azure CLI (az login)'}`);
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
