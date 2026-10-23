// Squish Switch-style stretch and end-stop compression for the tension toggle.
(() => {
  const button=document.getElementById('lessonTensionToggle');
  const track=button?.querySelector('.tension-switch');
  if(!track)return;
  const thumb=document.createElement('span');
  thumb.className='squish-thumb'; track.append(thumb);
  track.classList.add('is-squish');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let animation=null,drag=null,suppressClick=false;
  const travel=()=>Math.max(0,(parseFloat(getComputedStyle(track).width)||36)-(parseFloat(getComputedStyle(thumb).width)||12)-6);
  const current=()=>new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
  function settle() {
    const from=current();
    animation?.cancel();
    const end=button.getAttribute('aria-pressed')==='true'?travel():0;
    thumb.style.transform=`translateX(${end}px)`;
    if(reduce.matches || Math.abs(end-from)<.1)return;
    const middle=from+(end-from)*.6;
    animation=thumb.animate([
      {transform:`translateX(${from}px) scale(1,1)`,offset:0},
      {transform:`translateX(${middle}px) scale(1.45,.78)`,offset:.35},
      {transform:`translateX(${end}px) scale(.78,1.2)`,offset:.65},
      {transform:`translateX(${end}px) scale(1.08,.96)`,offset:.84},
      {transform:`translateX(${end}px) scale(1,1)`,offset:1}
    ],{duration:420,easing:'cubic-bezier(.22,.7,.3,1)'});
  }
  new MutationObserver(settle).observe(button,{attributes:true,attributeFilter:['aria-pressed']});
  track.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const x=current();animation?.cancel();thumb.style.transform=`translateX(${x}px)`;
    drag={id:event.pointerId,start:event.clientX,x,last:event.clientX,time:performance.now(),speed:0,moved:false};
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.start;
    if(Math.abs(dx)>3)drag.moved=true;
    if(!drag.moved)return;
    const now=performance.now();
    drag.speed=(event.clientX-drag.last)/Math.max(1,now-drag.time);
    drag.last=event.clientX;drag.time=now;
    const position=Math.max(0,Math.min(travel(),drag.x+dx));
    const stretch=reduce.matches?0:Math.min(.45,Math.abs(drag.speed)*.3);
    thumb.style.transform=`translateX(${position}px) scale(${1+stretch},${1-stretch*.5})`;
  });
  function end(event) {
    if(!drag || event.pointerId!==drag.id)return;
    const previous=drag;drag=null;
    if(!previous.moved){settle();return;}
    suppressClick=true;
    const elapsed=performance.now()-previous.time;
    const speed=elapsed<100?previous.speed:0;
    const enabled=event.type==='pointercancel'?button.getAttribute('aria-pressed')==='true':Math.abs(speed)>.35?speed>0:current()>travel()/2;
    setLessonTensionEnabled(enabled);
    setTimeout(()=>{suppressClick=false;},0);
  }
  track.addEventListener('pointerup',end);
  track.addEventListener('pointercancel',end);
  button.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},true);
  reduce.addEventListener('change',settle);
  thumb.style.transform=`translateX(${button.getAttribute('aria-pressed')==='true'?travel():0}px)`;
})();
