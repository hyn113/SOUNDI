// Only public task status; no inferred model reasoning or fabricated progress.
(() => {
  const label = document.createElement('div');
  label.className = 'ai-work-cursor';
  label.hidden = true;
  label.setAttribute('aria-hidden', 'true');
  document.body.append(label);
  let text = '', x = 0, y = 0, pointerSeen = false;
  function draw() {
    label.hidden = !text || !pointerSeen || window.matchMedia('(pointer: coarse)').matches;
    label.textContent = text;
    label.style.left = `${Math.max(8, Math.min(x + 18, window.innerWidth - 300))}px`;
    label.style.top = `${Math.max(8, Math.min(y + 22, window.innerHeight - 48))}px`;
  }
  window.addEventListener('pointermove', event => {x=event.clientX;y=event.clientY;pointerSeen=true;draw();}, {passive:true});
  document.addEventListener('pointerleave', () => {pointerSeen=false;draw();});
  window.addEventListener('soundi-ai-work', event => {text=String(event.detail?.text || '');draw();});
  window.addEventListener('blur', () => {label.hidden=true;});
})();
