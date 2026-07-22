// A Senha Secreta 
const SENHA_CORRETA = ["FOGO", "OSSO", "MEMÓRIA", "ESPELHO"];
const labelsData = ["FOGO", "OSSO", "MEMÓRIA", "ESPELHO", "SANGUE", "CORVO", "LÁGRIMA", "SINO"];

// Estado da Senha
let sequencia = [];
let cumulAngle = 0;
let stepIndex = 0;
let isAnimating = false;
let locked = false;
let sloshVal = 0;
let isDraggingKnob = false;

// === ESTADO DO LABIRINTO (ROTEAMENTO) ===
// SINO é a Sala 1. Quando resolvida, abre (1+3)%8 e (1+5)%8 -> Salas 4 e 6.
let salasResolvidas = new Set([1]); 
let portasDisponiveis = new Set([4, 6]); 

// Funções Matemáticas do Labirinto
function getRoomFromIndex(index) {
  let n = (index + 2) % 8;
  return n === 0 ? 8 : n;
}

function getIndexFromRoom(room) {
  let idx = (room - 2) % 8;
  if (idx < 0) idx += 8;
  return idx;
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

  updateMazeVisuals(); // Inicializa o feedback de cores do labirinto
  updateNeedle();
  initKnob();
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

// === Lógica de Exploração do Labirinto ===
function resolveRoom() {
  if (locked || isAnimating) return;
  
  let currentRoom = getRoomFromIndex(stepIndex);
  
  if (!portasDisponiveis.has(currentRoom)) {
    if (salasResolvidas.has(currentRoom)) {
      logMsg("AVISO: SALA JÁ DESBRAVADA.");
    } else {
      logMsg("ACESSO BLOQUEADO: SALA INACESSÍVEL.");
      document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), 600);
    }
    return;
  }
  
  // Resolve a sala
  portasDisponiveis.delete(currentRoom);
  salasResolvidas.add(currentRoom);
  
  // Calcula as duas novas portas: +3 e +5
  let newRoom1 = (currentRoom + 3) % 8;
  if (newRoom1 === 0) newRoom1 = 8;
  let newRoom2 = (currentRoom + 5) % 8;
  if (newRoom2 === 0) newRoom2 = 8;
  
  if (!salasResolvidas.has(newRoom1)) portasDisponiveis.add(newRoom1);
  if (!salasResolvidas.has(newRoom2)) portasDisponiveis.add(newRoom2);
  
  logMsg(`SALA ${currentRoom} (${labelsData[stepIndex]}) DESBRAVADA.`);
  
  updateMazeVisuals();
}

function updateMazeVisuals() {
  const labels = document.querySelectorAll('.rune-label');
  labels.forEach((el, idx) => {
    let room = getRoomFromIndex(idx);
    el.classList.remove('disponivel', 'resolvida');
    
    if (salasResolvidas.has(room)) {
      el.classList.add('resolvida');
    } else if (portasDisponiveis.has(room)) {
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

function extractRune() {
  if (locked || isAnimating) return;
  if (sequencia.length >= 4) {
    logMsg("ERRO: CAPACIDADE MÁXIMA ATINGIDA.");
    return;
  }
  
  let currentRoom = getRoomFromIndex(stepIndex);
  if (!salasResolvidas.has(currentRoom)) {
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
    
    sequencia.push(labelsData[stepIndex]);
    logMsg(`RUNA EXTRAÍDA: ${labelsData[stepIndex]}`);
    
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
  
  logMsg("ÚLTIMA RUNA DESCARTADA.");
}

function clearAll() {
  if (locked || isAnimating) return;
  sequencia = [];
  
  document.querySelectorAll('.liquid-glow, .liquid-core').forEach(ring => {
    ring.classList.remove('filled', 'boil');
    ring.style.stroke = '';
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

  updateMazeVisuals(); // Restaura as cores do labirinto em vez de ficar tudo branco

  logMsg("SISTEMA PURGADO (MANTIDO O MAPA).");
}

function injectFlux() {
  if (locked || isAnimating) return;
  if (sequencia.length < 4) {
    logMsg("ERRO: 4 RUNAS NECESSÁRIAS PARA INJEÇÃO.");
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
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 600);
    
    document.querySelectorAll('.liquid-glow.filled, .liquid-core.filled').forEach(ring => {
      ring.classList.add('boil');
    });

    document.querySelectorAll('.tube-liquid-glow.filled, .tube-liquid-core.filled').forEach(tube => {
      tube.classList.add('boil');
    });
    
    logMsg("FALHA CRÍTICA DE ALINHAMENTO.");
    showModal("FALHA DE FLUXO!", "MIASMA EXALADO.\n\nDANO NECRÓTICO.", "danger");
  }
}

function disableButtons(state) {
  document.querySelectorAll('button').forEach(b => {
    if (b.id !== 'modal-close-btn') {
      b.disabled = state;
    }
  });
  if(state) document.getElementById('knob').style.pointerEvents = 'none';
  else document.getElementById('knob').style.pointerEvents = 'auto';
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
