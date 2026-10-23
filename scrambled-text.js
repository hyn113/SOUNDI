/* React Bits Scrambled Text interaction adapted for the existing vanilla DOM.
 * Uses the same GSAP ScrambleTextPlugin, .: glyphs, radius 100, duration 1.2,
 * and expanding click burst as the reference, with all timings halved.
 * https://reactbits.dev/text-animations/scrambled-text
 */
(() => {
  if(!window.gsap || !window.ScrambleTextPlugin)return;
  gsap.registerPlugin(ScrambleTextPlugin);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const home=document.getElementById('homeView'), login=document.getElementById('loginModal');
  const records=[];
  const active=r=>r.inView && !document.hidden && (r.login ? !login.hidden : document.body.dataset.view==='home' && login.hidden);
  const timingScale = .5; // Shared speed for login and every home text target.
  function scramble(char,duration,delay=0,start=0) {
    gsap.to(char.ink,{overwrite:true,duration:duration*timingScale,ease:'none',delay:start*timingScale,scrambleText:{text:char.value,chars:'.:',speed:1,revealDelay:delay*timingScale}});
  }
  function reset(r) {
    gsap.killTweensOf(r.chars.map(c=>c.ink));
    r.chars.forEach(c=>{c.ink.textContent=c.value;});
  }
  function sync() {
    records.forEach(r=>{
      const shown=active(r);
      if(shown && !r.shown && !reduce.matches) {
        r.chars.forEach((c,i)=>{
          const reveal=.15+1.2*(.75*i/r.chars.length+.25*Math.random());
          scramble(c,reveal+.1,reveal);
        });
      } else if(!shown || reduce.matches)reset(r);
      r.shown=shown;
    });
  }
  document.querySelectorAll('#loginTitle, #homeView .hero-orb-copy h1, #homeView .hero-orb-copy .ko-label, #homeView #tutorial p, #homeView #tutorial .ko-label').forEach(element=>{
    const r={element,login:element.id==='loginTitle',chars:[],inView:false,shown:false};
    if(r.login)element.textContent='SOUNDI';
    element.setAttribute('aria-label',element.innerText.replace(/\s+/g,' ').trim());
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const fragment=document.createDocumentFragment();
      for(const token of node.textContent.split(/(\s+)/)) {
        if(!token)continue;
        if(/^\s+$/.test(token)){fragment.append(document.createTextNode(token));continue;}
        const word=document.createElement('span');word.className='scramble-word';word.setAttribute('aria-hidden','true');
        for(const value of token) {
          const cell=document.createElement('span');cell.className='scramble-cell';
          const measure=document.createElement('span');measure.className='scramble-measure';measure.textContent=value;
          const ink=document.createElement('span');ink.className='scramble-ink';ink.textContent=value;
          cell.append(measure,ink);word.append(cell);r.chars.push({cell,ink,value});
        }
        fragment.append(word);
      }
      node.replaceWith(fragment);
    });
    element.classList.add('scramble-ready');
    let frame=0,pointer;
    const distances=e=>r.chars.map(c=>{
      const box=c.cell.getBoundingClientRect();
      return Math.hypot(e.clientX-box.left-box.width/2,e.clientY-box.top-box.height/2);
    });
    element.addEventListener('pointermove',e=>{
      if(reduce.matches || !active(r))return;
      pointer={clientX:e.clientX,clientY:e.clientY};
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        distances(pointer).forEach((distance,i)=>{if(distance<100)scramble(r.chars[i],1.2*(1-distance/100));});
      });
    },{passive:true});
    element.addEventListener('pointerdown',e=>{
      if(reduce.matches || !active(r) || (e.pointerType==='mouse' && e.button!==0))return;
      const ds=distances(e),reach=Math.max(...ds)+(parseFloat(getComputedStyle(element).fontSize)||16);
      const life=.45+reach/1100;
      ds.forEach((d,i)=>{
        const start=life*(1-Math.sqrt(Math.max(0,1-d/reach)));
        scramble(r.chars[i],Math.max(.2,1.2*(.2+.5*(1-.6*d/reach))),0,start);
      });
    },{passive:true});
    new IntersectionObserver(entries=>{r.inView=entries[0].isIntersecting;sync();},{root:r.login?null:home,rootMargin:'0px 0px -10% 0px'}).observe(element);
    records.push(r);
  });
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class','data-view']});
  new MutationObserver(sync).observe(login,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',sync);
  reduce.addEventListener('change',sync);
  sync();
})();
