import {createMoodSphere,ORB_DEFAULTS} from './mood-sphere-saved-20260922.js';

const palettes={
  smooth:['#ee73dd','#fff4fb','#7adcf0','#9980ee','#ffc8aa','#aaf0d7'],
  aurora:['#2be6bd','#5cc9ff','#a079f4','#f4c5ff','#fff0d0','#8af3df'],
  coral:['#ff807e','#ffd0b8','#fff5ed','#e6a2d7','#aeaeff','#ffb6c3'],
  opal:['#c2f1e1','#fffaf0','#a5c8ff','#d7baf4','#ffccda','#e5f7bd']
};
const shapes={
  round:{wobble:0,breath:0,waves:3,contourSpeed:0.9,irregularity:0},
  soft:{wobble:0.65,breath:0.3,waves:3,contourSpeed:0.9,irregularity:0.4},
  fluid:{wobble:1.25,breath:0.4,waves:2.5,contourSpeed:0.65,irregularity:0.55},
  lively:{wobble:1.8,breath:0.65,waves:4.8,contourSpeed:1.65,irregularity:0.85}
};
const contour=[['wobble','변형 강도',0,2,0.01],['waves','물결 개수',2,7,0.1],['contourSpeed','출렁임 속도',0.1,3,0.05],['irregularity','불규칙성',0,1,0.01],['breath','숨쉬기',0,1,0.01]];
const surface=[['grain','입자감',0,1,0.01],['blobScale','색 덩어리 크기',0.5,6,0.1],['flow','색 덩어리 이동',0,2,0.05],['turbulence','색 번짐',0,1.5,0.05],['duration','색 흐름 주기 · 초',4,40,1],['rim','가장자리 빛',0,2,0.05],['refraction','가장자리 굴절',0,0.65,0.01],['opacity','불투명도',0.5,1,0.01]];
let colors=[...palettes.smooth],count=4,paused=false,sphere;
const form=document.querySelector('#controls');
const controls=new Map();
for(const [id,items] of [['contourSliders',contour],['surfaceSliders',surface]]){
  const section=document.getElementById(id);
  for(const [key,label,min,max,step] of items){
    const row=document.createElement('div');row.className='row';
    const text=document.createElement('label');text.htmlFor=key;text.textContent=label;
    const output=document.createElement('output');output.htmlFor=key;output.value=String(ORB_DEFAULTS[key]);
    const input=document.createElement('input');Object.assign(input,{type:'range',id:key,min,max,step,value:ORB_DEFAULTS[key]});
    row.append(text,output);section.append(row,input);controls.set(key,{input,output});
    input.addEventListener('input',()=>{
      const value=Number(input.value);output.value=String(value);sphere?.setOptions({[key]:value});
      if(contour.some(item=>item[0]===key))document.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed','false'));
    });
  }
}
function pushPalette(){sphere?.update({colors:colors.slice(0,count)});}
function swatches(){
  const group=document.querySelector('#swatches');group.replaceChildren();
  for(let i=0;i<count;i++){
    const input=document.createElement('input');input.type='color';input.value=colors[i];input.setAttribute('aria-label',`색상 ${i+1}`);
    input.addEventListener('input',()=>{colors[i]=input.value;pushPalette();document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed','false'));});
    group.append(input);
  }
}
function applyControls(values){
  for(const [key,value] of Object.entries(values)){
    const control=controls.get(key);if(control){control.input.value=value;control.output.value=String(value);}
  }
  sphere?.setOptions(values);
}
document.querySelector('#palettes').addEventListener('click',event=>{
  const button=event.target.closest('[data-palette]');if(!button)return;
  colors=[...palettes[button.dataset.palette]];swatches();pushPalette();
  document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
document.querySelector('#shapes').addEventListener('click',event=>{
  const button=event.target.closest('[data-shape]');if(!button)return;
  applyControls(shapes[button.dataset.shape]);
  document.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
document.querySelector('#colorCount').addEventListener('change',event=>{count=Number(event.target.value);swatches();pushPalette();});
document.querySelector('#theme').addEventListener('click',event=>{
  const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';
  event.currentTarget.textContent=dark?'화이트 배경':'다크 배경';event.currentTarget.setAttribute('aria-pressed',String(dark));
});
function showPause(){const b=document.querySelector('#pause');b.textContent=paused?'움직임 재생':'움직임 멈추기';b.setAttribute('aria-pressed',String(paused));}
document.querySelector('#pause').addEventListener('click',()=>{paused=!paused;sphere?.setOptions({paused});showPause();});
document.querySelector('#reset').addEventListener('click',()=>{
  colors=[...palettes.smooth];count=4;paused=false;document.querySelector('#colorCount').value='4';
  applyControls({...ORB_DEFAULTS});swatches();pushPalette();showPause();
  document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette==='smooth')));
  document.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape==='soft')));
});
try{sphere=createMoodSphere(document.querySelector('#orb'),{config:ORB_DEFAULTS});}
catch(error){
  const message=document.querySelector('#error');message.hidden=false;message.textContent='이 브라우저에서는 구를 표시할 수 없어요. WebGL2를 지원하는 브라우저에서 열어주세요.';
  form.querySelectorAll('input,select,button').forEach(control=>control.disabled=true);
  document.querySelector('#pause').disabled=true;document.querySelector('#reset').disabled=true;
  console.warn(error);
}
swatches();pushPalette();
window.addEventListener('pagehide',event=>{if(!event.persisted)sphere?.dispose();});

// Frozen snapshot of the user’s live slider settings, 2026-09-22.
const savedPreset={"name": "코랄 · 2026-09-22 저장", "rendererVersion": "20260921-orb-6", "theme": "light", "colors": ["#ff807e", "#ffd0b8", "#fff5ed", "#e6a2d7"], "config": {"blobScale": 4.2, "flow": 1.75, "turbulence": 1.25, "shift": 0.2, "balance": 0.5, "chroma": 0.65, "contrast": 1.02, "duration": 21, "grain": 0.42, "rim": 0.95, "specular": 0.22, "inner": 0.28, "shading": 0.05, "refraction": 0.37, "iridescence": 0.08, "aberration": 0.3, "softness": 0.006, "wobble": 0.28, "waves": 3.8, "irregularity": 0.34, "contourSpeed": 0.35, "breath": 0.31, "opacity": 0.89, "paused": false}};
colors=[...palettes.coral];count=savedPreset.colors.length;
savedPreset.colors.forEach((color,i)=>{colors[i]=color;});
document.querySelector('#colorCount').value=String(count);
document.documentElement.dataset.theme=savedPreset.theme;
applyControls(savedPreset.config);swatches();pushPalette();
document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette==='coral')));
document.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed','false'));
