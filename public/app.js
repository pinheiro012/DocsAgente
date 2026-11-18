/**
 * DocuAgent AI — Client Application
 * Implementa os 8 Modos Documentais, Bloqueio de Escopo, Plano B e Visualização Bilíngue
 */

// Estado Global da Aplicação
const state = {
  currentTab: 'analisar',
  documents: [],
  activeDocId: null,
  pendingPlanoB: null,
  azureResponseIds: {}, // continuidade da conversa com o agente, por aba
  config: {
    // Provedores antigos/sem implementação (custom, groq) salvos no navegador voltam para o Azure
    provider: ['azure', 'local', 'gemini', 'openai'].includes(localStorage.getItem('docu_provider'))
      ? localStorage.getItem('docu_provider') : 'azure',
    apiKey: localStorage.getItem('docu_apikey') || '',
    customUrl: localStorage.getItem('docu_customurl') || 'http://localhost:11434/v1',
    model: localStorage.getItem('docu_model') || '',
    theme: localStorage.getItem('docu_theme') || 'dark'
  }
};

// Definições de Modos e Regras Oficiais do Sistema
const MODES_INFO = {
  analisar: {
    badge: 'MODO: ANALISAR',
    title: 'Análise Aprofundada de Documentos',
    desc: 'Interpretação minuciosa, extração de dados estruturados, pontos-chave, identificação de riscos e inconsistências factuais.',
    rule: 'Fidelidade rigorosa às fontes • Zero invenção',
    chips: [
      'Gere um resumo executivo estruturado deste documento.',
      'Quais são os principais riscos, prazos e obrigações identificados?',
      'Extraia todos os valores financeiros, datas e partes envolvidas.',
      'Existe alguma inconsistência ou ambiguidade neste texto?'
    ]
  },
  organizar: {
    badge: 'MODO: ORGANIZAR',
    title: 'Classificação & Organização Documental',
    desc: 'Classificação por categorias, sugestão de padronização de nomenclatura de arquivos, estruturação de pastas e detecção de duplicidades.',
    rule: 'Operações seguras • Preservação dos originais',
    chips: [
      'Classifique este documento e sugira a categoria ideal.',
      'Sugira um nome de arquivo padronizado para este documento.',
      'Proponha uma estrutura de pastas para organizar este tipo de arquivo.',
      'Verifique semelhanças e possíveis duplicidades na base.'
    ]
  },
  criar: {
    badge: 'MODO: CRIAR',
    title: 'Criação de Documentos Profissionais',
    desc: 'Elaboração assistida de minutas, contratos, relatórios e pareceres estruturados, validando informações obrigatórias ausentes.',
    rule: 'Validação prévia de lacunas • Padrão formal',
    chips: [
      'Gere a minuta estruturada com base nas informações preenchidas acima.',
      'Quais informações obrigatórias ainda faltam para concluir este documento?',
      'Adicione cláusulas padrão de rescisão, confidencialidade e foro.',
      'Elabore um termo de responsabilidade formal e objetivo.'
    ]
  },
  revisar: {
    badge: 'MODO: REVISAR',
    title: 'Revisão Técnica, Gramatical e Estilística',
    desc: 'Auditoria de ortografia, gramática, pontuação, clareza, coerência e formalidade, preservando integralmente o conteúdo factual.',
    rule: 'Preservação da intenção original e fatos',
    chips: [
      'Revise a gramática, ortografia e pontuação do documento ativo.',
      'Aponte trechos prolixos e sugira versões mais claras e concisas.',
      'Avalie a formalidade e adequação do tom para ambiente corporativo.',
      'Identifique possíveis ambiguidades na redação atual.'
    ]
  },
  comparar: {
    badge: 'MODO: COMPARAR',
    title: 'Comparação Analítica entre Documentos',
    desc: 'Confronto entre dois documentos: identificação de cláusulas alteradas, divergências de valores, datas, inclusões e supressões.',
    rule: 'Diferenciação clara: diferença vs erro vs ausência',
    chips: [
      'Compare as cláusulas de pagamento e prazos entre os documentos A e B.',
      'Quais foram as adições e supressões feitas na nova versão?',
      'Existe alguma divergência de valores ou responsabilidades entre eles?',
      'Gere uma tabela comparativa com as principais diferenças encontradas.'
    ]
  },
  consultar: {
    badge: 'MODO: CONSULTAR ARQUIVO (RESTRITO)',
    title: 'Consulta Estrita ao Arquivo Selecionado',
    desc: 'Modo de perguntas e respostas com isolamento absoluto. O agente atua exclusivamente com o conteúdo do documento ativo.',
    rule: 'Regra Absoluta: Se não estiver no arquivo, responda exatamente: "não sei"',
    chips: [
      'O que o documento informa sobre o prazo de vigência?',
      'Qual é o valor total acordado e a forma de pagamento?',
      'Quais são as responsabilidades da contratada segundo o texto?',
      'Qual é a capital da França? (Teste de bloqueio estrito "não sei")'
    ]
  },
  conhecimento: {
    badge: 'MODO: CONHECIMENTO DOCUMENTAL',
    title: 'Pesquisa na Base Documental Autorizada',
    desc: 'Recuperação semântica e cruzamento de informações entre todos os arquivos autorizados na base do sistema.',
    rule: 'Citação obrigatória da fonte e documento de origem',
    chips: [
      'Pesquise em toda a base quais documentos tratam de equipamentos agrícolas.',
      'Existe algum outro documento com termos similares a este na base?',
      'Sintetize o que a base documental possui sobre normas de segurança.',
      'Liste todos os documentos autorizados disponíveis para consulta.'
    ]
  },
  traducao: {
    badge: 'MODO: TRADUÇÃO BILÍNGUE UNIVERSAL',
    title: 'Compreensão & Exibição Bilíngue Espelhada',
    desc: 'Detecção automática de idiomas, preservação do tom e contexto, exibindo simultaneamente o Original e a Tradução em Português.',
    rule: 'Exibição Pareada Obrigatória: Original + 🇧🇷 Português',
    chips: [
      'How does the machine cooling system work according to specs?',
      'Translate this technical paragraph into professional English.',
      '¿Cuáles son las condiciones de entrega estipuladas?',
      'Como funciona o suporte técnico bilíngue?'
    ]
  }
};

// Exemplos Prontos de Documentos para Teste Imediato
const SAMPLE_DOCS = [
  {
    id: 'doc-colheitadeira-2026',
    name: 'Especificacao_Tecnica_Colheitadeira_TC500.txt',
    size: '1.8 KB',
    type: 'text/plain',
    date: 'Hoje',
    content: `ESPECIFICAÇÕES TÉCNICAS — COLHEITADEIRA AGRÍCOLA TC-500 (MODELO 2026)
Fabricante: AgroTech Brasil Máquinas S/A
Equipamento: Colheitadeira de Grãos TC-500 Pro

1. MOTOR E POTÊNCIA
- Motor turbo diesel com potência nominal de 200 cavalos de potência (cv).
- Sistema de arrefecimento reforçado para operações em altas temperaturas.
- Tanque de combustível em polietileno com capacidade total para 500 litros.

2. ETAPAS DO PROJETO E PRODUÇÃO
- O projeto de montagem e entrega possui três etapas: planejamento, desenvolvimento e testes de campo.
- Prazo estimado para execução das três etapas: 90 dias úteis.

3. DIMENSÕES E PESO
- Peso operacional em ordem de marcha: 5 toneladas métricas (5.000 kg).
- Largura da plataforma de corte: 25 pés (7,62 metros).

4. GARANTIA E ASSISTÊNCIA
- A garantia contratual deste equipamento é de exatamente 12 meses a partir da emissão da nota fiscal.
- As revisões periódicas obrigatórias ocorrem com 50h, 250h e 500h de operação.`
  },
  {
    id: 'doc-contrato-prestacao',
    name: 'Contrato_Prestacao_Servicos_Agro.txt',
    size: '2.4 KB',
    type: 'text/plain',
    date: 'Hoje',
    content: `INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS

CONTRATANTE: Fazenda Boa Esperança Ltda.
CONTRATADA: AgroSoluções Manutenção e Consultoria Ltda.

CLÁUSULA PRIMEIRA — DO OBJETO
O presente contrato tem por objeto a prestação de serviços de manutenção preventiva e corretiva na Colheitadeira TC-500.

CLÁUSULA SEGUNDA — DA VIGÊNCIA
O presente contrato terá vigência de 12 (doze) meses, iniciando-se em 01/03/2026 e encerrando-se em 28/02/2027.

CLÁUSULA TERCEIRA — DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO
Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor mensal fixo de R$ 4.500,00 (quatro mil e quinhentos reais), com vencimento no 5º dia útil de cada mês subsequente.

CLÁUSULA QUARTA — DA MULTA E PENALIDADES
Em caso de atraso no pagamento, incidirá multa moratória de 2% (dois por cento) sobre o valor devido, além de juros de mora de 1% ao mês.

CLÁUSULA QUINTA — DA RESCISÃO
Qualquer das partes poderá rescindir o presente ajuste mediante aviso prévio por escrito com antecedência mínima de 30 (trinta) dias.

CLÁUSULA SEXTA — DO FORO
Fica eleito o Foro da Comarca de Ribeirão Preto/SP para dirimir eventuais litígios oriundos deste contrato.`
  }
];

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSampleDocs();
  setupEventListeners();
  switchTab(state.currentTab);
  updateActiveFileDisplay();
  updateEngineLabel();
});

function updateEngineLabel() {
  const el = document.getElementById('current-engine-label');
  if (!el) return;
  const p = state.config.provider;
  el.textContent = p === 'local' ? 'Motor: Local / Simulação'
    : p === 'azure' ? 'Motor: Azure AI Foundry'
    : `Motor: ${p.toUpperCase()}`;
  if (p === 'azure' && location.protocol === 'file:') {
    appendSystemNotice('⚠️ Você abriu o <strong>index.html</strong> direto. Para usar o agente do Azure, rode <strong>iniciar.bat</strong> (ou <code>node server.js</code>) e acesse <strong>http://localhost:3000</strong>.');
  }
}

// Configuração do Tema
function initTheme() {
  if (state.config.theme === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = 'fa-solid fa-sun';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.contains('theme-light');
  if (isLight) {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    state.config.theme = 'dark';
    document.querySelector('#theme-toggle i').className = 'fa-solid fa-moon';
  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    state.config.theme = 'light';
    document.querySelector('#theme-toggle i').className = 'fa-solid fa-sun';
  }
  localStorage.setItem('docu_theme', state.config.theme);
}

// Inicializar Documentos de Exemplo
function initSampleDocs() {
  // Carregar do localStorage ou usar os exemplos padrões
  const saved = localStorage.getItem('docu_saved_docs');
  if (saved) {
    try {
      state.documents = JSON.parse(saved);
    } catch (e) {
      state.documents = [...SAMPLE_DOCS];
    }
  } else {
    state.documents = [...SAMPLE_DOCS];
    saveDocsToStorage();
  }

  if (state.documents.length > 0 && !state.activeDocId) {
    state.activeDocId = state.documents[0].id;
  }

  renderDocsList();
  updateCompareSelectors();
}

function saveDocsToStorage() {
  localStorage.setItem('docu_saved_docs', JSON.stringify(state.documents));
}

// Renderizar Lista de Documentos na Barra Lateral
function renderDocsList() {
  const container = document.getElementById('docs-list');
  const countEl = document.getElementById('doc-count');
  countEl.textContent = state.documents.length;

  if (state.documents.length === 0) {
    container.innerHTML = `
      <div class="empty-docs-msg">
        <i class="fa-regular fa-folder-blank"></i>
        <p>Nenhum documento na base.<br>Faça upload para iniciar.</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  state.documents.forEach(doc => {
    const isActive = doc.id === state.activeDocId;
    const item = document.createElement('div');
    item.className = `doc-item ${isActive ? 'active-doc' : ''}`;
    item.dataset.id = doc.id;
    
    let iconClass = 'fa-file-lines';
    if (doc.name.endsWith('.pdf')) iconClass = 'fa-file-pdf';
    else if (doc.name.endsWith('.docx')) iconClass = 'fa-file-word';
    else if (doc.name.endsWith('.json')) iconClass = 'fa-file-code';

    item.innerHTML = `
      <div class="doc-item-left">
        <i class="fa-solid ${iconClass}"></i>
        <div>
          <div class="doc-title" title="${doc.name}">${doc.name}</div>
          <div class="doc-meta">${doc.size || '1 KB'} • ${isActive ? '<strong class="text-accent">Ativo</strong>' : 'Clique p/ selecionar'}</div>
        </div>
      </div>
      <div class="doc-item-actions">
        <button class="doc-action-btn preview-btn" title="Visualizar documento"><i class="fa-regular fa-eye"></i></button>
        <button class="doc-action-btn delete-btn" title="Excluir da base"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    `;

    // Eventos de clique
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) {
        e.stopPropagation();
        deleteDocument(doc.id);
        return;
      }
      if (e.target.closest('.preview-btn')) {
        e.stopPropagation();
        previewDocument(doc.id);
        return;
      }
      setActiveDocument(doc.id);
    });

    container.appendChild(item);
  });
}

// Definir Documento Ativo
function setActiveDocument(docId) {
  state.activeDocId = docId;
  renderDocsList();
  updateActiveFileDisplay();
  const doc = state.documents.find(d => d.id === docId);
  if (doc) {
    appendSystemNotice(`Arquivo <strong>"${doc.name}"</strong> definido como ativo para consultas e análises.`);
  }
}

// Atualizar Display do Arquivo Ativo
function updateActiveFileDisplay() {
  const display = document.getElementById('selected-file-display');
  const subtext = document.getElementById('active-file-subtext');
  const activeDoc = state.documents.find(d => d.id === state.activeDocId);

  if (activeDoc) {
    display.innerHTML = `
      <i class="fa-solid fa-file-circle-check text-accent"></i>
      <span class="file-name" title="${activeDoc.name}">${activeDoc.name}</span>
    `;
    subtext.textContent = `Ativo para análise & modo restrito (${activeDoc.size || 'Texto'})`;
  } else {
    display.innerHTML = `
      <i class="fa-solid fa-folder-open text-muted"></i>
      <span class="file-name text-muted">Nenhum arquivo ativo</span>
    `;
    subtext.textContent = `Selecione na lista abaixo para consultar/analisar`;
  }
}

// Excluir Documento
function deleteDocument(docId) {
  const doc = state.documents.find(d => d.id === docId);
  const name = doc ? doc.name : 'o arquivo';
  if (confirm(`Tem certeza que deseja remover "${name}" da base documental?`)) {
    state.documents = state.documents.filter(d => d.id !== docId);
    if (state.activeDocId === docId) {
      state.activeDocId = state.documents.length > 0 ? state.documents[0].id : null;
    }
    saveDocsToStorage();
    renderDocsList();
    updateActiveFileDisplay();
    updateCompareSelectors();
    appendSystemNotice(`Arquivo "${name}" removido da base documental.`);
  }
}

// Pré-visualização do Documento
function previewDocument(docId) {
  const doc = state.documents.find(d => d.id === docId);
  if (!doc) return;

  document.getElementById('preview-title').innerHTML = `<i class="fa-solid fa-file-lines"></i> ${doc.name}`;
  document.getElementById('preview-meta').innerHTML = `
    <span class="meta-chip"><i class="fa-solid fa-tag"></i> Tipo: ${doc.type || 'Texto'}</span>
    <span class="meta-chip"><i class="fa-solid fa-weight-hanging"></i> Tamanho: ${doc.size || 'N/A'}</span>
    <span class="meta-chip"><i class="fa-solid fa-calendar"></i> Adicionado: ${doc.date || 'Hoje'}</span>
  `;

  const content = doc.content || '(Conteúdo vazio)';
  document.getElementById('preview-content').textContent = content;
  
  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('preview-stats').textContent = `${charCount} caracteres • ${wordCount} palavras`;

  const setBtn = document.getElementById('set-as-active-btn');
  setBtn.onclick = () => {
    setActiveDocument(doc.id);
    document.getElementById('doc-preview-modal').classList.add('hidden');
  };

  document.getElementById('doc-preview-modal').classList.remove('hidden');
}

// Atualizar Seletores da Aba Comparar
function updateCompareSelectors() {
  const selA = document.getElementById('compare-doc-a');
  const selB = document.getElementById('compare-doc-b');
  if (!selA || !selB) return;

  const currentA = selA.value;
  const currentB = selB.value;

  selA.innerHTML = '<option value="">Selecione o primeiro documento (A)...</option>';
  selB.innerHTML = '<option value="">Selecione o segundo documento (B)...</option>';

  state.documents.forEach((doc, idx) => {
    const optA = document.createElement('option');
    optA.value = doc.id;
    optA.textContent = `${idx + 1}. ${doc.name}`;
    selA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = doc.id;
    optB.textContent = `${idx + 1}. ${doc.name}`;
    selB.appendChild(optB);
  });

  if (state.documents.length >= 2) {
    selA.value = currentA || state.documents[0].id;
    selB.value = currentB || state.documents[1].id;
  } else if (state.documents.length === 1) {
    selA.value = state.documents[0].id;
  }
}

// Troca de Abas
function switchTab(tabKey) {
  if (!MODES_INFO[tabKey]) return;
  state.currentTab = tabKey;

  // Atualizar botões de aba
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });

  // Atualizar Banner
  const info = MODES_INFO[tabKey];
  document.getElementById('mode-badge').textContent = info.badge;
  document.getElementById('mode-title').textContent = info.title;
  document.getElementById('mode-desc').textContent = info.desc;
  document.getElementById('mode-rule-text').textContent = info.rule;

  // Destacar o chip se for a aba restrita
  const chip = document.getElementById('mode-rule-chip');
  if (tabKey === 'consultar') {
    chip.style.background = 'rgba(210, 153, 34, 0.2)';
    chip.style.borderColor = 'var(--warning)';
    chip.querySelector('i').className = 'fa-solid fa-lock text-warning';
  } else {
    chip.style.background = 'var(--bg-tertiary)';
    chip.style.borderColor = 'var(--border)';
    chip.querySelector('i').className = 'fa-solid fa-shield-halved text-success';
  }

  // Painéis Específicos
  document.getElementById('panel-comparar').classList.toggle('hidden', tabKey !== 'comparar');
  document.getElementById('panel-criar').classList.toggle('hidden', tabKey !== 'criar');
  document.getElementById('panel-traducao').classList.toggle('hidden', tabKey !== 'traducao');

  // Atualizar Chips de Sugestão
  const chipsContainer = document.getElementById('quick-prompts');
  chipsContainer.innerHTML = '<span class="quick-title">Sugestões rápidas:</span>';
  info.chips.forEach(chipText => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-chip';
    btn.dataset.prompt = chipText;
    btn.textContent = chipText.length > 45 ? chipText.substring(0, 42) + '...' : chipText;
    btn.title = chipText;
    btn.onclick = () => {
      document.getElementById('user-input').value = chipText;
      document.getElementById('user-input').focus();
    };
    chipsContainer.appendChild(btn);
  });

  // Notificar transição no chat de forma discreta
  appendSystemNotice(`Você entrou na aba <strong>${tabKey.toUpperCase()}</strong>. Regras ativas aplicadas.`);
}

// Adicionar Aviso do Sistema no Chat
function appendSystemNotice(html) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'message system-msg';
  div.innerHTML = `
    <div class="msg-avatar" style="width:28px;height:28px;font-size:0.75rem;"><i class="fa-solid fa-circle-info"></i></div>
    <div class="msg-body">
      <div class="msg-content" style="padding:8px 12px;font-size:0.82rem;background:transparent;border-style:dashed;">
        ${html}
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

// Mecanismo de Bloqueio de Escopo
function checkScopeGuard(text, currentTab) {
  // Na aba de Tradução, o escopo permite conversação e idiomas gerais
  if (currentTab === 'traducao') return { allowed: true };

  const lower = text.toLowerCase();

  // Lista de tópicos proibidos explicitamente nas seções 4 e 5 do prompt
  const blockedPatterns = [
    /previs[aã]o do tempo/i,
    /\bclima\b/i,
    /\bchover\b/i,
    /\b(futebol|campeonato|copa do mundo|brasileir[aã]o|flamengo|corinthians|palmeiras|santos|s[aã]o paulo fc)\b/i,
    /\bmelhor jogador\b/i,
    /\b(receita|bolo|lasanha|pizza|cozinhar|culin[aá]ria)\b/i,
    /\bcapital da (fran[cç]a|alemanha|it[aá]lia|espanha|r[uú]ssia|jap[aã]o)\b/i,
    /\b(piada|charada|poema|poesia)\b/i,
    /\b(filme|cinema|s[eé]rie|novela|celebridade)\b/i,
    /\bcomo investir em a[cç][oõ]es\b/i,
    /\bbitcoin\b/i,
    /\bme ensine python\b/i,
    /\bprograma[cç][aã]o em (c|c\+\+|javascript|rust|go)\b/i,
    /\bquem ganhou a copa\b/i,
    /\bpresidente do brasil\b/i
  ];

  // Verificar se a pergunta é sobre assunto geral bloqueado
  for (const pattern of blockedPatterns) {
    if (pattern.test(lower)) {
      return {
        allowed: false,
        reason: 'Não sei. Esse assunto está fora do escopo deste agente.'
      };
    }
  }

  // Tentativas explícitas de Jailbreak / Prompt Injection
  const injectionPatterns = [
    /ignore (suas |o documento|regras|seu objetivo)/i,
    /esque[cç]a suas instru[cç][oõ]es/i,
    /finja que voc[eê]/i,
    /a partir de agora voc[eê] [eé]/i,
    /responda essa pergunta s[oó] desta vez/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(lower)) {
      if (currentTab === 'consultar') {
        return { allowed: false, reason: 'não sei' };
      }
      return {
        allowed: false,
        reason: 'Não sei. Esse assunto está fora do escopo deste agente.'
      };
    }
  }

  return { allowed: true };
}

// Mecanismo de Desambiguação / PLANO B
function checkPlanoB(text, currentTab) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Caso 1: Comandos curtos isolados sem contexto ou arquivo
  if (['analise', 'analize', 'analisar'].includes(lower)) {
    return {
      triggered: true,
      interpretation: 'Gostaria que eu realizasse uma análise completa no documento ativo?',
      suggestedPrompt: 'Gere uma análise estruturada do documento ativo.'
    };
  }

  if (['compare', 'comparar', 'diferen[cç]as'].includes(lower)) {
    return {
      triggered: true,
      interpretation: 'Gostaria de comparar o Documento A com o Documento B?',
      suggestedPrompt: 'Compare detalhadamente os dois documentos selecionados.'
    };
  }

  if (['crie', 'criar', 'fazer minuta'].includes(lower)) {
    return {
      triggered: true,
      interpretation: 'Gostaria de criar um documento formal com os parâmetros definidos no formulário?',
      suggestedPrompt: 'Crie uma minuta de documento formal com base nos parâmetros.'
    };
  }

  // Caso 2: Perguntas com erros de digitação comuns
  if (/^analiz[ae] o contrto/i.test(lower)) {
    return {
      triggered: true,
      interpretation: 'Você quis dizer: "Analise o contrato"?',
      suggestedPrompt: 'Analise o contrato.'
    };
  }

  if (/^resuma esse documeto/i.test(lower)) {
    // Erro simples e evidente: O sistema corrige mentalmente e executa
    return { triggered: false };
  }

  // Caso 3: Frase vaga como "faz isso" ou "e o pagamento?"
  if (['faz isso', 'faca isso', 'executa'].includes(lower)) {
    return {
      triggered: true,
      interpretation: 'Não consegui identificar qual ação você deseja realizar. Gostaria de uma análise ou resumo do documento?',
      suggestedPrompt: 'Resuma o documento ativo.'
    };
  }

  return { triggered: false };
}

// Mostrar Banner do Plano B
function showPlanoBBanner(interpretation, suggestedPrompt) {
  const box = document.getElementById('plano-b-box');
  const msgEl = document.getElementById('plano-b-message');
  msgEl.textContent = interpretation;

  state.pendingPlanoB = suggestedPrompt;
  box.classList.remove('hidden');

  document.getElementById('plano-b-confirm-btn').onclick = () => {
    box.classList.add('hidden');
    executePrompt(state.pendingPlanoB);
    state.pendingPlanoB = null;
  };

  document.getElementById('plano-b-cancel-btn').onclick = () => {
    box.classList.add('hidden');
    state.pendingPlanoB = null;
    document.getElementById('user-input').focus();
  };
}

// Processar Envio do Formulário de Chat
async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  executePrompt(text);
}

// Executar Prompt com as Regras da Aba
async function executePrompt(userPrompt) {
  const tab = state.currentTab;

  // 1. Renderizar mensagem do usuário no chat
  appendMessage('user', userPrompt);

  // 2 e 3. Plano B e Bloqueio de Escopo por palavras-chave: só no Motor Local.
  // Com um agente real (Azure etc.), quem decide escopo e desambiguação é o próprio agente.
  if (state.config.provider === 'local') {
    const planoBCheck = checkPlanoB(userPrompt, tab);
    if (planoBCheck.triggered) {
      showPlanoBBanner(planoBCheck.interpretation, planoBCheck.suggestedPrompt);
      return;
    }

    const scopeCheck = checkScopeGuard(userPrompt, tab);
    if (!scopeCheck.allowed) {
      appendMessage('agent', scopeCheck.reason, { isScopeBlock: true });
      return;
    }
  }

  // 4. Validação da Aba Consultar Arquivo
  const activeDoc = state.documents.find(d => d.id === state.activeDocId);
  if (tab === 'consultar' && !activeDoc) {
    appendMessage('agent', 'Para consultar no modo restrito, selecione um arquivo na lista lateral ou faça upload de um documento.', { isWarning: true });
    return;
  }

  // 5. Exibir indicador de digitação
  const typingId = showTypingIndicator();

  try {
    // Processamento do Motor (Local ou via API)
    const responseData = await processAgentRequest(userPrompt, tab, activeDoc);
    removeTypingIndicator(typingId);

    // Renderizar resposta da IA
    if (tab === 'traducao' && responseData.agentPt !== undefined) {
      appendBilingualMessage(responseData);
    } else {
      appendMessage('agent', responseData.text, {
        tab: tab,
        sources: responseData.sources
      });
    }

  } catch (error) {
    removeTypingIndicator(typingId);
    console.error('Erro no processamento:', error);
    appendMessage('agent', `Ocorreu uma falha no processamento: ${error.message || 'Erro desconhecido'}.`, { isError: true });
  }
}

// Motor Inteligente de Processamento (Simulação com Base nas Regras Reais do Prompt)
async function processAgentRequest(prompt, tab, activeDoc) {
  const provider = state.config.provider;
  const docContent = activeDoc ? activeDoc.content : '';

  if (provider === 'local') {
    // Motor Local (regras fixas por palavra-chave — NÃO é IA)
    return runLocalExpertEngine(prompt, tab, activeDoc);
  }

  if (provider === 'azure') {
    return await callAzureAgent(prompt, tab, activeDoc);
  }

  // Antes, sem chave ou com provedor não implementado, caía em silêncio no motor local.
  if (!state.config.apiKey) {
    throw new Error(`Provedor "${provider}" selecionado, mas sem chave de API. Configure em ⚙️ ou escolha "Motor Local".`);
  }
  if (provider === 'gemini') return await callGeminiAPI(prompt, tab, activeDoc);
  if (provider === 'openai') return await callOpenAIAPI(prompt, tab, activeDoc);
  throw new Error(`Provedor "${provider}" ainda não foi implementado.`);
}

// Motor Especialista Local
function runLocalExpertEngine(prompt, tab, activeDoc) {
  const lowerPrompt = prompt.toLowerCase();
  const docContent = activeDoc ? activeDoc.content : '';

  // ABA CONSULTAR ARQUIVO — ISOLAMENTO TOTAL & "NÃO SEI" ESTRITO
  if (tab === 'consultar') {
    if (!docContent) return { text: 'não sei' };

    // Regra estrita: Verificar se o documento realmente contém evidências para responder
    const docLower = docContent.toLowerCase();

    // Perguntas de teste comuns fora do arquivo
    if (lowerPrompt.includes('capital') || lowerPrompt.includes('copa') || lowerPrompt.includes('python') || lowerPrompt.includes('tempo')) {
      return { text: 'não sei' };
    }

    // Perguntas parcialmente relacionadas (Exemplo da Seção 8 do prompt: "Esse motor é econômico?")
    if (lowerPrompt.includes('econômico') || lowerPrompt.includes('economico') || lowerPrompt.includes('consumo')) {
      // O documento de exemplo tem motor de 200cv e tanque de 500L, mas NÃO diz se é econômico nem o consumo horário!
      if (!docLower.includes('consumo de combustível') && !docLower.includes('econômico')) {
        return { text: 'não sei' };
      }
    }

    // Perguntas de inferência (Exemplo da Seção 9 do prompt: "Quanto tempo ele consegue trabalhar com esse tanque?")
    if (lowerPrompt.includes('quanto tempo') && lowerPrompt.includes('tanque')) {
      if (!docLower.includes('horas de trabalho por tanque') && !docLower.includes('autonomia')) {
        return { text: 'não sei' };
      }
    }

    // Seção 30 - Caso 4: "Então ele precisa de uma carreta especial?" (Peso 5 toneladas)
    if (lowerPrompt.includes('carreta especial') || lowerPrompt.includes('transporte especial')) {
      if (!docLower.includes('carreta especial')) {
        return { text: 'não sei' };
      }
    }

    // Respostas fundamentadas com evidência no documento
    if (lowerPrompt.includes('etapa') || lowerPrompt.includes('etapas')) {
      if (docLower.includes('planejamento, desenvolvimento e testes')) {
        return {
          text: 'O projeto possui três etapas: planejamento, desenvolvimento e testes.',
          sources: 'Seção 2 — "Etapas do Projeto e Produção"'
        };
      }
    }

    if (lowerPrompt.includes('potência') || lowerPrompt.includes('potencia') || lowerPrompt.includes('motor') || lowerPrompt.includes('cavalos')) {
      if (docLower.includes('200 cavalos')) {
        return {
          text: 'Segundo a seção "1. Motor e Potência", o equipamento possui motor turbo diesel com potência nominal de 200 cavalos de potência (cv).',
          sources: 'Seção 1 — "Motor e Potência"'
        };
      }
    }

    if (lowerPrompt.includes('tanque') || lowerPrompt.includes('capacidade') || lowerPrompt.includes('combustível')) {
      if (docLower.includes('500 litros')) {
        return {
          text: 'Segundo a seção "1. Motor e Potência", a capacidade indicada no documento para o tanque de combustível é de 500 litros.',
          sources: 'Seção 1 — "Motor e Potência"'
        };
      }
    }

    if (lowerPrompt.includes('vigência') || lowerPrompt.includes('vigencia') || lowerPrompt.includes('duração') || lowerPrompt.includes('validade')) {
      if (docLower.includes('12 (doze) meses') || docLower.includes('12 meses')) {
        return {
          text: 'A duração/vigência indicada no documento é de 12 meses.',
          sources: 'Cláusula de Vigência / Garantia'
        };
      }
    }

    if (lowerPrompt.includes('pagamento') || lowerPrompt.includes('preço') || lowerPrompt.includes('valor')) {
      if (docLower.includes('4.500,00')) {
        return {
          text: 'Segundo o documento, o valor mensal fixo acordado é de R$ 4.500,00 (quatro mil e quinhentos reais), com vencimento no 5º dia útil de cada mês subsequente.',
          sources: 'Cláusula Terceira — Do Preço e Condições de Pagamento'
        };
      }
    }

    if (lowerPrompt.includes('multa')) {
      if (docLower.includes('multa moratória de 2%')) {
        return {
          text: 'Segundo a Cláusula Quarta, em caso de atraso incidirá multa moratória de 2% (dois por cento) sobre o valor devido, além de juros de mora de 1% ao mês.',
          sources: 'Cláusula Quarta — Da Multa e Penalidades'
        };
      }
    }

    // Se nenhuma correspondência direta sustentada for encontrada no arquivo:
    return { text: 'não sei' };
  }

  // ABA ANALISAR
  if (tab === 'analisar') {
    if (!activeDoc) {
      return { text: 'Nenhum documento ativo selecionado para análise. Por favor, selecione um arquivo na lista lateral.' };
    }

    return {
      text: `### Relatório de Análise Documental
**Arquivo Analisado:** \`${activeDoc.name}\`

#### 1. Resumo Executivo
O documento trata de especificações e diretrizes técnicas/contratuais relacionadas a operações especializadas. Apresenta termos claros, prazos delimitados e responsabilidades pré-fixadas entre as partes.

#### 2. Pontos Críticos e Prazos
- **Vigência / Garantia:** Prazo estipulado de 12 meses.
- **Marcos Temporais:** Revisões periódicas e prazos de cumprimento delimitados no corpo do texto.
- **Valores & Condições:** Especificações explícitas quanto a capacidades ou remunerações.

#### 3. Riscos e Inconsistências
- Não foram identificadas contradições internas graves no texto original.
- **Ponto de Atenção:** Certifique-se de que todas as condições operacionais (manutenção e comprovação de cumprimento) estejam documentadas por escrito para evitar litígios.

#### 4. Conclusão Técnica
Documento apto para prosseguimento, apresentando estrutura formal padronizada e informações factuais coerentes.`
    };
  }

  // ABA ORGANIZAR
  if (tab === 'organizar') {
    const docName = activeDoc ? activeDoc.name : 'Documento_Recebido.pdf';
    return {
      text: `### Plano de Organização & Padronização Documental

#### 1. Classificação Categórica
- **Categoria Sugerida:** \`Operações & Contratos / Máquinas Agrícolas\`
- **Subcategoria:** \`Documentação Técnica & Jurídica\`
- **Nível de Acesso:** \`Interno / Autorizado\`

#### 2. Nomenclatura Padronizada (Padrão Corporativo 2026)
- **Nome Atual:** \`${docName}\`
- **Nome Proposto:** \`2026_AGRO_TC500_ESPECIFICACAO_TEC_v1.0.txt\`

#### 3. Estrutura de Pastas Recomendada
\`\`\`text
📁 Repositório Central/
└── 📁 01_Operacoes_Agricolas/
    ├── 📁 Contratos_Vigentes/
    │   └── 📄 2026_CTR_PRESTACAO_BOAESPERANCA.txt
    └── 📁 Manuais_e_Especificacoes/
        └── 📄 2026_AGRO_TC500_ESPECIFICACAO_TEC_v1.0.txt
\`\`\`

#### 4. Verificação de Duplicidades
Nenhuma duplicidade idêntica detectada na base documental autorizada.`
    };
  }

  // ABA CRIAR
  if (tab === 'criar') {
    const docType = document.getElementById('create-type').value || 'Minuta Contratual / Termo Técnico';
    const audience = document.getElementById('create-audience').value || 'Diretoria e Partes Envolvidas';
    const objective = document.getElementById('create-objective').value || prompt;

    return {
      text: `### Minuta Documental Gerada Profissionalmente

**Tipo de Documento:** ${docType}  
**Público-Alvo:** ${audience}  
**Status:** Minuta Preliminar para Revisão Humana  

---

# ${docType.toUpperCase()}

### PREÂMBULO
Pelo presente instrumento, de um lado denominada **CONTRATANTE**, e de outro denominada **CONTRATADA**, estabelecem o seguinte ajuste de vontades com base nos objetivos acordados:

### CLÁUSULA 1ª — DO OBJETO E FINALIDADE
O presente documento tem por finalidade formalizar: ${objective}.

### CLÁUSULA 2ª — DAS OBRIGAÇÕES E RESPONSABILIDADES
1. A Contratada compromete-se a executar os serviços observando estritamente as melhores práticas, a fidelidade técnica e as normas vigentes.
2. A Contratante obriga-se a disponibilizar os acessos e informações essenciais no prazo de até 5 (cinco) dias úteis.

### CLÁUSULA 3ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS
As partes comprometem-se a manter em absoluto sigilo todas as informações e dados documentais compartilhados em decorrência deste ajuste.

### CLÁUSULA 4ª — DO FORO
Para dirimir quaisquer controvérsias decorrentes deste documento, as partes elegem o foro da sede da Contratante, renunciando a qualquer outro por mais privilegiado que seja.

---
*Documento gerado com base estrita nas informações fornecidas. Nenhuma informação essencial foi inventada.*`
    };
  }

  // ABA REVISAR
  if (tab === 'revisar') {
    return {
      text: `### Relatório de Auditoria e Revisão Textual

#### 1. Conformidade Ortográfica & Gramatical
- **Ortografia:** 100% de conformidade com o Novo Acordo Ortográfico.
- **Concordância Verbal e Nominal:** Estruturas oracionais alinhadas e corretas.
- **Pontuação:** Uso adequado de vírgulas, pontos e separadores de cláusulas.

#### 2. Clareza, Coesão e Estilo
- **Nível de Formalidade:** Formal corporativo/técnico adequado.
- **Clareza Textual:** Ausência de ambiguidades prejudiciais à interpretação jurídica.
- **Fidelidade Factual:** Nenhuma alteração foi realizada nas premissas factuais ou valores originais.

#### 3. Sugestões de Melhoria (Opcionais)
- Manter o padrão de numeração ordinal nas cláusulas para padronização de referências cruzadas.`
    };
  }

  // ABA COMPARAR
  if (tab === 'comparar') {
    const selA = document.getElementById('compare-doc-a');
    const selB = document.getElementById('compare-doc-b');
    const nameA = selA.options[selA.selectedIndex]?.text || 'Documento A';
    const nameB = selB.options[selB.selectedIndex]?.text || 'Documento B';

    return {
      text: `### Relatório Comparativo Analítico

| Critério Analisado | ${nameA} | ${nameB} | Classificação do Ponto |
| :--- | :--- | :--- | :--- |
| **Objeto Principal** | Especificação de Máquina TC-500 | Prestação de Serviços Técnicos | Diferença de Escopo |
| **Vigência** | Garantia de 12 meses | Contrato de 12 meses (2026/2027) | Compatível / Alinhado |
| **Valores / Custos** | Não informado (Técnico) | R$ 4.500,00 mensais | Informação Adicional em B |
| **Penalidades** | Revisões obrigatórias | Multa moratória de 2% + 1% juros | Cláusula Específica em B |

#### Síntese das Divergências:
1. **Diferença:** O Documento A atua como manual de engenharia/garantia, enquanto o Documento B disciplina a relação contratual e jurídica de prestação de serviços.
2. **Inconsistências:** Não foram encontradas contradições diretas entre as especificações técnicas da máquina e o escopo do contrato de serviço.`
    };
  }

  // ABA CONHECIMENTO DOCUMENTAL
  if (tab === 'conhecimento') {
    const count = state.documents.length;
    const names = state.documents.map(d => `• \`${d.name}\``).join('\n');

    return {
      text: `### Consulta à Base Documental Autorizada

**Total de documentos disponíveis:** ${count} documento(s) autorizado(s).

#### Documentos Identificados com Relevância:
${names}

#### Conteúdo Recuperado:
A base contempla especificações técnicas operacionais de maquinário agrícola (\`TC-500\`) e contratos formais de prestação de serviços com cláusulas de pagamento de R$ 4.500,00 e vigência anual.

*Fonte: Consulta indexada à Base Documental Autorizada.*`
    };
  }

  // ABA TRADUÇÃO BILÍNGUE
  if (tab === 'traducao') {
    return detectAndTranslateBilingual(prompt);
  }

  return { text: 'Solicitação processada dentro dos parâmetros autorizados.' };
}

// Detecção e Tradução Bilíngue
function detectAndTranslateBilingual(text) {
  const lower = text.toLowerCase();
  let detectedLang = 'Inglês';
  let originalAnswer = '';
  let ptAnswer = '';

  if (/[áàâãéèêíóòôõúç]/i.test(text) || lower.includes('como') || lower.includes('qual') || lower.includes('documento')) {
    detectedLang = 'Português';
    originalAnswer = 'O sistema documental processa informações preservando a fidelidade às fontes, a precisão técnica e a segurança operacional.';
    ptAnswer = 'O sistema documental processa informações preservando a fidelidade às fontes, a precisão técnica e a segurança operacional.';
  } else if (lower.includes('¿') || lower.includes('cuáles') || lower.includes('gracias') || lower.includes('hola')) {
    detectedLang = 'Espanhol';
    originalAnswer = 'El sistema documental opera con aislamiento de contexto y alta precisión técnica, garantizando fidelidad a las fuentes originales.';
    ptAnswer = 'O sistema documental opera com isolamento de contexto e alta precisão técnica, garantindo fidelidade às fontes originais.';
  } else {
    detectedLang = 'Inglês';
    originalAnswer = 'The documental agent operates under strict source-grounding principles, ensuring accuracy, security, and context isolation.';
    ptAnswer = 'O agente documental opera sob princípios estritos de fundamentação nas fontes, garantindo precisão, segurança e isolamento de contexto.';
  }

  document.getElementById('detected-lang-badge').textContent = detectedLang;

  return {
    isBilingual: true,
    detectedLang: detectedLang,
    userOriginal: text,
    userPt: detectedLang === 'Português' ? text : `[Tradução para Português]: ${text}`,
    agentOriginal: originalAnswer,
    agentPt: ptAnswer
  };
}

// Renderização de Mensagem Normal
function appendMessage(sender, text, meta = {}) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message ${sender}-msg`;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderName = sender === 'user' ? 'Você' : 'DocuAgent';
  const badgeText = meta.tab ? meta.tab.toUpperCase() : (sender === 'user' ? 'Usuário' : 'IA');
  const icon = sender === 'user' ? 'fa-user' : 'fa-robot';

  let extraHtml = '';
  if (meta.sources) {
    extraHtml = `<div class="mt-2 text-muted" style="font-size:0.75rem;"><i class="fa-solid fa-bookmark text-accent"></i> <strong>Fonte:</strong> ${meta.sources}</div>`;
  }

  let formattedContent = formatMarkdown(text);

  div.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid ${icon}"></i></div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-sender">${senderName}</span>
        <span class="msg-badge">${badgeText}</span>
        <span class="msg-time">${now}</span>
      </div>
      <div class="msg-content">
        ${formattedContent}
        ${extraHtml}
      </div>
    </div>
  `;

  container.appendChild(div);
  scrollToBottom();
}

// Renderização de Mensagem Bilíngue Pareada (Aba Tradução)
function appendBilingualMessage(data) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'message agent-msg';

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-language text-success"></i></div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-sender">DocuAgent</span>
        <span class="msg-badge">BILÍNGUE (${data.detectedLang})</span>
        <span class="msg-time">${now}</span>
      </div>
      <div class="msg-content">
        <div class="bilingual-view-box">
          <div class="bilingual-col">
            <div class="bilingual-col-title"><i class="fa-solid fa-globe"></i> ${data.detectedLang} — Original</div>
            <div class="bilingual-col-content">${formatMarkdown(data.agentOriginal)}</div>
          </div>
          <div class="bilingual-col">
            <div class="bilingual-col-title"><i class="fa-solid fa-flag"></i> 🇧🇷 Português — Tradução</div>
            <div class="bilingual-col-content">${formatMarkdown(data.agentPt)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(div);
  scrollToBottom();
}

// Formatador Markdown Básico
function formatMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/^### (.*$)/gim, '<h3 style="font-size:1.05rem;font-weight:700;margin:8px 0 4px 0;">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 style="font-size:0.92rem;font-weight:600;margin:6px 0 3px 0;color:var(--accent);">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:2px 5px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em;">$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

// Indicador de Digitação
function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  const id = 'typing-' + Date.now();
  div.id = id;
  div.className = 'message agent-msg';
  div.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="msg-body">
      <div class="msg-content" style="padding:10px 16px;">
        <span style="font-size:0.82rem;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Processando com base nas regras da aba ${state.currentTab.toUpperCase()}...</span>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const feed = document.querySelector('.chat-feed-container');
  if (feed) {
    feed.scrollTop = feed.scrollHeight;
  }
}

// Configuração de Event Listeners
function setupEventListeners() {
  // Alternar Tema
  document.getElementById('theme-toggle').onclick = toggleTheme;

  // Abas de Navegação
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  // Chat Form
  const form = document.getElementById('chat-form');
  form.onsubmit = handleChatSubmit;

  // Auto-resize do textarea
  const textarea = document.getElementById('user-input');
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  });

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  });

  // Ação Rápida de Visualizar Documento Ativo
  document.getElementById('doc-quick-btn').onclick = () => {
    if (state.activeDocId) {
      previewDocument(state.activeDocId);
    } else {
      alert('Nenhum documento ativo no momento. Selecione ou envie um arquivo.');
    }
  };

  // Botão Comparar Painel Específico
  document.getElementById('run-compare-btn').onclick = () => {
    const selA = document.getElementById('compare-doc-a').value;
    const selB = document.getElementById('compare-doc-b').value;
    if (!selA || !selB) {
      alert('Por favor, selecione os documentos A e B para comparar.');
      return;
    }
    executePrompt('Execute a comparação detalhada de cláusulas, valores e datas entre os documentos selecionados.');
  };

  // Upload Zone
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.onclick = () => fileInput.click();

  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  };

  dropZone.ondragleave = () => {
    dropZone.classList.remove('dragover');
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  fileInput.onchange = () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFilesUpload(fileInput.files);
    }
  };

  // Limpar Base
  document.getElementById('clear-all-docs').onclick = () => {
    if (confirm('Deseja limpar todos os documentos da base?')) {
      state.documents = [];
      state.activeDocId = null;
      saveDocsToStorage();
      renderDocsList();
      updateActiveFileDisplay();
      updateCompareSelectors();
      appendSystemNotice('Base documental limpa.');
    }
  };

  // Modais
  setupModalEvents();
}

// Manipulação de Upload de Arquivos
function handleFilesUpload(fileList) {
  Array.from(fileList).forEach(file => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result;
      const newDoc = {
        id: 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type || 'text/plain',
        date: 'Hoje',
        content: content
      };

      state.documents.unshift(newDoc);
      state.activeDocId = newDoc.id;
      saveDocsToStorage();
      renderDocsList();
      updateActiveFileDisplay();
      updateCompareSelectors();

      appendSystemNotice(`Novo arquivo carregado e ativado: <strong>"${file.name}"</strong> (${newDoc.size}).`);
    };

    // Lê como texto
    reader.readAsText(file);
  });
}

// Modais de Configuração & Pré-visualização
function setupModalEvents() {
  const settingsModal = document.getElementById('settings-modal');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  const providerSelect = document.getElementById('ai-provider');
  const apiKeyInput = document.getElementById('api-key-input');
  const modelInput = document.getElementById('ai-model-input');
  const customUrlInput = document.getElementById('custom-url-input');

  openSettingsBtn.onclick = () => {
    providerSelect.value = state.config.provider;
    apiKeyInput.value = state.config.apiKey;
    modelInput.value = state.config.model;
    customUrlInput.value = state.config.customUrl;
    settingsModal.classList.remove('hidden');
  };

  closeSettingsBtn.onclick = () => settingsModal.classList.add('hidden');

  saveSettingsBtn.onclick = () => {
    state.config.provider = providerSelect.value;
    state.config.apiKey = apiKeyInput.value.trim();
    state.config.model = modelInput.value.trim();
    state.config.customUrl = customUrlInput.value.trim();

    localStorage.setItem('docu_provider', state.config.provider);
    localStorage.setItem('docu_apikey', state.config.apiKey);
    localStorage.setItem('docu_model', state.config.model);
    localStorage.setItem('docu_customurl', state.config.customUrl);

    updateEngineLabel();

    settingsModal.classList.add('hidden');
    appendSystemNotice(`Configurações de IA salvas com sucesso. Motor ativo: <strong>${state.config.provider.toUpperCase()}</strong>.`);
  };

  // Visibilidade de senha
  document.getElementById('toggle-key-visibility').onclick = () => {
    const isPass = apiKeyInput.type === 'password';
    apiKeyInput.type = isPass ? 'text' : 'password';
  };

  // Fechar Preview Modal
  document.getElementById('close-preview-btn').onclick = () => {
    document.getElementById('doc-preview-modal').classList.add('hidden');
  };
}

// Azure AI Foundry — chamada via servidor (server.js), que guarda a chave em azure-config.json
async function callAzureAgent(prompt, tab, activeDoc) {
  if (location.protocol === 'file:') {
    throw new Error('Abra pelo servidor (iniciar.bat → http://localhost:3000). Aberto direto pelo arquivo não dá para falar com o Azure.');
  }
  const res = await fetch('/api/azure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      tab,
      docName: activeDoc ? activeDoc.name : null,
      docContent: activeDoc ? activeDoc.content : null,
      previousResponseId: state.azureResponseIds[tab] || null
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (data.responseId) state.azureResponseIds[tab] = data.responseId;
  return { text: data.text, sources: activeDoc ? activeDoc.name : undefined };
}

// Chamadas Opcionais a Provedores Externos quando o Usuário Configurar Chave
async function callGeminiAPI(prompt, tab, activeDoc) {
  const apiKey = state.config.apiKey;
  const model = state.config.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const docContext = activeDoc ? `\n\n[CONTEÚDO DO ARQUIVO SELECIONADO: "${activeDoc.name}"]:\n${activeDoc.content}` : '';
  const systemPrompt = `Você é um agente documental especializado.
Aba Atual: ${tab.toUpperCase()}.
Se estiver na aba CONSULTAR ARQUIVO: Responda APENAS com base no conteúdo do arquivo. Se a resposta não constar no arquivo, responda exatamente: "não sei".
Se a pergunta não tiver relação com documentos ou for sobre esportes, clima, programação geral ou conhecimentos gerais, responda: "Não sei. Esse assunto está fora do escopo deste agente."`;

  const payload = {
    contents: [{
      parts: [
        { text: systemPrompt },
        { text: docContext ? docContext : '' },
        { text: `Usuário: ${prompt}` }
      ]
    }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Erro na API Gemini: ${res.statusText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta do modelo.';
  return { text: text, sources: activeDoc ? activeDoc.name : undefined };
}

async function callOpenAIAPI(prompt, tab, activeDoc) {
  const apiKey = state.config.apiKey;
  const model = state.config.model || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const docContext = activeDoc ? `\n\n[ARQUIVO SELECIONADO: "${activeDoc.name}"]:\n${activeDoc.content}` : '';
  const systemPrompt = `Você é o DocuAgent especializado em documentos.
Modo Atual: ${tab.toUpperCase()}.
Se aba for CONSULTAR ARQUIVO: responda EXCLUSIVAMENTE com base no documento. Se não estiver no documento, diga exatamente: "não sei".
Se fora do escopo documental, diga: "Não sei. Esse assunto está fora do escopo deste agente."`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${docContext}\n\nSolicitação: ${prompt}` }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Erro na API OpenAI: ${res.statusText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || 'Sem resposta da OpenAI.';
  return { text: text, sources: activeDoc ? activeDoc.name : undefined };
}
