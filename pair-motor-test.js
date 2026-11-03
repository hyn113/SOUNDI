(function(){
 const c=window.SoundiESP32,label=document.getElementById('now');
 const names=['맨 위 1 + 5','2 + 6','3 + 7','맨 아래 4 + 8'];
 let active=null,origin=0;
 c.gain=1;
 function run(rows){
  if(!c.connected){label.textContent='먼저 이 화면에서 블루투스를 연결하세요.';return;}
  const intensity=Number(document.getElementById('level').value);
  c.stop();
  c.play(rows.map((row,i)=>({startTime:i*3,duration:2,intensity,pattern:'sustained',pitches:[72-row*4],pitchRange:[60,72],onsetAccent:false})),Date.now()/1000);
  active=rows;origin=performance.now();
 }
 document.querySelectorAll('[data-pair]').forEach(b=>b.onclick=()=>run([Number(b.dataset.pair)]));
 document.getElementById('allPairs').onclick=()=>run([0,1,2,3]);
 window.addEventListener('soundi-esp32-test',()=>{active=null;label.textContent='정지됨';});
 setInterval(()=>{
  if(!active)return;
  if(document.hidden||!c.connected){c.stop();active=null;label.textContent='정지됨';return;}
  const elapsed=(performance.now()-origin)/1000,index=Math.floor(elapsed/3);
  if(index>=active.length){c.stop();active=null;label.textContent='비교 완료';return;}
  label.textContent=names[active[index]]+' · '+(elapsed%3<2?'좌우 동시 진동':'쉼');
 },100);
})();
