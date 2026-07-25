// A Senha Secreta 
const SENHA_CORRETA = ["FOGO", "OSSO", "MEMÓRIA", "ESPELHO"];
const labelsData = ["FOGO", "OSSO", "MEMÓRIA", "ESPELHO", "SANGUE", "CORVO", "LÁGRIMA", "SINO"];

// Erros de Validação da Fechadura
const ERROS_CRITICOS = [
  {
    titulo: "ACESSO NEGADO: CÓDIGO CORROMPIDO",
    desc: "A ordem das engrenagens falhou na validação de segurança. Risco de fissura no núcleo.\nAcionando válvulas de descarte.\n\nALERTA DE TOXICIDADE: Inundação de Miasma no ambiente externo.\n\n[ -10 HP ]"
  },
  {
    titulo: "FALHA DE CALIBRAÇÃO: VETOR REJEITADO",
    desc: "Incompatibilidade no roteamento das runas. O motor do Astrolábio entrou em sobrecarga reativa.\nReset forçado dos cilindros de alinhamento.\n\nALERTA: Rompimento do selo de contenção. Descarga letal de gás ativada.\n\n[ -10 HP ]"
  }
];

// Estado da Senha
let sequencia = [];
let cumulAngle = 0;
let stepIndex = 0;
let isAnimating = false;
let locked = false;
let sloshVal = 0;
let isDraggingKnob = false;
let needsResetOnClose = false;

// Estado do Labirinto (Roteamento)
// Começa totalmente apagado. Eles precisam alinhar no Sino (1) e desbravar.
let salasDesbravadas = []; 

function getAvailableDoors() {
  if (salasDesbravadas.length === 0) {
    return new Set(["SINO"]); // Somente o SINO pode ser o ponto de partida
  }
  
  let lastRune = salasDesbravadas[salasDesbravadas.length - 1];
  let lastIndex = labelsData.indexOf(lastRune);
  
  let p1_index = (lastIndex + 2) % 8;
  let p2_index = (lastIndex + 3) % 8;
  
  let available = new Set();
  let r1 = labelsData[p1_index];
  let r2 = labelsData[p2_index];
  
  if (!salasDesbravadas.includes(r1)) available.add(r1);
  if (!salasDesbravadas.includes(r2)) available.add(r2);
  
  return available;
}

// Retorna TODAS as rotas (+2 e +3) sem filtrar, para feedback visual completo
function getAllDoors() {
  if (salasDesbravadas.length === 0) {
    return new Set(["SINO"]);
  }
  
  let lastRune = salasDesbravadas[salasDesbravadas.length - 1];
  let lastIndex = labelsData.indexOf(lastRune);
  
  let p1_index = (lastIndex + 2) % 8;
  let p2_index = (lastIndex + 3) % 8;
  
  return new Set([labelsData[p1_index], labelsData[p2_index]]);
}

function init() {
  const container = document.getElementById('labels-container');
  const R = 275; 
  labelsData.forEach((text, i) => {
    let angle = (i * 45 - 90) * (Math.PI / 180);
    let x = 300 + Math.cos(angle) * R;
    let y = 300 + Math.sin(angle) * R;
    let div = document.createElement('div');
    div.className = 'rune-label';
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.innerText = text;
    container.appendChild(div);
  });

  const tubesGroup = document.getElementById('tubes-group');
  for (let i = 0; i < 8; i++) {
    let angle = (i * 45 - 90) * (Math.PI / 180);
    let x2 = 1000 + Math.cos(angle) * 1500; 
    let y2 = 1000 + Math.sin(angle) * 1500;
    
    let outerLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    outerLine.setAttribute("x1", 1000);
    outerLine.setAttribute("y1", 1000);
    outerLine.setAttribute("x2", x2);
    outerLine.setAttribute("y2", y2);
    outerLine.setAttribute("class", "tube-base");
    
    let innerLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    innerLine.setAttribute("x1", 1000);
    innerLine.setAttribute("y1", 1000);
    innerLine.setAttribute("x2", x2);
    innerLine.setAttribute("y2", y2);
    innerLine.setAttribute("class", "tube-groove");
    
    let liquidGlow = document.createElementNS("http://www.w3.org/2000/svg", "line");
    liquidGlow.setAttribute("x1", 1000);
    liquidGlow.setAttribute("y1", 1000);
    liquidGlow.setAttribute("x2", x2);
    liquidGlow.setAttribute("y2", y2);
    liquidGlow.setAttribute("class", "tube-liquid-glow");
    liquidGlow.setAttribute("id", `tube-liquid-glow-${i}`);

    let liquidCore = document.createElementNS("http://www.w3.org/2000/svg", "line");
    liquidCore.setAttribute("x1", 1000);
    liquidCore.setAttribute("y1", 1000);
    liquidCore.setAttribute("x2", x2);
    liquidCore.setAttribute("y2", y2);
    liquidCore.setAttribute("class", "tube-liquid-core");
    liquidCore.setAttribute("id", `tube-liquid-core-${i}`);
    
    tubesGroup.appendChild(outerLine);
    tubesGroup.appendChild(innerLine);
    tubesGroup.appendChild(liquidGlow);
    tubesGroup.appendChild(liquidCore);
  }

  updateMazeVisuals(); 
  updateNeedle();
  initKnob();
  updateInjectButtonState();
  scaleAstrolabe();
  initPlantaNegra();
}

function scaleAstrolabe() {
  const wrapper = document.querySelector('.astrolabe-wrapper');
  const inner = document.getElementById('astrolabe-inner');
  if (!wrapper || !inner) return;
  const scale = wrapper.offsetWidth / 600;
  inner.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', scaleAstrolabe);

function initKnob() {
  const knob = document.getElementById('knob');
  
  const handleEvent = (e) => {
    if (!isDraggingKnob || locked || isAnimating) return;
    
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let rect = knob.getBoundingClientRect();
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    
    let angleRad = Math.atan2(clientY - centerY, clientX - centerX);
    let angleDeg = angleRad * (180 / Math.PI) + 90; 
    if (angleDeg < 0) angleDeg += 360;
    
    let step = Math.round(angleDeg / 45) % 8;
    
    if (step !== stepIndex) {
      let diff = step - stepIndex;
      if (diff < -4) diff += 8;
      if (diff > 4) diff -= 8;
      
      cumulAngle += diff * 45;
      stepIndex = step;
      
      updateNeedle();
      updateKnob();
      shiftSlosh(diff > 0 ? 1 : -1);
      logMsg(`ALINHAMENTO: ${labelsData[stepIndex]}`);
    }
  };

  knob.addEventListener('mousedown', (e) => { isDraggingKnob = true; handleEvent(e); });
  window.addEventListener('mousemove', (e) => { if(isDraggingKnob) handleEvent(e); });
  window.addEventListener('mouseup', () => { isDraggingKnob = false; });
  
  knob.addEventListener('touchstart', (e) => { isDraggingKnob = true; handleEvent(e); }, {passive: false});
  window.addEventListener('touchmove', (e) => { 
    if (isDraggingKnob) {
      e.preventDefault(); 
      handleEvent(e);
    }
  }, {passive: false});
  window.addEventListener('touchend', () => { isDraggingKnob = false; });
}

function logMsg(msg) {
  document.getElementById('log-out').innerText = `>> ${msg}`;
}

// === 2. LÓGICA DE NAVEGAÇÃO (+3 e +5) ===
function resolveRoom() {
  if (locked || isAnimating) return;
  
  let currentRune = labelsData[stepIndex];
  let allDoors = getAllDoors();
  
  if (!allDoors.has(currentRune)) {
    if (salasDesbravadas.length === 0) {
      logMsg("ACESSO BLOQUEADO: É NECESSÁRIO UM PONTO DE ORIGEM (SINO).");
    } else {
      logMsg("ACESSO BLOQUEADO: ROTA INVIÁVEL. CONEXÃO INEXISTENTE.");
    }
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 600);
    return;
  }
  
  if (salasDesbravadas.length > 0 && salasDesbravadas.includes(currentRune)) {
    if (salasDesbravadas[salasDesbravadas.length - 1] === currentRune) {
      logMsg("AVISO: VOCÊ JÁ ESTÁ NESTA SALA.");
      return;
    }
    salasDesbravadas.push(currentRune);
    logMsg(`ROTA SEGUIDA PARA: ${currentRune}`);
  } else {
    // Resolve a sala nova
    salasDesbravadas.push(currentRune);
    logMsg(`SALA ${currentRune} DESBRAVADA.`);
  }
  
  updateMazeVisuals();
}

function updateMazeVisuals() {
  const labels = document.querySelectorAll('.rune-label');
  let available = getAvailableDoors(); // Portas novas (azul)
  let allDoors = getAllDoors();         // Todas as rotas +2/+3 (incluindo já exploradas)

  labels.forEach((el, idx) => {
    let runeName = labelsData[idx];
    
    el.classList.remove('disponivel', 'resolvida', 'navegavel');
    
    if (available.has(runeName)) {
      // Porta aberta para sala NOVA (azul pulsante)
      el.classList.add('disponivel');
    } else if (allDoors.has(runeName) && salasDesbravadas.includes(runeName)) {
      // Rota +2 ou +3 que leva a sala JÁ EXPLORADA (âmbar/dourado)
      el.classList.add('navegavel');
    } else if (salasDesbravadas.includes(runeName)) {
      // Sala explorada que NÃO é rota atual (verde)
      el.classList.add('resolvida');
    }
  });
}

function updateNeedle() {
  document.getElementById('needle-group').style.transform = `rotate(${cumulAngle}deg)`;
  const labels = document.querySelectorAll('.rune-label');
  labels.forEach((el, idx) => {
    if (idx === stepIndex) el.classList.add('active');
    else el.classList.remove('active');
  });
}

function updateKnob() {
  document.getElementById('knob').style.transform = `rotate(${cumulAngle}deg)`;
}

function shiftSlosh(dir) {
  sloshVal += dir * 40;
  document.querySelectorAll('.slosh').forEach(el => {
    el.style.strokeDashoffset = sloshVal;
  });
}

// === 3. EXTRAÇÃO LIVRE (MARGEM PARA ERRO) ===
function extractRune() {
  if (locked || isAnimating) return;
  if (sequencia.length >= 4) {
    logMsg("ERRO: CAPACIDADE MÁXIMA ATINGIDA.");
    return;
  }
  
  let currentRune = labelsData[stepIndex];
  
  if (!salasDesbravadas.includes(currentRune)) {
    logMsg("ACESSO BLOQUEADO: RUNA NÃO ENERGIZADA NO LABIRINTO.");
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 600);
    return;
  }
  
  isAnimating = true;
  disableButtons(true);
  
  document.getElementById('flow-rotator').style.transform = `rotate(${cumulAngle}deg)`;
  
  let flowLine = document.getElementById('flow-line');
  flowLine.classList.remove('fade-out');
  flowLine.classList.add('active');
  
  setTimeout(() => {
    flowLine.classList.remove('active');
    flowLine.classList.add('fade-out');
    
    let ringIdx = sequencia.length; 
    let ring = document.getElementById(`ring-group-${ringIdx}`);
    ring.querySelector('.liquid-glow').classList.add('filled');
    ring.querySelector('.liquid-core').classList.add('filled');

    let tubeIdx = stepIndex;
    document.getElementById(`tube-liquid-glow-${tubeIdx}`).classList.add('filled');
    document.getElementById(`tube-liquid-core-${tubeIdx}`).classList.add('filled');

    let labelEl = document.querySelectorAll('.rune-label')[stepIndex];
    labelEl.classList.add('extracted');
    
    sequencia.push(currentRune);
    logMsg(`RUNA EXTRAÍDA: ${currentRune}`);
    
    updateInjectButtonState();
    isAnimating = false;
    disableButtons(false);
  }, 450); 
}

function undoLast() {
  if (locked || isAnimating) return;
  if (sequencia.length === 0) return;
  
  let ringIdx = sequencia.length - 1; 
  let ring = document.getElementById(`ring-group-${ringIdx}`);
  ring.querySelector('.liquid-glow').classList.remove('filled', 'boil');
  ring.querySelector('.liquid-core').classList.remove('filled', 'boil');
  
  let lastLabel = sequencia.pop();
  let tubeIdx = labelsData.indexOf(lastLabel);
  
  document.getElementById(`tube-liquid-glow-${tubeIdx}`).classList.remove('filled', 'boil');
  document.getElementById(`tube-liquid-core-${tubeIdx}`).classList.remove('filled', 'boil');

  let labelEl = document.querySelectorAll('.rune-label')[tubeIdx];
  labelEl.classList.remove('extracted');
  
  updateInjectButtonState();
  logMsg("ÚLTIMA RUNA DESCARTADA.");
}

function clearAll() {
  if (locked || isAnimating) return;
  sequencia = [];
  
  document.querySelectorAll('.liquid-glow, .liquid-core').forEach(ring => {
    ring.classList.remove('filled', 'boil');
    ring.style.stroke = '';
    ring.style.filter = '';
  });

  document.querySelectorAll('.tube-liquid-glow, .tube-liquid-core').forEach(tube => {
    tube.classList.remove('filled', 'boil');
    tube.style.stroke = '';
  });

  document.querySelectorAll('.rune-label').forEach(label => {
    label.classList.remove('extracted');
    label.style.color = '';
    label.style.textShadow = '';
  });

  updateMazeVisuals(); 
  updateInjectButtonState();

  logMsg("SISTEMA PURGADO (MANTIDO O MAPA).");
}

function updateInjectButtonState() {
  const btnInject = document.getElementById('btn-inject');
  if (btnInject) {
    btnInject.disabled = (sequencia.length < 4);
  }
}

// === 4. VALIDAÇÃO PUNITIVA NO CLÍMAX ===
function injectFlux() {
  if (locked || isAnimating) return;
  if (sequencia.length < 4) {
    return;
  }
  
  let valid = sequencia.every((val, index) => val === SENHA_CORRETA[index]);
  
  if (valid) {
    locked = true;
    disableButtons(true);
    document.body.classList.add('ethereal-pulse');
    
    document.querySelectorAll('.ring-fill').forEach((g, i) => {
      let dir = i % 2 === 0 ? 1 : -1;
      g.style.animation = `spin ${2.5 + i*0.5}s linear infinite`;
      g.style.animationDirection = dir === 1 ? 'normal' : 'reverse';
      
      let glow = g.querySelector('.liquid-glow');
      let core = g.querySelector('.liquid-core');
      glow.style.stroke = 'var(--success)';
      core.style.stroke = '#031020'; // Core azul escuro purificado
    });

    document.querySelectorAll('.tube-liquid-glow.filled').forEach((tube) => {
      tube.style.stroke = 'var(--success)';
    });
    document.querySelectorAll('.tube-liquid-core.filled').forEach((tube) => {
      tube.style.stroke = '#031020';
    });

    document.querySelectorAll('.rune-label.extracted').forEach(label => {
      label.style.color = 'var(--success) !important';
      label.style.textShadow = '0 0 15px var(--success) !important';
    });
    
    logMsg("ACESSO CONCEDIDO: PARABÉNS JOGADORES, PORTAS ABERTAS.");
    showModal(
      "SISTEMA ESTABILIZADO", 
      "A ressonância atingiu a harmonia perfeita. As travas ancestrais foram rompidas.\n\nPARABÉNS, JOGADORES.\nAS PORTAS ESTÃO ABERTAS.", 
      "success"
    );
  } else {
    // FALHA CRÍTICA (Erro)
    locked = true;
    disableButtons(true);
    
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 600);
    
    // O líquido preto das engrenagens pisca e muda para vermelho sangue
    document.querySelectorAll('.liquid-core.filled, .tube-liquid-core.filled').forEach(el => {
      el.style.stroke = '#8b0000';
      el.style.filter = 'drop-shadow(0 0 10px #ff0000)';
      el.classList.add('boil');
    });

    document.querySelectorAll('.liquid-glow.filled, .tube-liquid-glow.filled').forEach(el => {
      el.classList.add('boil');
    });
    
    logMsg("ASSINATURA INCOMPATÍVEL.");
    let erroSorteado = ERROS_CRITICOS[Math.floor(Math.random() * ERROS_CRITICOS.length)];
    showModal(erroSorteado.titulo, erroSorteado.desc, "danger");
    needsResetOnClose = true;
  }
}

function disableButtons(state) {
  document.querySelectorAll('button').forEach(b => {
    if (b.id !== 'modal-close-btn') {
      b.disabled = state;
    }
  });
  
  if(state) {
    document.getElementById('knob').style.pointerEvents = 'none';
  } else {
    document.getElementById('knob').style.pointerEvents = 'auto';
    updateInjectButtonState(); // Restaura desativação condicional do botão de injetar
  }
}

function showModal(title, desc, type) {
  const box = document.getElementById('modal-box');
  box.className = type; 
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-desc').innerText = desc;
  document.getElementById('modal-overlay').classList.add('visible');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
  
  if (needsResetOnClose) {
    sequencia = []; 
    salasDesbravadas = []; 
    
    document.querySelectorAll('.liquid-glow, .liquid-core').forEach(ring => {
      ring.classList.remove('filled', 'boil');
      ring.style.stroke = '';
      ring.style.filter = '';
    });

    document.querySelectorAll('.tube-liquid-glow, .tube-liquid-core').forEach(tube => {
      tube.classList.remove('filled', 'boil');
      tube.style.stroke = '';
    });

    document.querySelectorAll('.rune-label.extracted').forEach(label => {
      label.classList.remove('extracted');
    });
    
    updateMazeVisuals(); 
    logMsg("TENTATIVA ZERADA. LABIRINTO RESETADO.");
    updateInjectButtonState();
    locked = false;
    disableButtons(false);
    
    needsResetOnClose = false;
  }
}

// =============================================
// EASTER EGG: OVERRIDE DA PLANTA NEGRA
// =============================================

function initPlantaNegra() {
  const title = document.querySelector('h1');
  if (!title) return;

  let clickCount = 0;
  let resetTimer = null;
  const REQUIRED_CLICKS = 5;
  const RESET_DELAY = 2000; // reseta se parar de clicar por 2s

  title.addEventListener('click', () => {
    clickCount++;

    // Feedback visual sutil a cada clique: leve flash verde no título
    title.style.transition = 'color 0.1s';
    title.style.color = `hsl(120, ${clickCount * 18}%, ${70 - clickCount * 5}%)`;
    setTimeout(() => {
      if (clickCount < REQUIRED_CLICKS) {
        title.style.color = '';
      }
    }, 150);

    // Reseta o timer de inatividade
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      clickCount = 0;
      title.style.color = '';
    }, RESET_DELAY);

    if (clickCount >= REQUIRED_CLICKS) {
      clickCount = 0;
      if (resetTimer) clearTimeout(resetTimer);
      title.style.color = '';
      activateOverride();
    }
  });
}

function activateOverride() {
  // 1. Efeito de glitch visual em toda a tela
  document.body.classList.add('glitch-active');
  setTimeout(() => document.body.classList.remove('glitch-active'), 1200);

  // 2. Após o glitch, desbloqueia todas as salas
  setTimeout(() => {
    salasDesbravadas = [...labelsData]; // Todas as runas desbravadas
    updateMazeVisuals();
    logMsg("OVERRIDE ATIVO: LABIRINTO CORROMPIDO PELA PLANTA NEGRA.");
    document.body.classList.remove('symbiosis-active');
    document.body.classList.add('override-active');

    // 3. Abre o modal do terminal
    document.getElementById('override-overlay').classList.add('visible');
  }, 900);
}

function closeOverride() {
  document.getElementById('override-overlay').classList.remove('visible');
  document.body.classList.remove('override-active');
  document.body.classList.add('symbiosis-active');
  logMsg("SIMBIOSE RECONHECIDA. MECANISMO E TUBOS INTEGRADOS À PLANTA NEGRA.");
}

window.onload = init;
