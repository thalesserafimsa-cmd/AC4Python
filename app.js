/**
 * app.js — Show do Milhão (Web)
 * Lógica principal: navegação de telas, partida, timer, ranking, Supabase.
 */

'use strict';

// ══════════════════════════════════════════════════════════
//  CONSTANTES
// ══════════════════════════════════════════════════════════

const PREMIOS = [0, 1000, 5000, 10000, 25000, 50000, 100000, 200000, 500000, 1_000_000];
const DIFICULDADES = ['Fácil', 'Média', 'Difícil'];
const QTD_POR_DIFICULDADE = 3;
const TOTAL_PERGUNTAS = 9;
const TEMPO_POR_PERGUNTA = 30; // segundos

const MOTIVO_LABELS = {
  acerto_total: 'Respondeu todas as 9 perguntas! 🏆',
  erro:         'Resposta incorreta',
  desistencia:  'Desistiu',
  tempo:        'Tempo esgotado',
};

// ══════════════════════════════════════════════════════════
//  SUPABASE
// ══════════════════════════════════════════════════════════

let supabaseClient = null;
try {
  if (typeof window.supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.warn('Aviso: Falha ao inicializar o Supabase:', e);
}

function mostrarErroCritico(msg) {
  document.body.innerHTML = `
    <div style="
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:#050a1a; font-family:'Exo 2',sans-serif; padding:2rem;
    ">
      <div style="
        background:rgba(255,61,113,.1); border:2px solid #ff3d71;
        border-radius:16px; padding:2.5rem 2rem; max-width:520px;
        text-align:center; color:#fff;
      ">
        <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
        <h2 style="color:#ff3d71;font-size:1.4rem;margin-bottom:1rem">Erro de Configuração</h2>
        <p style="color:#aaa;line-height:1.7">${msg}</p>
        <hr style="border-color:#ff3d7133;margin:1.5rem 0">
        <p style="color:#666;font-size:.85rem">
          Abra o arquivo <code style="color:#ffd700">config.js</code> e verifique<br>
          <code>SUPABASE_URL</code> e <code>SUPABASE_KEY</code>
        </p>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════
//  ESTADO GLOBAL DA PARTIDA
// ══════════════════════════════════════════════════════════

let state = {
  apelido: '',
  perguntas: [],
  perguntaAtual: 0,
  acertos: 0,
  motivo: '',
  jogoId: '',
  tempoInicio: 0,
  tempoTotal: 0,
  respondendo: false,   // bloqueia cliques duplos
  timerInterval: null,
  tempoRestante: TEMPO_POR_PERGUNTA,
};

// ══════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ══════════════════════════════════════════════════════════

function formatarPremio(valor) {
  return `R$ ${valor.toLocaleString('pt-BR')}`;
}

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function showToast(msg, tipo = '', duracao = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${tipo}`;
  el.classList.remove('hidden');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.add('hidden'), duracao);
}

// ══════════════════════════════════════════════════════════
//  NAVEGAÇÃO DE TELAS
// ══════════════════════════════════════════════════════════

function irPara(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════════════════════════════════════
//  PARTÍCULAS DE FUNDO
// ══════════════════════════════════════════════════════════

(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  const COUNT = 80;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function randomParticle() {
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.5 + 0.3,
      vx:   (Math.random() - 0.5) * 0.3,
      vy:   (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.6 + 0.1,
      color: Math.random() < 0.4 ? '#ffd700' : '#3a4f8a',
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, randomParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) Object.assign(p, randomParticle());
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();

// ══════════════════════════════════════════════════════════
//  SPOTLIGHT (cursor)
// ══════════════════════════════════════════════════════════

(function initSpotlight() {
  const el = document.getElementById('spotlight');
  window.addEventListener('mousemove', e => {
    el.style.left = e.clientX + 'px';
    el.style.top  = e.clientY + 'px';
  });
})();

// ══════════════════════════════════════════════════════════
//  ESCADA DE PRÊMIOS
// ══════════════════════════════════════════════════════════

function renderPrizeLadder() {
  const ladder = document.getElementById('prize-ladder');
  ladder.innerHTML = '';

  for (let i = TOTAL_PERGUNTAS; i >= 1; i--) {
    const dif = i <= 3 ? 'easy' : i <= 6 ? 'medium' : 'hard';
    const item = document.createElement('div');
    item.className = `prize-item ${dif}`;
    item.id = `prize-${i}`;
    item.innerHTML = `
      <span class="pi-num">${i}</span>
      <span class="pi-val">${formatarPremio(PREMIOS[i])}</span>
    `;
    ladder.appendChild(item);
  }
  atualizarLadder();
}

function atualizarLadder() {
  for (let i = 1; i <= TOTAL_PERGUNTAS; i++) {
    const el = document.getElementById(`prize-${i}`);
    if (!el) continue;
    el.classList.remove('active', 'won');
    if (i === state.perguntaAtual + 1) {
      el.classList.add('active');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (i <= state.acertos) {
      el.classList.add('won');
    }
  }
}

// ══════════════════════════════════════════════════════════
//  TIMER
// ══════════════════════════════════════════════════════════

function iniciarTimer() {
  const ring  = document.getElementById('ring-circle');
  const label = document.getElementById('timer-value');
  const circumference = 163.36;

  state.tempoRestante = TEMPO_POR_PERGUNTA;
  clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    state.tempoRestante--;
    const ratio = state.tempoRestante / TEMPO_POR_PERGUNTA;
    ring.style.strokeDashoffset = circumference * (1 - ratio);

    // muda cor conforme urgência
    if (state.tempoRestante <= 5) {
      ring.style.stroke = '#ff3d71';
      label.style.color = '#ff3d71';
    } else if (state.tempoRestante <= 10) {
      ring.style.stroke = '#ff9100';
      label.style.color = '#ff9100';
    } else {
      ring.style.stroke = '#ffd700';
      label.style.color = '#ffd700';
    }
    label.textContent = state.tempoRestante;

    if (state.tempoRestante <= 0) {
      clearInterval(state.timerInterval);
      if (!state.respondendo) encerrarPorTempo();
    }
  }, 1000);
}

function pausarTimer() {
  clearInterval(state.timerInterval);
}

async function encerrarPorTempo() {
  state.respondendo = true;
  pausarTimer();

  // Revela a correta
  const perg = state.perguntas[state.perguntaAtual];
  revelarResposta(perg.resposta, null);

  showToast('⏰ Tempo esgotado!', 'error');
  await sleep(2000);

  state.motivo = 'tempo';
  finalizarPartida();
}

// ══════════════════════════════════════════════════════════
//  RENDERIZAR PERGUNTA
// ══════════════════════════════════════════════════════════

function renderPergunta() {
  const perg = state.perguntas[state.perguntaAtual];
  const dif  = perg.dificuldade;
  const num  = state.perguntaAtual + 1;

  document.getElementById('q-num').textContent = num;

  const badge = document.getElementById('difficulty-badge');
  badge.textContent = dif;
  badge.className = 'badge ' + (dif === 'Fácil' ? 'easy' : dif === 'Média' ? 'medium' : 'hard');

  document.getElementById('question-text').textContent = perg.enunciado;

  const grid = document.getElementById('alternatives-grid');
  grid.innerHTML = '';

  ['A', 'B', 'C', 'D'].forEach(letra => {
    const texto = perg[`alternativa_${letra.toLowerCase()}`];
    const btn = document.createElement('button');
    btn.className = 'alt-btn';
    btn.dataset.letra = letra;
    btn.innerHTML = `
      <span class="alt-letter">${letra}</span>
      <span class="alt-text">${texto}</span>
    `;
    btn.addEventListener('click', () => onResponder(letra));
    grid.appendChild(btn);
  });

  atualizarLadder();
  iniciarTimer();

  // Inicia cronômetro geral na primeira pergunta
  if (state.perguntaAtual === 0) {
    state.tempoInicio = performance.now();
  }
}

// ══════════════════════════════════════════════════════════
//  RESPOSTA DO JOGADOR
// ══════════════════════════════════════════════════════════

async function onResponder(letra) {
  if (state.respondendo) return;
  state.respondendo = true;
  pausarTimer();

  const perg = state.perguntas[state.perguntaAtual];
  const correto = perg.resposta.toUpperCase() === letra.toUpperCase();

  revelarResposta(perg.resposta, letra);

  if (correto) {
    state.acertos++;
    await sleep(1800);

    if (state.acertos === TOTAL_PERGUNTAS) {
      state.motivo = 'acerto_total';
      finalizarPartida();
    } else {
      state.perguntaAtual++;
      state.respondendo = false;
      renderPergunta();
    }
  } else {
    await sleep(2500);
    state.motivo = 'erro';
    finalizarPartida();
  }
}

function revelarResposta(correta, escolhida) {
  document.querySelectorAll('.alt-btn').forEach(btn => {
    btn.disabled = true;
    const l = btn.dataset.letra;
    if (l === correta.toUpperCase()) {
      btn.classList.add('correct');
    } else if (escolhida && l === escolhida.toUpperCase()) {
      btn.classList.add('wrong', 'selected-wrong');
    }
  });
}

// ══════════════════════════════════════════════════════════
//  DESISTÊNCIA
// ══════════════════════════════════════════════════════════

function abrirModalDesistir() {
  const premio = formatarPremio(PREMIOS[state.acertos]);
  document.getElementById('modal-prize-value').textContent = premio;
  document.getElementById('modal-desistir').classList.remove('hidden');
}

function fecharModalDesistir() {
  document.getElementById('modal-desistir').classList.add('hidden');
}

function confirmarDesistencia() {
  fecharModalDesistir();
  pausarTimer();
  state.motivo = 'desistencia';
  finalizarPartida();
}

// ══════════════════════════════════════════════════════════
//  FINALIZAR PARTIDA
// ══════════════════════════════════════════════════════════

function finalizarPartida() {
  pausarTimer();
  state.tempoTotal = (performance.now() - state.tempoInicio) / 1000;

  const valorGanho = state.motivo === 'erro' && state.acertos === 0
    ? 0
    : PREMIOS[state.acertos];

  // Montar tela de resultado
  const icons = { acerto_total: '🏆', erro: '😢', desistencia: '🚩', tempo: '⏰' };
  const titles = {
    acerto_total: 'MILIONÁRIO! 🎉',
    erro:         'Que pena...',
    desistencia:  'Partida encerrada',
    tempo:        'Tempo esgotado!',
  };

  document.getElementById('result-icon').textContent    = icons[state.motivo] ?? '🎮';
  document.getElementById('result-title').textContent   = titles[state.motivo] ?? 'Fim de jogo';
  document.getElementById('result-subtitle').textContent = MOTIVO_LABELS[state.motivo] ?? '';
  document.getElementById('result-prize').textContent   = formatarPremio(valorGanho);
  document.getElementById('result-acertos').textContent = `${state.acertos}/9`;
  document.getElementById('result-time').textContent    = `${state.tempoTotal.toFixed(1)}s`;

  const saveStatus = document.getElementById('save-status');
  saveStatus.innerHTML = '<span class="spinner"></span> Salvando resultado...';
  saveStatus.style.color = '';

  irPara('screen-result');
  salvarPartida(valorGanho);
}

// ══════════════════════════════════════════════════════════
//  PERGUNTAS DE FALLBACK (OFFLINE / MODO LOCAL)
// ══════════════════════════════════════════════════════════

const PERGUNTAS_FALLBACK = [
  // Fácil
  { id: '1', enunciado: 'Qual é a capital do Brasil?', alternativa_a: 'São Paulo', alternativa_b: 'Brasília', alternativa_c: 'Rio de Janeiro', alternativa_d: 'Salvador', resposta: 'B', dificuldade: 'Fácil' },
  { id: '2', enunciado: 'Quantos lados tem um triângulo?', alternativa_a: 'Dois', alternativa_b: 'Quatro', alternativa_c: 'Três', alternativa_d: 'Cinco', resposta: 'C', dificuldade: 'Fácil' },
  { id: '3', enunciado: 'Qual planeta é conhecido como Planeta Vermelho?', alternativa_a: 'Vênus', alternativa_b: 'Júpiter', alternativa_c: 'Saturno', alternativa_d: 'Marte', resposta: 'D', dificuldade: 'Fácil' },
  { id: '4', enunciado: 'Quem escreveu "Dom Casmurro"?', alternativa_a: 'José de Alencar', alternativa_b: 'Machado de Assis', alternativa_c: 'Clarice Lispector', alternativa_d: 'Lima Barreto', resposta: 'B', dificuldade: 'Fácil' },
  { id: '5', enunciado: 'Qual é o maior oceano do mundo?', alternativa_a: 'Atlântico', alternativa_b: 'Índico', alternativa_c: 'Ártico', alternativa_d: 'Pacífico', resposta: 'D', dificuldade: 'Fácil' },

  // Média
  { id: '6', enunciado: 'Em que ano o Brasil foi descoberto?', alternativa_a: '1492', alternativa_b: '1500', alternativa_c: '1498', alternativa_d: '1510', resposta: 'B', dificuldade: 'Média' },
  { id: '7', enunciado: 'Qual é o símbolo químico do ouro?', alternativa_a: 'Ag', alternativa_b: 'Fe', alternativa_c: 'Au', alternativa_d: 'Or', resposta: 'C', dificuldade: 'Média' },
  { id: '8', enunciado: 'Quem pintou a Mona Lisa?', alternativa_a: 'Michelangelo', alternativa_b: 'Rafael', alternativa_c: 'Caravaggio', alternativa_d: 'Leonardo da Vinci', resposta: 'D', dificuldade: 'Média' },
  { id: '9', enunciado: 'Quantos ossos tem o corpo humano adulto?', alternativa_a: '206', alternativa_b: '213', alternativa_c: '198', alternativa_d: '220', resposta: 'A', dificuldade: 'Média' },
  { id: '10', enunciado: 'Qual é a fórmula da água?', alternativa_a: 'CO2', alternativa_b: 'NaCl', alternativa_c: 'H2O', alternativa_d: 'O2', resposta: 'C', dificuldade: 'Média' },

  // Difícil
  { id: '11', enunciado: 'Qual é o menor país do mundo em área?', alternativa_a: 'Mônaco', alternativa_b: 'Nauru', alternativa_c: 'San Marino', alternativa_d: 'Vaticano', resposta: 'D', dificuldade: 'Difícil' },
  { id: '12', enunciado: 'Quantos bits compõem 1 byte?', alternativa_a: '4', alternativa_b: '16', alternativa_c: '8', alternativa_d: '32', resposta: 'C', dificuldade: 'Difícil' },
  { id: '13', enunciado: 'Quem desenvolveu a teoria da relatividade?', alternativa_a: 'Isaac Newton', alternativa_b: 'Niels Bohr', alternativa_c: 'Max Planck', alternativa_d: 'Albert Einstein', resposta: 'D', dificuldade: 'Difícil' },
  { id: '14', enunciado: 'Qual é o número atômico do carbono?', alternativa_a: '8', alternativa_b: '6', alternativa_c: '12', alternativa_d: '4', resposta: 'B', dificuldade: 'Difícil' },
  { id: '15', enunciado: 'Em qual continente fica o Suriname?', alternativa_a: 'África', alternativa_b: 'Ásia', alternativa_c: 'América do Norte', alternativa_d: 'América do Sul', resposta: 'D', dificuldade: 'Difícil' }
];

// ══════════════════════════════════════════════════════════
//  SALVAR PARTIDA NO SUPABASE / LOCAL
// ══════════════════════════════════════════════════════════

async function salvarPartida(valorGanho) {
  const dados = {
    jogo_id:             state.jogoId,
    apelido:             state.apelido,
    valor_ganho:         valorGanho,
    tempo_segundos:      parseFloat(state.tempoTotal.toFixed(3)),
    acertos:             state.acertos,
    motivo_encerramento: state.motivo,
  };

  const saveStatus = document.getElementById('save-status');

  const tentarSalvar = async () => {
    try {
      if (!supabaseClient) throw new Error('Cliente Supabase não configurado');
      const { error } = await supabaseClient.from('partidas').insert(dados);
      if (error) throw error;
      saveStatus.innerHTML = '✔ Resultado salvo no Supabase!';
      saveStatus.style.color = '#00e676';
    } catch (err) {
      console.warn('Erro ao salvar no Supabase, salvando localmente:', err);
      try {
        const historico = JSON.parse(localStorage.getItem('show_milhao_partidas') || '[]');
        historico.push({ ...dados, criado_em: new Date().toISOString() });
        localStorage.setItem('show_milhao_partidas', JSON.stringify(historico));
        saveStatus.innerHTML = '✔ Resultado salvo localmente!';
        saveStatus.style.color = '#ffd700';
      } catch (storageErr) {
        saveStatus.innerHTML = `
          ✘ Falha ao salvar: ${err.message ?? err}
          <br><small>jogo_id: ${state.jogoId}</small>
        `;
        saveStatus.style.color = '#ff3d71';
      }
    }
  };

  await tentarSalvar();
}

// ══════════════════════════════════════════════════════════
//  RANKING
// ══════════════════════════════════════════════════════════

async function carregarRanking() {
  const lista = document.getElementById('ranking-list');
  lista.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:2rem"><span class="spinner" style="display:inline-block;margin-right:.5rem"></span>Carregando...</div>';

  let data = null;

  if (supabaseClient) {
    try {
      const res = await supabaseClient
        .from('partidas')
        .select('apelido, valor_ganho, acertos, tempo_segundos, motivo_encerramento, criado_em')
        .order('valor_ganho',    { ascending: false })
        .order('acertos',        { ascending: false })
        .order('tempo_segundos', { ascending: true  })
        .limit(10);

      if (!res.error && res.data && res.data.length > 0) {
        data = res.data;
      }
    } catch (err) {
      console.warn('Erro ao carregar ranking do Supabase:', err);
    }
  }

  // Fallback para partidas armazenadas localmente
  if (!data || data.length === 0) {
    try {
      const historico = JSON.parse(localStorage.getItem('show_milhao_partidas') || '[]');
      if (historico.length > 0) {
        historico.sort((a, b) => b.valor_ganho - a.valor_ganho || b.acertos - a.acertos || a.tempo_segundos - b.tempo_segundos);
        data = historico.slice(0, 10);
      }
    } catch (e) {
      data = [];
    }
  }

  if (!data || data.length === 0) {
    lista.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem">Nenhuma partida registrada ainda.<br>Seja o primeiro campeão!</p>';
    return;
  }

  lista.innerHTML = '';
  data.forEach((rec, i) => {
    const pos = i + 1;
    const posClass = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : 'other';
    const posLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
    const data_ = rec.criado_em ? new Date(rec.criado_em).toLocaleDateString('pt-BR') : '';
    const motivo = MOTIVO_LABELS[rec.motivo_encerramento] ?? rec.motivo_encerramento;

    const item = document.createElement('div');
    item.className = 'rank-item';
    item.style.animationDelay = `${i * 0.06}s`;
    item.innerHTML = `
      <span class="rank-pos ${posClass}">${posLabel}</span>
      <div class="rank-info">
        <div class="rank-name">${rec.apelido}</div>
        <div class="rank-meta">${motivo} · ${data_}</div>
      </div>
      <div>
        <div class="rank-prize">${formatarPremio(rec.valor_ganho)}</div>
        <div class="rank-hits">${rec.acertos}/9 acertos · ${parseFloat(rec.tempo_segundos).toFixed(1)}s</div>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ══════════════════════════════════════════════════════════
//  BUSCAR PERGUNTAS
// ══════════════════════════════════════════════════════════

async function buscarPerguntas() {
  if (supabaseClient) {
    try {
      const todasPerguntas = [];

      for (const dif of DIFICULDADES) {
        const { data, error } = await supabaseClient
          .from('perguntas')
          .select('*')
          .eq('dificuldade', dif);

        if (error) throw new Error(`Erro ao buscar perguntas (${dif}): ${error.message}`);

        if (!data || data.length < QTD_POR_DIFICULDADE) {
          throw new Error(
            `Perguntas insuficientes para dificuldade '${dif}'. ` +
            `Necessário: ${QTD_POR_DIFICULDADE}, disponível: ${data?.length ?? 0}.`
          );
        }

        const embaralhadas = data.sort(() => Math.random() - 0.5).slice(0, QTD_POR_DIFICULDADE);
        todasPerguntas.push(...embaralhadas);
      }

      return todasPerguntas; // 9 perguntas do Supabase
    } catch (err) {
      console.warn('Falha ao carregar do Supabase, usando perguntas de fallback:', err);
      showToast('⚠️ Usando perguntas locais (banco Supabase não inicializado)', 'warning', 4000);
    }
  }

  // Fallback: usar perguntas padrão embutidas
  const todasPerguntas = [];
  for (const dif of DIFICULDADES) {
    const doTipo = PERGUNTAS_FALLBACK.filter(p => p.dificuldade === dif);
    const embaralhadas = [...doTipo].sort(() => Math.random() - 0.5).slice(0, QTD_POR_DIFICULDADE);
    todasPerguntas.push(...embaralhadas);
  }
  return todasPerguntas;
}

// ══════════════════════════════════════════════════════════
//  INICIAR PARTIDA
// ══════════════════════════════════════════════════════════

async function iniciarPartida() {
  // Mostrar overlay de loading
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = '<div class="big-spinner"></div><p>Preparando as perguntas...</p>';
  document.body.appendChild(overlay);

  try {
    const perguntas = await buscarPerguntas();

    // Resetar estado
    state = {
      ...state,
      perguntas,
      perguntaAtual: 0,
      acertos: 0,
      motivo: '',
      jogoId: uuid(),
      tempoInicio: 0,
      tempoTotal: 0,
      respondendo: false,
      timerInterval: null,
      tempoRestante: TEMPO_POR_PERGUNTA,
    };

    renderPrizeLadder();
    irPara('screen-game');
    renderPergunta();
  } catch (err) {
    overlay.remove();
    // Mostra erro bem visível no centro da tela
    const errDiv = document.createElement('div');
    errDiv.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(5,10,26,.97);font-family:'Exo 2',sans-serif;padding:1.5rem;
    `;
    errDiv.innerHTML = `
      <div style="background:rgba(255,61,113,.12);border:2px solid #ff3d71;
        border-radius:16px;padding:2.5rem 2rem;max-width:480px;width:100%;text-align:center;color:#fff;">
        <div style="font-size:3rem;margin-bottom:1rem">❌</div>
        <h3 style="color:#ff3d71;font-size:1.3rem;margin-bottom:.8rem">Erro ao carregar perguntas</h3>
        <p style="color:#aaa;font-size:.95rem;line-height:1.7;margin-bottom:1.5rem">
          ${err.message ?? 'Erro desconhecido'}
        </p>
        <p style="color:#555;font-size:.8rem;margin-bottom:1.5rem">
          Verifique se rodou o <strong style="color:#ffd700">schema.sql</strong> no Supabase<br>
          e se as credenciais no <strong style="color:#ffd700">config.js</strong> estão corretas.
        </p>
        <button onclick="this.closest('div[style]').remove();irPara('screen-menu')"
          style="background:linear-gradient(135deg,#b8860b,#ffd700);border:none;
          border-radius:10px;padding:.8rem 2rem;font-weight:700;cursor:pointer;font-size:1rem;">
          ← Voltar ao Menu
        </button>
      </div>
    `;
    document.body.appendChild(errDiv);
    return;
  } finally {
    overlay.remove();
  }
}

// ══════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════════════

function initApp() {
  /* ─── MENU ─────────────────────────────────────────── */
  document.getElementById('btn-jogar').addEventListener('click', () => {
    irPara('screen-apelido');
    document.getElementById('input-apelido').focus();
  });

  document.getElementById('btn-ranking').addEventListener('click', () => {
    irPara('screen-ranking');
    carregarRanking();
  });

  /* ─── APELIDO ──────────────────────────────────────── */
  const inputApelido = document.getElementById('input-apelido');
  const apelidoError = document.getElementById('apelido-error');
  const apelidoCounter = document.getElementById('apelido-counter');

  inputApelido.addEventListener('input', () => {
    const len = inputApelido.value.length;
    apelidoCounter.textContent = `${len}/20`;
    apelidoError.classList.add('hidden');
  });

  inputApelido.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmarApelido();
  });

  document.getElementById('btn-confirmar-apelido').addEventListener('click', confirmarApelido);
  document.getElementById('btn-back-menu').addEventListener('click', () => irPara('screen-menu'));

  function confirmarApelido() {
    const val = inputApelido.value.trim();
    if (!val) {
      apelidoError.classList.remove('hidden');
      inputApelido.focus();
      return;
    }
    state.apelido = val;
    inputApelido.value = '';
    apelidoCounter.textContent = '0/20';
    iniciarPartida();
  }

  /* ─── JOGO ─────────────────────────────────────────── */
  document.getElementById('btn-desistir').addEventListener('click', () => {
    if (state.respondendo) return;
    pausarTimer();
    abrirModalDesistir();
  });

  /* ─── MODAL DESISTIR ────────────────────────────────── */
  document.getElementById('btn-modal-cancel').addEventListener('click', () => {
    fecharModalDesistir();
    // retoma timer
    state.timerInterval = setInterval(() => {
      state.tempoRestante--;
      const ring  = document.getElementById('ring-circle');
      const label = document.getElementById('timer-value');
      const circumference = 163.36;
      const ratio = state.tempoRestante / TEMPO_POR_PERGUNTA;
      ring.style.strokeDashoffset = circumference * (1 - ratio);
      label.textContent = state.tempoRestante;
      if (state.tempoRestante <= 0) {
        clearInterval(state.timerInterval);
        encerrarPorTempo();
      }
    }, 1000);
  });

  document.getElementById('btn-modal-confirm').addEventListener('click', confirmarDesistencia);

  /* ─── RESULTADO ────────────────────────────────────── */
  document.getElementById('btn-result-ranking').addEventListener('click', () => {
    irPara('screen-ranking');
    carregarRanking();
  });

  document.getElementById('btn-jogar-novamente').addEventListener('click', () => {
    irPara('screen-apelido');
    document.getElementById('input-apelido').focus();
  });

  /* ─── RANKING ──────────────────────────────────────── */
  document.getElementById('btn-back-ranking').addEventListener('click', () => {
    irPara('screen-menu');
  });

  /* ─── FECHAR MODAL COM ESC ─────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fecharModalDesistir();
  });

  // Tela inicial
  irPara('screen-menu');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
