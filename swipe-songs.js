/* Swipe Row-style reveal / full-swipe deletion for the composer's saved songs. */
(() => {
  const list=document.getElementById('mySongsList');
  if(!list) return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const mounted=new WeakSet();
  let closeOpen=null;
  function bind(row) {
    if(mounted.has(row))return;
    mounted.add(row);
    const front=document.createElement('div');
    front.className='song-swipe-front';
    front.append(...row.childNodes);
    const action=document.createElement('button');
    action.type='button'; action.className='song-swipe-delete';
    action.textContent=translate('delete');
    action.setAttribute('aria-label', `${row.querySelector('strong')?.textContent || front.querySelector('strong')?.textContent || ''} · ${translate('delete')}`);
    action.tabIndex=-1;
    row.classList.add('song-swipe-row');
    row.append(action,front);
    let x=0, drag=null, busy=false, suppressUntil=0;
    const reveal=76;
    function paint(next,animate=true) {
      x=next;
      front.style.transition=animate && !reduce.matches?'transform 380ms cubic-bezier(.22,1,.36,1)':'none';
      front.style.transform=`translateX(${x}px)`;
      row.classList.toggle('is-revealed',x < -2);
      row.classList.toggle('is-commit-ready',-x>row.clientWidth*.7);
      action.style.width=`${Math.max(reveal,-x)}px`;
      action.tabIndex=x < -30?0:-1;
      action.setAttribute('aria-hidden',String(x>=-2));
    }
    const close=()=>{if(!busy)paint(0);};
    function revealAction() { if(closeOpen && closeOpen!==close)closeOpen(); closeOpen=close;paint(-reveal); }
    async function remove() {
      if(busy)return;
      busy=true; row.setAttribute('aria-busy','true'); action.disabled=true;
      paint(-row.clientWidth);
      const success=await deleteMySongs([row.dataset.songId], {beforeRemove:async()=>{
        const animation=row.animate([{height:`${row.getBoundingClientRect().height}px`,opacity:1},{height:'0px',opacity:0}],{duration:reduce.matches?0:230,easing:'ease',fill:'forwards'});
        await animation.finished.catch(()=>{});
      }});
      if(!success) { busy=false;action.disabled=false;row.removeAttribute('aria-busy');paint(0); }
      if(closeOpen===close)closeOpen=null;
    }
    action.addEventListener('click',event=>{event.stopPropagation();remove();});
    front.addEventListener('pointerdown',event=>{
      if(event.button!==0 || busy || event.shiftKey || event.target.closest('.my-song-more-wrap'))return;
      if(closeOpen && closeOpen!==close)closeOpen();
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:x,moved:false};
    });
    front.addEventListener('pointermove',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved && Math.abs(dy)>Math.abs(dx)+6){drag=null;return;}
      if(!drag.moved && Math.abs(dx)<8)return;
      drag.moved=true;front.setPointerCapture(event.pointerId);
      paint(Math.max(-row.clientWidth,Math.min(0,drag.start+dx)),false);
    });
    function end(event) {
      if(!drag || drag.id!==event.pointerId)return;
      const moved=drag.moved;drag=null;
      if(!moved)return;
      suppressUntil=performance.now()+400;
      if(event.type==='pointercancel'){close();return;}
      if(-x>row.clientWidth*.7)remove();
      else if(-x>reveal*.45)revealAction();
      else close();
    }
    front.addEventListener('pointerup',end);
    front.addEventListener('pointercancel',end);
    front.addEventListener('click',event=>{
      if(busy || performance.now()<suppressUntil || x<0){event.preventDefault();event.stopImmediatePropagation();if(!busy)close();}
    },true);
    front.addEventListener('keydown',event=>{
      if(event.target.closest('.my-song-more-wrap'))return;
      if(event.key==='ArrowLeft'){event.preventDefault();revealAction();action.focus();}
    });
    row.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();front.querySelector('.my-song-open').focus();}});
    paint(0,false);
  }
  function scan(){list.querySelectorAll('.my-song-item').forEach(bind);}
  new MutationObserver(scan).observe(list,{childList:true});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.song-swipe-row'))closeOpen?.();});
  scan();
})();
