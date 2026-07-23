// A Senha Secreta 
const SENHA_CORRETA = ["FOGO", "OSSO", "MEMÓRIA", "ESPELHO"];
const labelsData = ["FOGO", "OSSO", "MEMÓRIA", "ESPELHO", "SANGUE", "CORVO", "LÁGRIMA", "SINO"];

// 1. NOVA MATRIZ DE SALAS (O MAPA FIXO)
const runeToRoom = {
  "SINO": 1,
  "MEMÓRIA": 2,
  "LÁGRIMA": 3,
  "FOGO": 4,
  "ESPELHO": 5,
  "SANGUE": 6,
  "OSSO": 7,
  "CORVO": 8
};

// Estado da Senha
let sequencia = [];
let cumulAngle = 0;
let stepIndex = 0;
let isAnimating = false;
let locked = false;
let sloshVal = 0;
let isDraggingKnob = false;

// Estado do Labirinto (Roteamento)
// 1: SINO (Sempre inicia automaticamente)
let salasDesbravadas = [1]; 

function getAvailableDoors() {
  let lastRoom = salasDesbravadas[salasDesbravadas.length - 1];
  let p1 = (lastRoom + 3) % 8 || 8;
  let p2 = (lastRoom + 5) % 8 || 8;
  
  let available = new Set();
  if (!salasDesbravadas.includes(p1)) available.add(p1);
  if (!salasDesbravadas.includes(p2)) available.add(p2);
  return available;
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
}

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
  let targetRoom = runeToRoom[currentRune];
  
  if (salasDesbravadas.includes(targetRoom)) {
    logMsg("AVISO: SALA JÁ DESBRAVADA.");
    return;
  }
  
  let available = getAvailableDoors();
  
  if (!available.has(targetRoom)) {
    logMsg("ACESSO BLOQUEADO: CAMINHO INACESSÍVEL DESTA SALA.");
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 600);
    return;
  }
  
  // Resolve a sala
  salasDesbravadas.push(targetRoom);
  logMsg(`SALA ${targetRoom} (${currentRune}) DESBRAVADA.`);
  
  updateMazeVisuals();
}

function updateMazeVisuals() {
  const labels = document.querySelectorAll('.rune-label');
  let available = getAvailableDoors();

  labels.forEach((el, idx) => {
    let runeName = labelsData[idx];
    let room = runeToRoom[runeName];
    
    el.classList.remove('disponivel', 'resolvida');
    
    if (salasDesbravadas.includes(room)) {
      el.classList.add('resolvida');
    } else if (available.has(room)) {
      el.classList.add('disponivel');
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
  let currentRoom = runeToRoom[currentRune];
  
  if (!salasDesbravadas.includes(currentRoom)) {
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
    
    logMsg("ACESSO CONCEDIDO.");
    showModal("SISTEMA ESTABILIZADO.", "PORTAL ABERTO.", "success");
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
    showModal("ASSINATURA INCOMPATÍVEL.", "MIASMA LETAL LIBERADO.", "danger");

    // Após 3 segundos de animação
    setTimeout(() => {
      sequencia = []; // Limpa apenas a tentativa de senha
      
      // Remove visualmente o preenchimento apenas dos anéis centrais e dos tubos que estavam preenchidos
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
      
      closeModal();
      logMsg("TENTATIVA ZERADA. MAPA PRESERVADO.");
      updateInjectButtonState();
      locked = false;
      disableButtons(false);
    }, 3000);
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
}

window.onload = init;
