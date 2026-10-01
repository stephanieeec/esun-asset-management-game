import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const holeById = new Map(CONFIG.holes.map((hole) => [hole.id, hole]));
const pieces = new Map();
const state = { page: 'opening', placed: new Set(), selected: null, drag: null };
let completionTimer, feedbackTimer, scale = 1, pieceStack = 10;

function position(element, rect) {
  for (const key of ['width', 'height', 'fontSize']) if (rect[key] !== undefined) element.style[key] = `${rect[key]}px`;
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
}

function setLines(element, lines) {
  element.replaceChildren(...lines.map((line) => {
    const span = document.createElement('span');
    span.textContent = line;
    return span;
  }));
}

function resize() {
  scale = Math.min(innerWidth / CONFIG.stage.width, innerHeight / CONFIG.stage.height);
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(innerWidth - CONFIG.stage.width * scale) / 2}px`;
  stage.style.top = `${(innerHeight - CONFIG.stage.height * scale) / 2}px`;
}

function stagePoint(event) {
  const rect = stage.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
}

function shapeSvg(shape, type, id) {
  const fill = `${id}-fill`, inset = `${id}-inset`;
  const isHole = type === 'hole';
  return `<svg class="shape-svg" viewBox="0 0 300 260" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${fill}" x1="0" y1="0" x2=".75" y2="1">
        <stop offset="0" stop-color="${isHole ? '#c4e3e6' : '#e0f4f5'}"/>
        <stop offset="1" stop-color="${isHole ? '#d8f0f2' : '#cfebee'}"/>
      </linearGradient>
      <filter id="${inset}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
        <feOffset in="blur" dx="0" dy="7" result="offset"/>
        <feComposite in="SourceAlpha" in2="offset" operator="out" result="shadow"/>
        <feFlood flood-color="#427c83" flood-opacity=".5"/>
        <feComposite operator="in" in2="shadow" result="colored"/>
        <feComposite in="colored" in2="SourceGraphic" operator="atop"/>
      </filter>
    </defs>
    <path class="shape-outline" d="${CONFIG.shapes[shape]}" fill="url(#${fill})" ${isHole ? `filter="url(#${inset})"` : ''} stroke="#f4feff" stroke-width="4" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function showFeedback(text) {
  clearTimeout(feedbackTimer);
  $('feedback').textContent = text;
  $('feedback').classList.add('visible');
  feedbackTimer = setTimeout(() => $('feedback').classList.remove('visible'), 1700);
}

function renderProgress() {
  $('progress').textContent = `${CONFIG.text.progress} ${state.placed.size} / ${CONFIG.holes.length}`;
}

function clearSelection() {
  if (state.selected) pieces.get(state.selected)?.element.classList.remove('selected');
  state.selected = null;
}

function selectPiece(id) {
  clearSelection();
  if (state.placed.has(id)) return;
  state.selected = id;
  pieces.get(id).element.classList.add('selected');
  showFeedback(CONFIG.text.selected);
}

function movePiece(piece, x, y) {
  piece.x = x;
  piece.y = y;
  piece.element.style.transform = `translate(${x - piece.config.x}px, ${y - piece.config.y}px)`;
}

function clearHighlights() {
  for (const hole of CONFIG.holes) $(`hole-${hole.id}`).classList.remove('near');
}

function nearestHole(piece) {
  const cx = piece.x + piece.width / 2, cy = piece.y + piece.height / 2;
  let nearest = null, bestDistance = Infinity;
  for (const hole of CONFIG.holes) {
    if ($(`hole-${hole.id}`).classList.contains('filled')) continue;
    const distance = Math.hypot(cx - (hole.x + hole.width / 2), cy - (hole.y + hole.height / 2));
    if (distance < CONFIG.behavior.snapTolerance && distance < bestDistance) {
      nearest = hole;
      bestDistance = distance;
    }
  }
  return nearest;
}

// Both touch dragging and tap/keyboard placement use this same validation.
function placePiece(id, targetId) {
  const piece = pieces.get(id), hole = holeById.get(targetId);
  if (state.page !== 'puzzle' || !piece || !hole || state.placed.has(id)) return false;
  clearSelection();
  if (piece.config.target !== targetId || $(`hole-${targetId}`).classList.contains('filled')) {
    movePiece(piece, piece.config.x, piece.config.y);
    showFeedback(CONFIG.text.incorrect);
    return false;
  }
  movePiece(piece, hole.x, hole.y);
  state.placed.add(id);
  piece.element.classList.add('placed');
  piece.element.setAttribute('aria-label', `${hole.label.join('')}：配對成功`);
  piece.element.disabled = true;
  $(`hole-${hole.id}`).classList.add('filled');
  $(`hole-${hole.id}`).setAttribute('aria-disabled', 'true');
  renderProgress();
  showFeedback(CONFIG.text.correct);
  if (state.placed.size === CONFIG.holes.length) {
    completionTimer = setTimeout(() => showPage('completion'), CONFIG.behavior.completionDelay);
  }
  return true;
}

function finishDrag(event, cancelled = false) {
  const drag = state.drag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  state.drag = null;
  const piece = drag.piece;
  piece.element.classList.remove('dragging');
  if (piece.element.hasPointerCapture(event.pointerId)) piece.element.releasePointerCapture(event.pointerId);
  clearHighlights();
  if (cancelled || state.page !== 'puzzle') {
    movePiece(piece, piece.config.x, piece.config.y);
    return;
  }
  if (!drag.moved) {
    movePiece(piece, piece.config.x, piece.config.y);
    selectPiece(piece.config.id);
    return;
  }
  const hole = nearestHole(piece);
  if (hole) placePiece(piece.config.id, hole.id);
  else movePiece(piece, piece.config.x, piece.config.y);
}

function attachDrag(piece) {
  const element = piece.element;
  element.addEventListener('pointerdown', (event) => {
    if (state.page !== 'puzzle' || state.drag || state.placed.has(piece.config.id) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    clearSelection();
    // Catch a piece at its visible position, even during its return animation.
    const visible = element.getBoundingClientRect(), stageRect = stage.getBoundingClientRect();
    const visibleX = (visible.left - stageRect.left) / scale;
    const visibleY = (visible.top - stageRect.top) / scale;
    element.style.zIndex = `${++pieceStack}`;
    element.classList.add('dragging');
    movePiece(piece, visibleX, visibleY);
    const point = stagePoint(event);
    state.drag = { piece, pointerId: event.pointerId, offsetX: point.x - piece.x, offsetY: point.y - piece.y, start: point, moved: false };
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', (event) => {
    const drag = state.drag;
    if (!drag || drag.piece !== piece || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = stagePoint(event);
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 8) drag.moved = true;
    if (!drag.moved) return;
    movePiece(piece,
      Math.max(0, Math.min(CONFIG.stage.width - piece.width, point.x - drag.offsetX)),
      Math.max(0, Math.min(CONFIG.stage.height - piece.height, point.y - drag.offsetY)));
    clearHighlights();
    const hole = nearestHole(piece);
    if (hole) $(`hole-${hole.id}`).classList.add('near');
  });
  element.addEventListener('pointerup', (event) => finishDrag(event));
  element.addEventListener('pointercancel', (event) => finishDrag(event, true));
  element.addEventListener('lostpointercapture', (event) => finishDrag(event, true));
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectPiece(piece.config.id);
    }
  });
}

function resetPuzzle() {
  clearTimeout(completionTimer);
  clearTimeout(feedbackTimer);
  if (state.drag) finishDrag({ pointerId: state.drag.pointerId }, true);
  clearSelection();
  clearHighlights();
  state.placed.clear();
  pieceStack = 10;
  $('feedback').classList.remove('visible');
  for (const piece of pieces.values()) {
    piece.element.disabled = false;
    piece.element.style.zIndex = '10';
    piece.element.classList.remove('placed', 'selected', 'dragging');
    piece.element.setAttribute('aria-label', piece.config.lines.join('；') || '干擾拼圖');
    movePiece(piece, piece.config.x, piece.config.y);
  }
  for (const hole of CONFIG.holes) {
    $(`hole-${hole.id}`).classList.remove('filled');
    $(`hole-${hole.id}`).removeAttribute('aria-disabled');
  }
  renderProgress();
}

function showPage(page) {
  state.page = page;
  for (const id of ['opening', 'puzzle', 'completion']) $(id).hidden = id !== page;
  if (page === 'opening') $('start').focus({ preventScroll: true });
  if (page === 'completion') $('home').focus({ preventScroll: true });
}

function startGame() {
  resetPuzzle();
  showPage('puzzle');
  if (CONFIG.behavior.fullscreenOnStart && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function initialize() {
  for (const [key, value] of Object.entries(CONFIG.theme)) stage.style.setProperty(`--${key}`, value);
  stage.style.backgroundImage = `url("${CONFIG.assets.background}")`;
  stage.style.width = `${CONFIG.stage.width}px`;
  stage.style.height = `${CONFIG.stage.height}px`;
  $('game-title').textContent = CONFIG.text.title;
  setLines($('instructions'), CONFIG.text.instructions);
  setLines($('completion-title'), CONFIG.text.completed);
  $('start').textContent = CONFIG.text.start;
  $('home').textContent = CONFIG.text.home;
  for (const [id, key] of [['game-title', 'title'], ['instructions', 'instructions'], ['start', 'start'], ['completion-title', 'completion'], ['home', 'home']]) position($(id), CONFIG.layout[key]);
  for (const mascot of document.querySelectorAll('.mascot')) {
    position(mascot, CONFIG.layout.mascot);
    mascot.src = CONFIG.assets.mascot;
    mascot.onerror = () => { mascot.onerror = null; mascot.src = CONFIG.assets.mascotFallback; mascot.classList.add('fallback'); };
  }
  for (const brand of document.querySelectorAll('.brand')) {
    position(brand, brand.classList.contains('game-brand') ? CONFIG.layout.gameBrand : CONFIG.layout.brand);
    const image = new Image();
    image.src = CONFIG.assets.brand;
    image.alt = '';
    image.draggable = false;
    brand.append(image);
  }
  for (const hole of CONFIG.holes) {
    const label = document.createElement('div');
    label.className = 'hole-label';
    label.style.left = `${hole.labelX}px`;
    label.style.width = `${hole.labelWidth}px`;
    setLines(label, hole.label);
    $('holes').append(label);
    const element = document.createElement('button');
    element.type = 'button';
    element.id = `hole-${hole.id}`;
    element.className = 'hole';
    element.setAttribute('aria-label', hole.label.join(''));
    position(element, hole);
    element.innerHTML = shapeSvg(hole.shape, 'hole', element.id);
    element.addEventListener('click', () => {
      if (state.selected && !state.drag) placePiece(state.selected, hole.id);
    });
    $('holes').append(element);
  }
  for (const config of CONFIG.pieces) {
    const target = config.target ? holeById.get(config.target) : config;
    if (!target || !CONFIG.shapes[target.shape]) throw new Error(`Invalid puzzle configuration: ${config.id}`);
    const element = document.createElement('button');
    element.type = 'button';
    element.id = config.id;
    element.className = 'piece';
    element.style.zIndex = '10';
    element.setAttribute('aria-label', config.lines.join('；') || '干擾拼圖');
    position(element, { ...config, width: target.width, height: target.height });
    element.innerHTML = shapeSvg(target.shape, 'piece', config.id);
    const text = document.createElement('span');
    text.className = 'piece-text';
    text.style.top = `${(config.textY || .5) * 100}%`;
    text.style.fontSize = `${config.fontSize || 28}px`;
    setLines(text, config.lines);
    element.append(text);
    $('pieces').append(element);
    const piece = { config, element, width: target.width, height: target.height, x: config.x, y: config.y };
    pieces.set(config.id, piece);
    attachDrag(piece);
  }
  $('start').addEventListener('click', startGame);
  $('home').addEventListener('click', () => { resetPuzzle(); showPage('opening'); });
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('dragstart', (event) => event.preventDefault());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.drag) finishDrag({ pointerId: state.drag.pointerId }, true);
      clearSelection();
    }
  });
  window.addEventListener('blur', () => { if (state.drag) finishDrag({ pointerId: state.drag.pointerId }, true); });
  window.addEventListener('resize', resize);
  resize();
  renderProgress();
  registerTools();
}

function registerTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const tools = [
    { name: 'read_puzzle_state', description: 'Read the current screen and placed puzzle piece IDs.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ page: state.page, placed: [...state.placed] }) },
    { name: 'place_puzzle_piece', description: 'Attempt a puzzle match using the same matching rules as touch input.', inputSchema: { type: 'object', properties: { pieceId: { type: 'string' }, targetId: { type: 'string' } }, required: ['pieceId', 'targetId'], additionalProperties: false }, execute: ({ pieceId, targetId }) => {
      if (!pieces.has(pieceId) || !holeById.has(targetId) || state.page !== 'puzzle' || state.drag) throw new Error('Start the puzzle and provide valid piece and target IDs while no drag is active.');
      return { matched: placePiece(pieceId, targetId), completed: state.placed.size };
    } },
  ];
  for (const tool of tools) {
    try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch { /* Optional browser capability. */ }
  }
}

initialize();
