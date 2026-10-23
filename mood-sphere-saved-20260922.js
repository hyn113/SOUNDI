/**
 * Adapted from SmoothUI Orb by Eduardo Calvo (MIT).
 * https://smoothui.dev/docs/components/orb
 * https://github.com/educlopez/smoothui
 * Copyright (c) 2024 Eduardo Calvo. See vendor/SMOOTHUI-LICENSE.txt.
 * Soundi additions: vanilla WebGL adapter, six-colour palettes, independent
 * contour controls, V-A-T mapping, theme handling and smooth transitions.
 * Aurora Veil is a visual reference only; no Liquid Orb Editor code is copied.
 */
const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;   // the hash needs full 32-bit ints

uniform vec2  uRes;
uniform float uPhase;
uniform vec3  uLab[6];
uniform float uCount;
uniform float uScaleN;
uniform float uFlow;
uniform float uTurb;
uniform float uShift;
uniform float uBalance;
uniform float uChroma;
uniform float uContrast;
uniform float uRim;
uniform float uSpec;
uniform float uInner;
uniform float uShading;
uniform float uRefract;
uniform float uIrid;
uniform float uAberr;
uniform float uGrain;
uniform float uSoft;
uniform float uWobble;
uniform float uContourPhase;
uniform float uWaves;
uniform float uIrregularity;
uniform float uBreath;
uniform float uDark;
uniform float uOpacity;
uniform float uGlow;
uniform vec3  uLight;

out vec4 fragColor;

const float TAU = 6.28318530718;
const float RAD = 0.80;         // sphere radius in uv units; the rest is glow room
const float RMAX = 1.0 / RAD;   // radius reached at the nearest canvas edge

/* MurmurHash3 finalizer, Austin Appleby, public domain. Exact at any lattice
   coordinate, so unlike a fract(sin(...)) hash it never bands as the input
   grows — which matters for the grain, whose input runs into the thousands. */
uint hashU(uint x) {
  x ^= x >> 16; x *= 0x85EBCA6Bu;
  x ^= x >> 13; x *= 0xC2B2AE35u;
  x ^= x >> 16;
  return x;
}
uint hashU2(uvec2 p) { return hashU(p.x * 0x9E3779B9u ^ hashU(p.y)); }
uint hashU3(uvec3 p) { return hashU(p.x * 0x9E3779B9u ^ hashU(p.y) ^ hashU(p.z) * 0x27D4EB2Fu); }
float rand2(ivec2 p) { return float(hashU2(uvec2(p + 4096)) >> 8) / 16777216.0; }
float rand3(ivec3 p) { return float(hashU3(uvec3(p + 4096)) >> 8) / 16777216.0; }

/* Fresnel-driven hue rotation in the a/b plane — thin-film sheen. */
vec3 iridesce(vec3 lab, float f) {
  float a = uIrid * f * -2.2;
  float c = cos(a), s = sin(a);
  return vec3(lab.x, c * lab.y - s * lab.z, s * lab.y + c * lab.z);
}

/* Rounded colour clouds: blend distances directly instead of mapping noise
   through a repeated palette, which creates ribbons and internal wave bands. */
vec3 paletteLab(vec2 p) {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  float spread = clamp(5.8 * uScaleN, 1.8, 12.0) / (1.0 + uTurb * 0.45);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uCount) break;
    float a = TAU * (float(i) / uCount + uShift);
    vec2 centre = 0.56 * vec2(cos(a), sin(a));
    centre += 0.14 * uFlow * vec2(sin(uPhase + a * 2.0), cos(uPhase + a));
    vec2 delta = p - centre;
    float weight = exp(-dot(delta, delta) * spread);
    weight *= pow(0.8 + 0.4 * cos(a), uBalance);
    sum += uLab[i] * weight;
    total += weight;
  }
  vec3 lab = sum / max(total, 0.00001);
  lab.yz *= 1.0 + 0.17 * uChroma;
  float ch = length(lab.yz);
  if (ch > 0.33) lab.yz *= 0.33 / ch;
  lab.x = clamp(0.5 + (lab.x - 0.5) * uContrast, 0.0, 1.0);
  return lab;
}

/* OkLab transform, Björn Ottosson, public domain. */
vec3 oklabToLinear(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  vec3 lms = vec3(l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
  return mat3( 4.0767416621, -1.2684380046, -0.0041960863,
              -3.3077115913,  2.6097574011, -0.7034186147,
               0.2309699292, -0.3413193965,  1.7076147010) * lms;
}

vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, 1e-5), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(0.0031308, c));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  uv /= RAD;
  vec2 colourUv = uv; // Contour motion must not bend the interior into waves.

  /* Silhouette wobble. Integer harmonics of the angle keep it continuous all
     the way round; integer multiples of the phase keep it periodic in time.
     Faded in with radius so the rim deforms like a drop while the core stays
     put — which also keeps it away from atan()'s singularity at the centre. */
  if (uWobble > 0.0) {
    float r0 = length(uv);
    float th = atan(uv.y, uv.x + 1e-6);
    // Adjacent integer harmonics keep the contour seamless at +/- pi.
    float k=floor(uWaves), f=fract(uWaves);
    float primary=mix(sin(k*th+uContourPhase),sin((k+1.0)*th+uContourPhase),f);
    float detail=0.45*sin(5.0*th-uContourPhase*1.31)
                +0.25*sin(7.0*th+uContourPhase*0.73);
    float wob=primary*0.70+detail*uIrregularity;
    float breathing=sin(uContourPhase*0.67)*uBreath*0.018;
    uv /= 1.0 + (uWobble*0.055*wob+breathing)*smoothstep(0.0,0.6,r0);
  }

  float r = length(uv);
  vec2 pd = uv / max(r, 1.0);
  float z = sqrt(max(1.0 - dot(pd, pd), 0.0));
  vec3 n = vec3(pd, z);

  // The shell compresses a little colour near the edge, suggesting thickness.
  // This is a soft, tinted refraction band rather than a uniform drawn outline.
  float fres3 = pow(1.0 - n.z, 3.0);
  float shell = smoothstep(0.78, 0.98, r);
  vec2 sampleUv = colourUv * (1.0 - uRefract * shell * 0.38);
  vec3 lab = iridesce(paletteLab(sampleUv), fres3);
  vec3 base;
  if (uAberr > 0.001) {
    vec2 d = pd * uAberr * 0.018 * shell;
    base = vec3(oklabToLinear(iridesce(paletteLab(sampleUv - d), fres3)).r,
                oklabToLinear(lab).g,
                oklabToLinear(iridesce(paletteLab(sampleUv + d), fres3)).b);
  } else {
    base = oklabToLinear(lab);
  }
  base = max(base, 0.0);

  // Lighting is added in linear light, which is where it belongs.
  vec3 L = normalize(uLight);
  vec3 col = base * mix(1.0, 0.65 + 0.35*max(dot(n,L),0.0), uShading);

  // Internal scatter offset away from the highlight: a translucent body rather
  // than a lit opaque ball.
  vec2 op = pd + L.xy * 0.45;
  col += uInner * exp(-dot(op, op) * 2.2) * base;

  vec3 half_ = normalize(L + vec3(0.0, 0.0, 1.0));
  float lightSide = 0.5 + 0.5 * dot(pd, normalize(L.xy));
  float innerEdge = exp(-pow((r - 0.944) / 0.033, 2.0));
  // A small coloured density change under a broad highlight makes the rim
  // readable on white without introducing a grey shadow or a hard glass ring.
  col *= 1.0 - innerEdge * uRim * 0.085 * (1.0 - lightSide * 0.5);
  vec3 rimTint = mix(base, vec3(1.0), 0.72);
  col += rimTint * pow(1.0 - n.z, 5.0) * uRim
       * mix(0.34, 0.46, uDark) * (0.45 + 0.55 * lightSide)
       + pow(max(dot(n, half_), 0.0), 24.3) * uSpec;

  vec3 lit = linearToSrgb(col);
  vec3 flat_ = linearToSrgb(base);

  // Never thinner than ~1.5 device px, so the rim stays smooth when the
  // character is rendered small.
  float w = max(uSoft, 1.5 * fwidth(r));
  float body = 1.0 - smoothstep(1.0 - w, 1.0, r);

  /* The halo has to reach exactly zero before the canvas boundary. Left alone
     it is still ~1.5/255 at the edge and gets cut off square, which shows the
     canvas box as a faint rectangle around the orb. */
  float glowF = uGlow * exp(-max(r - 1.0, 0.0) * 20.0);
  glowF *= 1.0 - smoothstep(0.45, 1.0, (r - 1.0) / (RMAX - 1.0));
  float shellAlpha=clamp(uOpacity + 0.10*pow(1.0-n.z,3.0),0.0,1.0);
  float alpha = clamp(body*shellAlpha + glowF*(1.0-body),0.0,1.0);

  vec3 outCol = mix(flat_, lit, body);

  // Grain plus an always-on deband dither, stepped to 24 frames per loop so it
  // animates without breaking the seam.
  int frame = int(uPhase / TAU * 24.0);
  outCol += (rand3(ivec3(ivec2(gl_FragCoord.xy), frame)) - 0.5)
          * (uGrain * 0.1 + 1.0 / 255.0);

  outCol = clamp(outCol, 0.0, 1.0);
  fragColor = vec4(outCol * alpha, alpha);   // premultiplied
}`;

export const ORB_DEFAULTS = Object.freeze({
  blobScale:2.5, flow:0.65, turbulence:0.32, shift:0.20, balance:0.5,
  chroma:0.65, contrast:1.02, duration:14, grain:0.42,
  rim:0.95, specular:0.22, inner:0.28, shading:0.05,
  refraction:0.24, iridescence:0.08, aberration:0.3,
  softness:0.006, wobble:0.65, waves:3, irregularity:0.4,
  contourSpeed:0.9, breath:0.3, opacity:0.96, paused:false
});
const BOUNDS={
  blobScale:[0.5,6],flow:[0,2],turbulence:[0,1.5],shift:[0,1],balance:[0.05,0.95],
  chroma:[0,1.5],contrast:[0.5,1.5],duration:[4,40],grain:[0,1],rim:[0,2],
  specular:[0,1],inner:[0,0.8],shading:[0,0.5],refraction:[0,0.65],
  iridescence:[0,0.7],aberration:[0,1],softness:[0.002,0.03],wobble:[0,2],
  waves:[2,7],irregularity:[0,1],contourSpeed:[0.1,3],breath:[0,1],opacity:[0.5,1]
};
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

// Rasterize CSS colours once per palette change; conversion never runs per frame.
function createColorConverter(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Colour conversion unavailable');
  return input=>{
    ctx.clearRect(0,0,1,1);ctx.fillStyle='#ffffff';ctx.fillStyle=input;ctx.fillRect(0,0,1,1);
    const rgb=ctx.getImageData(0,0,1,1).data;
    const [r,g,b]=Array.from(rgb).slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});
    // OkLab, Björn Ottosson (public domain).
    const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b);
    const m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b);
    const s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
    return [0.2104542553*l+0.793617785*m-0.0040720468*s,
      1.9779984951*l-2.428592205*m+0.4505937099*s,
      0.0259040371*l+0.7827717662*m-0.808675766*s];
  };
}

export function createMoodSphere(host,{config={}}={}){
  const canvas=document.createElement('canvas');
  canvas.className='mood-sphere-canvas';canvas.setAttribute('aria-hidden','true');
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL2 unavailable; retaining CSS feedback');
  const convert=createColorConverter();
  let program=null,uniforms={},disposed=false,lost=false,visible=false,raf=0,last=0;
  let phase=0,contourPhase=0,count=4,hasPalette=false;
  let auto={...ORB_DEFAULTS},overrides={},current={...ORB_DEFAULTS};
  const labs=new Float32Array(18),targetLabs=new Float32Array(18);
  for(let i=0;i<6;i++){labs[i*3]=1;targetLabs[i*3]=1;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let dark=document.documentElement.dataset.theme==='dark';

  function initialize(){
    const compile=(kind,source)=>{
      const shader=gl.createShader(kind);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);
      }
      return shader;
    };
    let vs,fs,p;
    try{
      vs=compile(gl.VERTEX_SHADER,VERTEX);fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);
      p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
      program=p;
    }catch(error){if(p)gl.deleteProgram(p);throw error;}
    finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
    gl.useProgram(program);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    uniforms={};
    for(const name of ['uRes','uPhase','uLab[0]','uCount','uScaleN','uFlow','uTurb','uShift','uBalance','uChroma','uContrast','uRim','uSpec','uInner','uShading','uRefract','uIrid','uAberr','uGrain','uSoft','uWobble','uGlow','uLight','uContourPhase','uWaves','uIrregularity','uBreath','uDark','uOpacity'])uniforms[name]=gl.getUniformLocation(program,name);
  }
  initialize();host.append(canvas);
  function resize(){
    const box=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  }
  function draw(){
    gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);
    const set=(name,value)=>gl.uniform1f(uniforms[name],value);
    gl.uniform2f(uniforms.uRes,canvas.width,canvas.height);
    gl.uniform3fv(uniforms['uLab[0]'],labs);gl.uniform3f(uniforms.uLight,-0.6,0.8,0.65);
    set('uCount',count);set('uPhase',phase);set('uContourPhase',contourPhase);
    set('uScaleN',1.45/current.blobScale);set('uBalance',5**((0.5-current.balance)*2));
    const mapping={flow:'uFlow',turbulence:'uTurb',shift:'uShift',chroma:'uChroma',contrast:'uContrast',rim:'uRim',specular:'uSpec',inner:'uInner',shading:'uShading',refraction:'uRefract',iridescence:'uIrid',aberration:'uAberr',grain:'uGrain',softness:'uSoft',wobble:'uWobble',waves:'uWaves',irregularity:'uIrregularity',breath:'uBreath',opacity:'uOpacity'};
    for(const [key,name] of Object.entries(mapping))set(name,current[key]);
    set('uDark',dark?1:0);set('uGlow',0); // No floor shadow or outer halo.
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
    host.classList.add('has-glass-sphere');
  }
  function tick(now){
    raf=0;if(disposed||lost||!visible||document.hidden)return;
    const dt=Math.min((now-last)/1000||0.016,0.08);last=now;
    const target={...auto,...overrides},blend=1-Math.exp(-dt*4);
    let changing=false;
    for(const key of Object.keys(BOUNDS)){
      const delta=target[key]-current[key];current[key]+=delta*blend;
      if(Math.abs(delta)>0.0001)changing=true;
    }
    for(let i=0;i<18;i++){const delta=targetLabs[i]-labs[i];labs[i]+=delta*blend;if(Math.abs(delta)>0.0001)changing=true;}
    const moving=!reduced.matches&&!target.paused;
    if(moving){phase=(phase+dt*Math.PI*2/current.duration)%(Math.PI*2);contourPhase+=dt*current.contourSpeed;}
    draw();if(moving||changing)raf=requestAnimationFrame(tick);
  }
  function wake(){if(!raf&&!disposed&&!lost&&visible&&!document.hidden){last=performance.now();raf=requestAnimationFrame(tick);}}
  function stop(){cancelAnimationFrame(raf);raf=0;}
  function setOptions(patch){
    for(const [key,value] of Object.entries(patch||{})){
      if(key==='paused'){overrides.paused=Boolean(value);continue;}
      if(BOUNDS[key]&&Number.isFinite(value))overrides[key]=clamp(value,...BOUNDS[key]);
    }
    wake();
  }
  const ro=new ResizeObserver(()=>{resize();wake();});ro.observe(host);
  const io=new IntersectionObserver(entries=>{visible=entries[entries.length-1].isIntersecting;if(visible)wake();else stop();});io.observe(host);
  const mo=new MutationObserver(()=>{dark=document.documentElement.dataset.theme==='dark';wake();});
  mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  const visibility=()=>{if(document.hidden)stop();else wake();};
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',wake);
  const contextLost=event=>{event.preventDefault();lost=true;stop();host.classList.remove('has-glass-sphere');};
  const contextRestored=()=>{try{initialize();lost=false;resize();wake();}catch(error){console.warn('Soundi orb restore failed',error);}};
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  setOptions(config);resize();
  return {
    setOptions,
    update({colors,energy=0,tension=0}={}){
      if(Array.isArray(colors)&&colors.length){
        const stops=colors.slice(0,6);count=Math.max(2,stops.length);
        for(let i=0;i<6;i++)targetLabs.set(convert(stops[Math.min(i,stops.length-1)]),i*3);
        if(!hasPalette){labs.set(targetLabs);hasPalette=true;}
      }
      const e=Number.isFinite(energy)?clamp(energy,0,1):0;
      const t=Number.isFinite(tension)?clamp(tension,0,1):0;
      auto={...ORB_DEFAULTS,duration:20-e*10,wobble:0.15+e*0.8+t*0.4,
        contourSpeed:0.4+e*1.2,waves:2.4+t*2.6,irregularity:0.15+t*0.65,
        turbulence:0.22+t*0.3,flow:0.5+e*0.3,breath:0.12+e*0.35};
      wake();
    },
    dispose(){
      disposed=true;stop();ro.disconnect();io.disconnect();mo.disconnect();
      document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',wake);
      canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
      gl.deleteProgram(program);canvas.remove();host.classList.remove('has-glass-sphere');
    }
  };
}
const host=document.querySelector('#visualMarks .mark');
if(host){
  try{
    const sphere=createMoodSphere(host);
    if(host.soundiSphereState)sphere.update(host.soundiSphereState);
    window.addEventListener('soundi:sphere-update',event=>sphere.update(event.detail));
  }catch(error){console.warn('Soundi orb unavailable; retaining CSS feedback.',error);}
}
