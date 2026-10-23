// Public task progress only: actual request milestones, not model reasoning.
(() => {
  const root = document.getElementById('aiThoughtLine');
  if (!root) return;
  const button = root.querySelector('button');
  const title = root.querySelector('.thought-title');
  const timer = root.querySelector('.thought-timer');
  const list = root.querySelector('ol');
  const status = root.querySelector('[role="status"]');
  const copy = {
    ko: {working:'개선 방향을 정리하고 있어요',done:'개선 방향을 준비했어요',fallback:'기본 분석으로 개선 방향을 준비했어요',error:'분석을 완료하지 못했어요',read:'곡의 음계·리듬·화음 확인',local:'작곡 의도와 곡의 특징 비교 완료',request:'AI에 피드백을 요청했어요 · 응답을 기다리는 중',received:'피드백 수신 · 개선 방향 정리',fallbackStep:'AI 연결 대신 기본 분석 결과 사용',complete:'개선 방향 준비 완료'},
    en: {working:'Preparing your feedback',done:'Feedback is ready',fallback:'Feedback ready from local analysis',error:'Could not finish the analysis',read:'Checking notes, rhythm and harmony',local:'Compared your intent with the composition',request:'Feedback requested · waiting for AI',received:'Feedback received · preparing suggestions',fallbackStep:'Using local analysis instead of AI',complete:'Suggestions ready'}
  };
  let steps=[], state='idle', started=0, elapsed=0, clock=null;
  const words = () => copy[document.documentElement.lang==='en'?'en':'ko'];
  function draw() {
    const text=words();
    root.hidden=state==='idle';
    root.classList.toggle('is-working',state==='working');
    root.classList.toggle('is-error',state==='error');
    title.textContent=text[state] || text.done;
    list.replaceChildren(...steps.map((key,index)=>{
      const item=document.createElement('li');
      item.textContent=text[key];
      item.className=state==='working' && index===steps.length-1?'is-current':'is-complete';
      return item;
    }));
    status.textContent=state==='working'?text[steps.at(-1)] || text.working : text[state] || '';
  }
  function tick() { timer.textContent=`${((state==='working'?performance.now()-started:elapsed)/1000).toFixed(1)}s`; }
  function expand(open) { button.setAttribute('aria-expanded',String(open)); root.classList.toggle('is-expanded',open); }
  button.addEventListener('click',()=>expand(button.getAttribute('aria-expanded')!=='true'));
  window.soundiThought = {
    start() { clearInterval(clock); steps=[]; state='working'; started=performance.now(); elapsed=0; expand(true); draw(); tick(); clock=setInterval(tick,100); },
    step(key) { if(state!=='working' || steps.includes(key))return; steps.push(key); draw(); },
    finish(result='done') { elapsed=performance.now()-started; state=result; clearInterval(clock); clock=null; draw(); tick(); expand(false); },
    reset() { clearInterval(clock); clock=null; steps=[]; state='idle'; draw(); }
  };
  new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
