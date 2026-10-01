import { CONFIG } from './config.js?v=finished-editor-1';

// Local design tool only: enabled explicitly with ?editText=1 on localhost.
export function openTextEditor(pieces) {
  const storageKey = 'esun-puzzle-text-draft-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
  const targets = new Map([...pieces].map(([id, piece]) => [id, { element: piece.element, text: piece.element.querySelector('.piece-text'), font: piece.config.fontSize || 28, piece, name: `拼圖：${piece.config.lines[0]}` }]));
  document.querySelectorAll('.hole-label').forEach((bubble, index) => {
    const hole = CONFIG.holes[index];
    const text = document.createElement('span');
    text.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    text.append(...bubble.childNodes); bubble.append(text);
    const base = { x:parseFloat(getComputedStyle(bubble).left), y:parseFloat(getComputedStyle(bubble).top), width:parseFloat(getComputedStyle(bubble).width), height:parseFloat(getComputedStyle(bubble).height) };
    targets.set(`title-${hole.id}`, { element:text, text, font:34, name:`標題文字：${hole.label.join('')}` });
    targets.set(`bubble-${hole.id}`, { element:bubble, bubble:true, base, name:`標題底框：${hole.label.join('')}` });
  });
  const homeButton = document.getElementById('puzzle-home');
  const buttonText = document.createElement('span');
  buttonText.textContent = homeButton.textContent;
  homeButton.replaceChildren(buttonText);
  targets.set('puzzle-home-text', { element:homeButton, text:buttonText, font:CONFIG.layout.puzzleHome.fontSize, button:true, name:'回到首頁按鈕文字' });
  homeButton.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); choose('puzzle-home-text'); }, true);
  const originalButtonText = buttonText.textContent;
  const defaults = () => ({ x:0, y:0, fontDelta:0, spacing:0, width:0, height:0 });
  const adjustments = Object.fromEntries([...targets.keys()].map(id => [id, { ...defaults(), ...CONFIG.textAdjustments[id], ...saved[id] }]));
  let selected = pieces.keys().next().value;
  const style = document.createElement('style');
  style.textContent = `
    .text-editor-panel { position:absolute; top:18px; right:28px; z-index:2147483647; width:1190px; padding:16px 20px; background:#fff; border:3px solid #25bac4; border-radius:18px; color:#00565b; font-size:20px; box-shadow:0 4px 18px #00565b33; }
    .text-editor-panel select,.text-editor-panel button { font:inherit; padding:10px 14px; margin:4px; border:2px solid #25bac4; border-radius:10px; background:#fff; color:#00565b; min-height:48px; touch-action:manipulation; cursor:pointer; }
    .text-editor-panel textarea { width:100%; height:150px; user-select:text; touch-action:auto; font:16px monospace; }
    .piece.editor-selected .piece-text { outline:2px dashed #e48b20; outline-offset:5px; }
    .editor-target { outline:2px dashed #e48b20; outline-offset:4px; }
    .piece.editor-selected .shape-outline { stroke:#e48b20; }
  `;
  document.head.append(style);
  const panel = document.createElement('aside');
  panel.className = 'text-editor-panel';
  panel.setAttribute('aria-label', 'Puzzle text design controls');
  panel.innerHTML = `<div><strong>文字編輯模式（僅本機）</strong> · 選擇拼圖、標題文字或標題底框；位移/字級每次 1px；字距每次 0.01em。</div>
    <select aria-label="選擇編輯元素"></select>
    <button data-key="x" data-step="-1">← 左</button><button data-key="x" data-step="1">右 →</button>
    <button data-key="y" data-step="-1">↑ 上</button><button data-key="y" data-step="1">↓ 下</button>
    <button data-key="fontDelta" data-step="1">A＋ 字級</button><button data-key="fontDelta" data-step="-1">A− 字級</button>
    <button data-key="spacing" data-step="-0.01">字距 −</button><button data-key="spacing" data-step="0.01">字距 ＋</button>
    <span id="editor-size" hidden><button data-key="width" data-step="-1">寬 −</button><button data-key="width" data-step="1">寬 ＋</button><button data-key="height" data-step="-1">高 −</button><button data-key="height" data-step="1">高 ＋</button></span>
    <button id="editor-words" hidden>編輯文案</button><input id="editor-button-wording" aria-label="回到首頁文字內容" type="text" hidden style="font:inherit;padding:10px;user-select:text;touch-action:auto;">
    <button id="editor-reset">還原此元素</button><button id="editor-export">顯示調整數據</button>
    <output aria-live="polite"></output><textarea aria-label="調整數據" hidden readonly></textarea>`;
  document.getElementById('puzzle').append(panel);
  const select = panel.querySelector('select');
  for (const [id, target] of targets) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = target.name;
    select.append(option);
    // Capture selection before the game's drag handlers, so the shape stays still.
    target.element.addEventListener('pointerdown', event => {
      if (target.bubble && event.target !== target.element) return;
      event.preventDefault(); event.stopImmediatePropagation(); choose(id);
    }, true);
    target.element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); event.stopImmediatePropagation(); choose(id);
      }
    }, true);
  }
  function apply(id) {
    const target = targets.get(id), change = adjustments[id];
    if (target.bubble) {
      const { base, element } = target;
      element.style.left = `${base.x + change.x - change.width / 2}px`;
      element.style.top = `${base.y + change.y - change.height / 2}px`;
      element.style.width = `${base.width + change.width}px`;
      element.style.height = `${base.height + change.height}px`;
    } else {
      const { text, piece } = target;
      if (target.button) text.textContent = change.text ?? originalButtonText;
      if (piece) {
        text.style.left = `calc(7% + ${change.x}px)`;
        text.style.top = `calc(${(piece.config.textY || .5) * 100}% + ${change.y}px)`;
      } else text.style.transform = `translate(${change.x}px, ${change.y}px)`;
      text.style.fontSize = `${target.font + change.fontDelta}px`;
      text.style.letterSpacing = `${change.spacing}em`;
    }
  }
  function choose(id) {
    selected = id; select.value = id;
    for (const [key, target] of targets) target.element.classList.toggle(target.piece ? 'editor-selected' : 'editor-target', key === id);
    const change = adjustments[id], target = targets.get(id);
    panel.querySelector('#editor-words').hidden = !target.button;
    const wording = panel.querySelector('#editor-button-wording');
    wording.hidden = !target.button;
    if (document.activeElement !== wording) wording.value = change.text ?? originalButtonText;
    panel.querySelector('#editor-size').hidden = !target.bubble;
    panel.querySelectorAll('[data-key="fontDelta"], [data-key="spacing"]').forEach(button => button.hidden = !!target.bubble);
    panel.querySelector('output').textContent = `偏移 X: ${change.x}px / Y: ${change.y}px · ${target.bubble ? `寬: ${target.base.width + change.width}px / 高: ${target.base.height + change.height}px` : `字級: ${target.font + change.fontDelta}px / 字距: ${change.spacing.toFixed(2)}em`}（本機自動儲存）`;
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(adjustments)); } catch {}
    apply(selected); choose(selected);
    panel.querySelector('textarea').value = JSON.stringify(adjustments, null, 2);
  }
  panel.querySelector('#editor-words').addEventListener('click', () => panel.querySelector('#editor-button-wording').focus());
  panel.querySelector('#editor-button-wording').addEventListener('input', event => { adjustments[selected].text = event.target.value; save(); });
  select.addEventListener('change', () => choose(select.value));
  panel.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.key, delta = Number(button.dataset.step);
    if (key === 'fontDelta' && targets.get(selected).font + adjustments[selected][key] + delta < 8) return;
    if (['width','height'].includes(key) && targets.get(selected).base[key] + adjustments[selected][key] + delta < 20) return;
    adjustments[selected][key] = Math.round((adjustments[selected][key] + delta) * 100) / 100; save();
  }));
  panel.querySelector('#editor-reset').addEventListener('click', () => { adjustments[selected] = defaults(); save(); });
  panel.querySelector('#editor-export').addEventListener('click', () => {
    const output = panel.querySelector('textarea');
    output.value = JSON.stringify(adjustments, null, 2); output.hidden = !output.hidden;
  });
  for (const id of targets.keys()) apply(id);
  choose(selected);
}
