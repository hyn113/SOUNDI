/* Vertical Wake Slider for the existing volume input/audio pipeline.
 * Interaction reference: https://reactbits.dev/micro/wake-slider
 */
(() => {
  const input = document.getElementById('volumeSlider');
  const popover = document.getElementById('volumePopover');
  if (!input || !popover) return;
  const track = document.createElement('div');
  track.className = 'volume-wake-track';
  input.before(track);
  const bars = Array.from({length:32}, () => {
    const bar = document.createElement('span');
    bar.className = 'volume-wake-bar';
    bar.setAttribute('aria-hidden','true');
    track.append(bar);
    return bar;
  });
  track.append(input);
  input.setAttribute('aria-orientation','vertical');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let target = Number(input.value), head = target, velocity = 0, speed = 0;
  let frame = 0, lastTime = 0, pointer = null;
  function paint() {
    const normalizedSpeed = reduce.matches ? 0 : Math.min(1,Math.abs(speed)/320);
    const amplitude = normalizedSpeed*normalizedSpeed*(3-2*normalizedSpeed);
    const reach = 1.5+3*amplitude;
    bars.forEach((bar,index) => {
      const distance = index-head/100*31;
      const radius = reach*(distance*Math.sign(speed)<0 ? 1.6 : .7);
      const wake = Math.abs(distance)<radius ? amplitude*Math.cos(Math.PI*distance/(2*radius))**2 : 0;
      bar.style.transform = `scaleX(${10/24+wake*(1-10/24)})`;
      bar.dataset.on = String(index<=Math.round(head/100*31));
    });
  }
  function tick(now) {
    const dt=Math.min(.025,Math.max(.001,(now-lastTime)/1000));
    lastTime=now;
    // Critically damped head, followed by a smoothed speed-driven wake.
    const previous=head;
    const omega=30.8, error=head-target, decay=Math.exp(-omega*dt);
    head=target+(error+(velocity+omega*error)*dt)*decay;
    velocity=(velocity-omega*(velocity+omega*error)*dt)*decay;
    speed+=( (head-previous)/dt-speed )*(1-Math.exp(-dt/.1));
    paint();
    if (Math.abs(head-target)>.01 || Math.abs(speed)>.05 || Math.abs(velocity)>.05) frame=requestAnimationFrame(tick);
    else { frame=0; head=target; speed=velocity=0; paint(); }
  }
  function sync() {
    target=Number(input.value);
    input.setAttribute('aria-valuetext', `${target}%`);
    if (reduce.matches || popover.hidden) {
      cancelAnimationFrame(frame); frame=0; head=target; speed=velocity=0; paint();
    } else if (!frame) { lastTime=performance.now(); frame=requestAnimationFrame(tick); }
  }
  function commit(value) {
    const next=Math.max(0,Math.min(100,Math.round(value)));
    if (Number(input.value)===next) return;
    input.value=String(next);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function fromPointer(event) {
    const rect=track.getBoundingClientRect();
    commit((rect.bottom-event.clientY)/rect.height*100);
  }
  track.addEventListener('pointerdown',event=>{
    if (event.button!==0 || input.disabled || pointer!==null) return;
    event.preventDefault(); pointer=event.pointerId;
    track.setPointerCapture(pointer);
    input.focus({preventScroll:true});
    fromPointer(event);
  });
  track.addEventListener('pointermove',event=>{if(event.pointerId===pointer) fromPointer(event);});
  function release(event) {
    if (event.pointerId!==pointer) return;
    pointer=null;
    if(track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  track.addEventListener('pointerup',release);
  track.addEventListener('pointercancel',release);
  track.addEventListener('lostpointercapture',()=>{pointer=null;});
  input.addEventListener('keydown',event=>{
    const value=Number(input.value);
    const values={ArrowUp:value+1,ArrowRight:value+1,ArrowDown:value-1,ArrowLeft:value-1,PageUp:value+10,PageDown:value-10,Home:0,End:100};
    if (!(event.key in values)) return;
    event.preventDefault(); commit(values[event.key]);
  });
  input.addEventListener('input',sync);
  document.addEventListener('soundi:volumechange',sync);
  new MutationObserver(sync).observe(popover,{attributes:true,attributeFilter:['hidden']});
  reduce.addEventListener('change',sync);
  sync();
})();
