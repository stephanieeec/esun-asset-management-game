import { CONFIG } from './config.js?v=finished-buttons-1';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const holeById = new Map(CONFIG.holes.map((hole) => [hole.id, hole]));
const pieces = new Map();
const state = { page: 'opening', placed: new Set(), selected: null, drag: null, transitioning: false };
let completionTimer, feedbackTimer, scale = 1, pieceStack = 10;
let previousStartingOrder = '';

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
  piece.element.style.transform = `translate(${x - piece.start.x}px, ${y - piece.start.y}px)`;
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
  if (state.transitioning || state.page !== 'puzzle' || !piece || !hole || state.placed.has(id)) return false;
  clearSelection();
  if (piece.config.target !== targetId || $(`hole-${targetId}`).classList.contains('filled')) {
    movePiece(piece, piece.start.x, piece.start.y);
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
    // Allow the existing 220ms snap to finish, then pause for 1000ms.
    completionTimer = setTimeout(() => showPage('completion'), 220 + CONFIG.behavior.completionDelay);
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
    movePiece(piece, piece.start.x, piece.start.y);
    return;
  }
  if (!drag.moved) {
    movePiece(piece, piece.start.x, piece.start.y);
    selectPiece(piece.config.id);
    return;
  }
  const hole = nearestHole(piece);
  if (hole) placePiece(piece.config.id, hole.id);
  else movePiece(piece, piece.start.x, piece.start.y);
}

function attachDrag(piece) {
  const element = piece.element;
  element.addEventListener('pointerdown', (event) => {
    if (state.transitioning || state.page !== 'puzzle' || state.drag || state.placed.has(piece.config.id) || (event.pointerType === 'mouse' && event.button !== 0)) return;
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

function shuffleStartingSlots() {
  const order = [...pieces.values()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const holeOrder = CONFIG.holes.map(hole => hole.id).join(',');
  const signature = () => order.map(piece => piece.config.target).join(',');
  // Reject the solved order and a repeat of the previous round, without unbounded retries.
  while (signature() === holeOrder || signature() === previousStartingOrder) order.push(order.shift());
  previousStartingOrder = signature();
  order.forEach((piece, index) => {
    const slot = CONFIG.startingSlots[index];
    piece.start = { x: slot.x, y: slot.y + (piece.config.startOffsetY || 0) };
    position(piece.element, { ...piece.start, width: piece.width, height: piece.height });
  });
}

function resetPuzzle(shuffle = true) {
  clearTimeout(completionTimer);
  clearTimeout(feedbackTimer);
  if (state.drag) finishDrag({ pointerId: state.drag.pointerId }, true);
  clearSelection();
  clearHighlights();
  state.placed.clear();
  pieceStack = 10;
  if (shuffle) shuffleStartingSlots();
  $('feedback').classList.remove('visible');
  for (const piece of pieces.values()) {
    piece.element.disabled = false;
    piece.element.style.zIndex = '10';
    piece.element.classList.remove('placed', 'selected', 'dragging');
    piece.element.setAttribute('aria-label', piece.config.lines.join('；') || '干擾拼圖');
    movePiece(piece, piece.start.x, piece.start.y);
  }
  for (const hole of CONFIG.holes) {
    $(`hole-${hole.id}`).classList.remove('filled');
    $(`hole-${hole.id}`).removeAttribute('aria-disabled');
  }
  renderProgress();
}

async function showPage(page, beforeReveal = () => {}, immediate = false) {
  if (state.transitioning || (state.page === page && !immediate)) return;
  state.transitioning = true;
  clearTimeout(completionTimer);
  const outgoing = $(state.page), incoming = $(page);
  const duration = immediate || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600;
  // Lock interaction while the current screen fades; reset only once it is hidden.
  outgoing.inert = true;
  async function fade(element, from, to) {
    if (!duration) return;
    const animation = element.animate([{ opacity: from }, { opacity: to }], { duration, easing: 'ease-in-out', fill: 'both' });
    await animation.finished;
    animation.cancel();
  }
  try {
    await fade(outgoing, 1, 0);
    outgoing.hidden = true;
    if (duration) await new Promise(resolve => setTimeout(resolve, 150));
    beforeReveal();
    state.page = page;
    for (const id of ['opening', 'puzzle', 'completion']) $(id).hidden = id !== page;
    incoming.inert = true;
    await fade(incoming, 0, 1);
  } finally {
    outgoing.inert = false;
    incoming.inert = false;
    state.transitioning = false;
  }
  if (page === 'opening') $('start').focus({ preventScroll: true });
  if (page === 'completion') $('home').focus({ preventScroll: true });
}

function startGame() {
  if (state.transitioning) return;
  showPage('puzzle', () => resetPuzzle());
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
  $('puzzle-home').textContent = CONFIG.text.puzzleHome;
  position($('puzzle-home'), CONFIG.layout.puzzleHome);
  for (const [id, key] of [['game-title', 'title'], ['instructions', 'instructions'], ['start', 'start'], ['completion-title', 'completion'], ['home', 'home']]) position($(id), CONFIG.layout[key]);
  for (const mascot of document.querySelectorAll('.mascot')) {
    position(mascot, CONFIG.layout.mascot);
    mascot.src = CONFIG.assets.mascot;
    mascot.onerror = () => { mascot.onerror = null; mascot.src = CONFIG.assets.mascotFallback; mascot.classList.add('fallback'); };
  }
  for (const brand of document.querySelectorAll('.brand')) {
    position(brand, brand.classList.contains('game-brand') ? CONFIG.layout.gameBrand : CONFIG.layout.brand);
    if (brand.querySelector('img')) {
      brand.querySelector('img').src = CONFIG.assets.homeBrand;
      continue;
    }
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
    const slot = CONFIG.startingSlots[pieces.size];
    const target = config.target ? holeById.get(config.target) : config;
    const start = { x: slot.x, y: slot.y + (config.startOffsetY || 0) };
    if (!target || !CONFIG.shapes[target.shape]) throw new Error(`Invalid puzzle configuration: ${config.id}`);
    const element = document.createElement('button');
    element.type = 'button';
    element.id = config.id;
    element.className = 'piece';
    element.style.zIndex = '10';
    element.setAttribute('aria-label', config.lines.join('；') || '干擾拼圖');
    position(element, { ...start, width: target.width, height: target.height });
    element.innerHTML = shapeSvg(target.shape, 'piece', config.id);
    const text = document.createElement('span');
    text.className = 'piece-text';
    text.style.top = `${(config.textY || .5) * 100}%`;
    text.style.fontSize = `${config.fontSize || 28}px`;
    setLines(text, config.lines);
    element.append(text);
    $('pieces').append(element);
    const piece = { config, element, start, width: target.width, height: target.height, x: start.x, y: start.y };
    pieces.set(config.id, piece);
    attachDrag(piece);
  }
  $('start').addEventListener('click', startGame);
  $('home').addEventListener('click', () => showPage('opening', () => resetPuzzle(false)));
  $('puzzle-home').addEventListener('click', () => showPage('opening', () => resetPuzzle(false)));
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

function applyFinishedTextSettings() {
  const change = CONFIG.textAdjustments['puzzle-home-text'];
  if (change) {
    const button = $('puzzle-home'), text = document.createElement('span');
    text.textContent = change.text ?? button.textContent;
    text.style.transform = `translate(${change.x || 0}px, ${change.y || 0}px)`;
    text.style.fontSize = `${CONFIG.layout.puzzleHome.fontSize + (change.fontDelta || 0)}px`;
    text.style.letterSpacing = `${change.spacing || 0}em`;
    button.replaceChildren(text);
  }
  for (const [id, piece] of pieces) {
    const change = CONFIG.textAdjustments[id];
    if (!change) continue;
    const text = piece.element.querySelector('.piece-text');
    text.style.left = `calc(7% + ${change.x || 0}px)`;
    text.style.top = `calc(${(piece.config.textY || .5) * 100}% + ${change.y || 0}px)`;
    text.style.fontSize = `${(piece.config.fontSize || 28) + (change.fontDelta || 0)}px`;
    text.style.letterSpacing = `${change.spacing || 0}em`;
  }
  document.querySelectorAll('.hole-label').forEach((bubble, index) => {
    const hole = CONFIG.holes[index];
    const change = CONFIG.textAdjustments[`bubble-${hole.id}`];
    if (change) {
      bubble.style.left = `${hole.labelX + (change.x || 0) - (change.width || 0) / 2}px`;
      bubble.style.top = `${196 + (change.y || 0) - (change.height || 0) / 2}px`;
      bubble.style.width = `${hole.labelWidth + (change.width || 0)}px`;
      bubble.style.height = `${97 + (change.height || 0)}px`;
    }
    const titleChange = CONFIG.textAdjustments[`title-${hole.id}`];
    if (titleChange) {
      const text = document.createElement('span');
      text.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
      text.append(...bubble.childNodes); bubble.append(text);
      text.style.transform = `translate(${titleChange.x || 0}px, ${titleChange.y || 0}px)`;
      text.style.fontSize = `${34 + (titleChange.fontDelta || 0)}px`;
      text.style.letterSpacing = `${titleChange.spacing || 0}em`;
    }
  });
}

initialize();

// The exhibition game never loads the local design interface.
if (new URLSearchParams(location.search).get('editText') === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  resetPuzzle();
  showPage('puzzle', () => {}, true);
  import('./text-editor.js?v=button-words-1').then(({ openTextEditor }) => openTextEditor(pieces));
}

if (!(new URLSearchParams(location.search).get('editText') === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))) applyFinishedTextSettings();

if (new URLSearchParams(location.search).get('editHome') === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  import('./home-editor.js?v=both-buttons-1').then(({ openHomeEditor }) => openHomeEditor());
}

if (new URLSearchParams(location.search).get('editCompletion') === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  showPage('completion', () => {}, true).then(() => import('./home-editor.js?v=both-buttons-1')).then(({ openHomeEditor }) => openHomeEditor(true));
}

for (const [id, change] of Object.entries(CONFIG.pageTextAdjustments)) {
  const isCompletion = ['completion-title', 'home'].includes(id);
  const query = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local && query.get(isCompletion ? 'editCompletion' : 'editHome') === '1') continue;
  const element = $(id), text = document.createElement('span');
  text.style.cssText = 'display:flex;flex-direction:column;align-items:center;white-space:nowrap;';
  text.append(...element.childNodes);
  element.replaceChildren(text);
  text.style.transform = `translate(${change.x}px, ${change.y}px)`;
  text.style.fontSize = `${change.fontSize}px`;
  text.style.letterSpacing = `calc(${id === 'game-title' ? -3 : 0}px + ${change.spacing}em)`;
}

for (const [id, change] of Object.entries(CONFIG.buttonAdjustments)) {
  const query = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local && query.get(id === 'home' ? 'editCompletion' : 'editHome') === '1') continue;
  const base = CONFIG.layout[id];
  position($(id), { x:base.x + change.x, y:base.y + change.y, width:change.width, height:change.height });
}
