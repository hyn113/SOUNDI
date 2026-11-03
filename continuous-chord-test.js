(function(){
 const c=window.SoundiESP32,label=document.getElementById('now');
 const stages=[['① 장3도 · 강강',[60,64]],['② 단3도 · 강강강',[60,63]],['③ 완전5도 · 길게 강',[60,67]],['④ sus2 · 짧게→길게',[60,62,67]],['⑤ sus4 · 길게→짧게',[60,65,67]],['⑥ 장7화음 · 느린 강약',[60,64,67,71]],['⑦ 기타 음 조합 · 빠른 강약',[60,61,66]]];
 let active=null,origin=0;c.gain=1;
 function run(indices){
  if(!c.connected){label.textContent='이 페이지에서 블루투스를 먼저 연결하세요.';return;}
  c.stop();c.play(indices.map((index,i)=>({startTime:i*7,duration:5,pitches:[66],pitchRange:[60,84],intensity:.85,pattern:window.SoundiHapticStructure(stages[index][1]).pattern,onsetAccent:false})),Date.now()/1000);
  active=indices;origin=performance.now();
 }
 document.getElementById('runAll').onclick=()=>run([0,1,2,3,4,5,6]);
 document.querySelectorAll('[data-texture]').forEach(b=>b.onclick=()=>run([Number(b.dataset.texture)]));
 window.addEventListener('soundi-esp32-test',()=>{active=null;label.textContent='정지됨';});
 setInterval(()=>{
  if(!active)return;
  if(document.hidden||!c.connected){c.stop();active=null;label.textContent='정지됨';return;}
  const t=(performance.now()-origin)/1000,i=Math.floor(t/7);
  if(i>=active.length){c.stop();active=null;label.textContent='완료';return;}
  label.textContent=stages[active[i]][0]+' · '+(t%7<5?'끊김 없이 강약 진동':'다음 패턴 전 2초 정지');
 },100);
})();
