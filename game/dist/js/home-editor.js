// Temporary local-only Page 1 design controls.
export function openHomeEditor(completion = false) {
  const key = completion ? 'esun-completion-design-draft-v1' : 'esun-home-design-draft-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const names = completion ? { 'completion-title':'完成頁文字', home:'回遊戲首頁文字' } : { 'game-title':'主標題', instructions:'兩行說明', start:'開始遊戲文字' };
  const targets = new Map();
  for (const [id, name] of Object.entries(names)) {
    const element = document.getElementById(id);
    const base = getComputedStyle(element);
    const lines = ['instructions', 'completion-title'].includes(id) ? [...element.children].map(el => el.textContent) : [element.textContent];
    const defaults = { x:0, y:0, fontSize:parseFloat(base.fontSize), spacing:0, text:lines.join('\n') };
    const text = document.createElement('span');
    text.style.cssText = 'display:flex;flex-direction:column;align-items:center;white-space:nowrap;';
    element.replaceChildren(text);
    targets.set(id, { element, text, name, defaults, baseline:parseFloat(base.letterSpacing)||0, value:{...defaults,...saved[id]} });
  }
  const buttonId = completion ? 'home' : 'start';
  const buttonTargetId = `${buttonId}-button`;
  {
    const element = document.getElementById(buttonId), base = getComputedStyle(element);
    const defaults = { x:0, y:0, width:parseFloat(base.width), height:parseFloat(base.height) };
    targets.set(buttonTargetId, { element, text:element, name:completion ? '回遊戲首頁按鈕外框' : '開始遊戲按鈕外框', button:true, base:{ x:parseFloat(base.left), y:parseFloat(base.top) }, defaults, value:{...defaults,...saved[buttonTargetId]} });
  }
  const style = document.createElement('style');
  style.textContent = `.home-editor { position:absolute;left:24px;bottom:20px;width:1220px;z-index:2147483647;padding:14px;background:white;border:3px solid #25bac4;border-radius:16px;color:#00565b;font:20px "PingFang TC",sans-serif; }
    .home-editor button,.home-editor select,.home-editor textarea { font:inherit;margin:3px;padding:8px;border:2px solid #25bac4;border-radius:8px;background:white;color:#00565b; }
    .home-editor button { min-height:44px;cursor:pointer;touch-action:manipulation; }
    .home-editor textarea { width:100%;height:90px;user-select:text;touch-action:auto; }
    .home-editor-selected { outline:2px dashed #e48b20;outline-offset:5px; }`;
  document.head.append(style);
  const panel = document.createElement('aside');
  panel.className = 'home-editor';
  panel.innerHTML = `<button id="hide-editor-panel">隱藏編輯面板</button><strong>首頁文字編輯（僅本機）</strong> <select aria-label="選擇首頁文字"></select>
    <button data-key="x" data-step="-1">← 左</button><button data-key="x" data-step="1">右 →</button>
    <button data-key="y" data-step="-1">↑ 上</button><button data-key="y" data-step="1">↓ 下</button>
    <button data-key="fontSize" data-step="-1">A− 字級</button><button data-key="fontSize" data-step="1">A＋ 字級</button>
    <button data-key="spacing" data-step="-0.01">字距 −</button><button data-key="spacing" data-step="0.01">字距 ＋</button>
    <span id="home-editor-size" hidden><button data-key="width" data-step="-1">寬 −</button><button data-key="width" data-step="1">寬 ＋</button><button data-key="height" data-step="-1">高 −</button><button data-key="height" data-step="1">高 ＋</button></span>
    <button id="home-editor-words">編輯文案</button><button id="home-editor-reset">還原此文字</button><button id="home-editor-export">顯示調整數據</button>
    <div><output aria-live="polite"></output> · 位移/字級每次 1px；字距每次 0.01em。</div>
    <textarea aria-label="編輯首頁文案" hidden></textarea><textarea aria-label="首頁調整數據" hidden readonly></textarea>`;
  if (completion) {
    panel.querySelector('strong').textContent = '完成頁文字編輯（僅本機）';
    panel.querySelector('select').setAttribute('aria-label', '選擇完成頁文字');
  }
  document.getElementById(completion ? 'completion' : 'opening').append(panel);
  let selected = completion ? 'completion-title' : 'game-title';
  const select = panel.querySelector('select'), inputs = panel.querySelectorAll('textarea');
  for (const [id,target] of targets) {
    const option = document.createElement('option'); option.value=id;option.textContent=target.name;select.append(option);
    const clickTarget = id === buttonId ? target.text : target.element;
    clickTarget.addEventListener('click', event => {
      if (target.button && targets.get(buttonId).text.contains(event.target)) return;
      event.preventDefault();event.stopImmediatePropagation();choose(id);
    },true);
  }
  function apply(id) {
    const target = targets.get(id);
    const {text,value,baseline} = target;
    if (target.button) {
      target.element.style.left = `${target.base.x + value.x}px`;
      target.element.style.top = `${target.base.y + value.y}px`;
      target.element.style.width = `${value.width}px`;
      target.element.style.height = `${value.height}px`;
      return;
    }
    text.style.transform = `translate(${value.x}px, ${value.y}px)`;
    text.style.fontSize = `${value.fontSize}px`;
    text.style.letterSpacing = `calc(${baseline}px + ${value.spacing}em)`;
    text.replaceChildren(...value.text.split('\n').map(line => {const span=document.createElement('span');span.textContent=line;return span;}));
  }
  function choose(id) {
    selected=id;select.value=id;
    for(const [key,target] of targets) target.text.classList.toggle('home-editor-selected',key===id);
    const {value,button}=targets.get(id);
    panel.querySelector('#home-editor-size').hidden = !button;
    panel.querySelectorAll('[data-key="fontSize"],[data-key="spacing"],#home-editor-words').forEach(control => control.hidden=!!button);
    if(button) inputs[0].hidden=true;
    panel.querySelector('#home-editor-reset').textContent = button ? '還原此按鈕' : '還原此文字';
    panel.querySelector('output').textContent=`X: ${value.x}px / Y: ${value.y}px · ${button ? `寬: ${value.width}px / 高: ${value.height}px` : `字級: ${value.fontSize}px · 額外字距: ${value.spacing.toFixed(2)}em`}（本機自動儲存）`;
    if(!button && document.activeElement !== inputs[0]) inputs[0].value=value.text;
  }
  function save() {
    const data=Object.fromEntries([...targets].map(([id,target])=>[id,target.value]));
    try {localStorage.setItem(key,JSON.stringify(data));} catch {}
    inputs[1].value=JSON.stringify(data,null,2);apply(selected);choose(selected);
  }
  panel.querySelector('#hide-editor-panel').addEventListener('click', () => {
    panel.hidden = true;
    for (const target of targets.values()) target.text.classList.remove('home-editor-selected');
  });
  select.addEventListener('change',()=>choose(select.value));
  panel.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('click',()=>{
    const value=targets.get(selected).value, key=button.dataset.key;
    value[key]=Math.round((value[key]+Number(button.dataset.step))*100)/100;
    if(key==='width' || key==='height') value[key]=Math.max(40,value[key]);
    if(key==='fontSize') value[key]=Math.max(8,value[key]);save();
  }));
  inputs[0].addEventListener('input',()=>{targets.get(selected).value.text=inputs[0].value;save();});
  panel.querySelector('#home-editor-words').addEventListener('click',()=>{inputs[0].hidden=!inputs[0].hidden;});
  panel.querySelector('#home-editor-export').addEventListener('click',()=>{save();inputs[1].hidden=!inputs[1].hidden;});
  panel.querySelector('#home-editor-reset').addEventListener('click',()=>{targets.get(selected).value={...targets.get(selected).defaults};save();});
  for(const id of targets.keys()) apply(id);choose(selected);
}
