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
uniform float uOpacity;
uniform float uHighlightCompression;
uniform float uGlow;
uniform vec3  uLight;

out vec4 fragColor;

const float TAU = 6.28318530718;
const float RAD = 0.86;         // sphere radius in uv units; the rest is glow room
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

float vnoise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rand2(i),               rand2(i + ivec2(1, 0)), u.x),
             mix(rand2(i + ivec2(0, 1)), rand2(i + ivec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 3; k++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s / 0.875;
}

/* Each point walks its own circle, completing exactly one turn per loop. */
vec2 flowField(vec2 p) {
  float ang = TAU * vnoise(p + 11.3) + uPhase;
  float mag = 0.35 + 0.65 * vnoise(p + 27.9);
  return vec2(cos(ang), sin(ang)) * mag;
}

/* Fresnel-driven hue rotation in the a/b plane — thin-film sheen. */
vec3 iridesce(vec3 lab, float f) {
  float a = uIrid * f * -2.2;
  float c = cos(a), s = sin(a);
  return vec3(lab.x, c * lab.y - s * lab.z, s * lab.y + c * lab.z);
}

vec3 labRamp(float x) {
  float xx = clamp(x, 0.0, 1.0) * (uCount - 1.0);
  vec3 c = mix(uLab[0], uLab[1], clamp(xx, 0.0, 1.0));
  c = mix(c, uLab[2], clamp(xx - 1.0, 0.0, 1.0));
  c = mix(c, uLab[3], clamp(xx - 2.0, 0.0, 1.0));
  c = mix(c, uLab[4], clamp(xx - 3.0, 0.0, 1.0));
  c = mix(c, uLab[5], clamp(xx - 4.0, 0.0, 1.0));
  return c;
}

vec3 paletteLab(float t) {
  float x = pow(clamp(0.5 + 0.5 * cos(TAU * t), 0.0, 1.0), uBalance);
  vec3 lab = labRamp(x);
  float ang = TAU * (t * 2.0 + 0.123);
  lab.yz += 0.17 * uChroma * length(lab.yz) * vec2(sin(ang), cos(ang * 1.37 + 1.1));
  /* Cap to roughly the sRGB chroma ceiling. Scaling a/b keeps the hue angle;
     overshooting and clamping RGB later posterises into flat patches. */
  float ch = length(lab.yz);
  if (ch > 0.33) { lab.yz *= 0.33 / ch; }
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

  /* Silhouette wobble. Integer harmonics of the angle keep it continuous all
     the way round; integer multiples of the phase keep it periodic in time.
     Faded in with radius so the rim deforms like a drop while the core stays
     put — which also keeps it away from atan()'s singularity at the centre. */
  if (uWobble > 0.0) {
    float r0 = length(uv);
    float th = atan(uv.y, uv.x + 1e-6);
    // Optional Soundi contour controls; disabled by the Bloom default.
    float k = floor(uWaves), f = fract(uWaves);
    float primary = mix(sin(k * th + uContourPhase),
                        sin((k + 1.0) * th + uContourPhase), f);
    float detail = 0.45 * sin(5.0 * th - uContourPhase * 1.31)
                 + 0.25 * sin(7.0 * th + uContourPhase * 0.73);
    float wob = primary * 0.70 + detail * uIrregularity;
    float breathing = sin(uContourPhase * 0.67) * uBreath * 0.018;
    uv /= 1.0 + (uWobble * 0.055 * wob + breathing) * smoothstep(0.0, 0.6, r0);
  }

  float r = length(uv);
  vec2 pd = uv / max(r, 1.0);
  float z = sqrt(max(1.0 - dot(pd, pd), 0.0));
  vec3 n = vec3(pd, z);

  /* Domain warping. The base fBm is static; all the motion comes from warping
     its input through the looping flow field, and nesting a second warp is
     what turns smooth blobs into marbled, ink-in-water flow. */
  vec2 p0 = (pd - n.xy * uRefract) * uScaleN;
  vec2 p1 = p0 + uFlow * flowField(p0);
  vec2 p2 = p1 + uTurb * flowField(p1 * 1.7 + 5.2);
  float t = mix(0.5, fbm(p2 + 3.7), 1.35) + uShift;

  float fres3 = pow(1.0 - n.z, 3.0);
  vec3 lab = iridesce(paletteLab(t), fres3);

  vec3 base;
  if (uAberr > 0.001) {
    // Dispersion: the palette lookup shifts per channel, strongest at the rim.
    float d = uAberr * 0.05 * r * r;
    base = vec3(oklabToLinear(iridesce(paletteLab(t - d), fres3)).r,
                oklabToLinear(lab).g,
                oklabToLinear(iridesce(paletteLab(t + d), fres3)).b);
  } else {
    base = oklabToLinear(lab);
  }
  base = max(base, 0.0);

  // Lighting is added in linear light, which is where it belongs.
  vec3 L = normalize(uLight);
  vec3 col = mix(base, vec3(clamp(dot(n, L), 0.0, 1.0)), uShading);

  // Internal scatter offset away from the highlight: a translucent body rather
  // than a lit opaque ball.
  vec2 op = pd + L.xy * 0.45;
  col += uInner * exp(-dot(op, op) * 2.2) * base;

  // Retain upstream rim light, omit the fixed specular highlight.
  col += pow(1.0 - n.z, 8.0) * uRim;

  // Compress only highlights before the sRGB clamp; one shared scale keeps
  // the channel ratios intact instead of clipping each colour to white.
  float peak = max(max(col.r, col.g), col.b);
  if (peak > 0.72) {
    float shoulder = 0.72 + 0.24 * (1.0 - exp(-(peak - 0.72) / 0.24));
    col *= mix(1.0, shoulder / peak, uHighlightCompression);
  }
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
  float alpha = clamp(body * uOpacity + glowF * (1.0 - body), 0.0, 1.0);

  vec3 outCol = mix(flat_, lit, body);

  // Grain plus an always-on deband dither, stepped to 24 frames per loop so it
  // animates without breaking the seam.
  int frame = int(uPhase / TAU * 24.0);
  outCol += (rand3(ivec3(ivec2(gl_FragCoord.xy), frame)) - 0.5)
          * (uGrain * 0.1 + 1.0 / 255.0);

  outCol = clamp(outCol, 0.0, 1.0);
  fragColor = vec4(outCol * alpha, alpha);   // premultiplied
}`;


// Upstream Bloom preset + upstream defaults. Only specular is disabled.
export const ORB_DEFAULTS = Object.freeze({
  blobScale:4.6, flow:0.15, turbulence:0.3, shift:0.23, balance:0.5,
  chroma:1, contrast:1, duration:6, grain:0.17,
  rim:2, specular:0, inner:0, shading:0.05,
  refraction:0.16, iridescence:0, aberration:0.8,
  softness:0.005, wobble:0, waves:3, irregularity:0.2,
  contourSpeed:0.9, breath:0, opacity:1, highlightCompression:0, paused:false
});
const BOUNDS={
  highlightCompression:[0,1],
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
    for(const name of ['uRes','uPhase','uLab[0]','uCount','uScaleN','uFlow','uTurb','uShift','uBalance','uChroma','uContrast','uRim','uSpec','uInner','uShading','uRefract','uIrid','uAberr','uGrain','uSoft','uWobble','uGlow','uLight','uContourPhase','uWaves','uIrregularity','uBreath','uDark','uOpacity','uHighlightCompression'])uniforms[name]=gl.getUniformLocation(program,name);
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
    gl.uniform3fv(uniforms['uLab[0]'],labs);gl.uniform3f(uniforms.uLight,-0.6,-1,0.65);
    set('uCount',count);set('uPhase',phase);set('uContourPhase',contourPhase);
    set('uScaleN',1.45/current.blobScale);set('uBalance',5**((0.5-current.balance)*2));
    const mapping={flow:'uFlow',turbulence:'uTurb',shift:'uShift',chroma:'uChroma',contrast:'uContrast',rim:'uRim',specular:'uSpec',inner:'uInner',shading:'uShading',refraction:'uRefract',iridescence:'uIrid',aberration:'uAberr',grain:'uGrain',softness:'uSoft',wobble:'uWobble',waves:'uWaves',irregularity:'uIrregularity',breath:'uBreath',opacity:'uOpacity',highlightCompression:'uHighlightCompression'};
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
      auto={...ORB_DEFAULTS,duration:20-e*10,wobble:0.04+e*0.06+t*0.04,
        contourSpeed:0.4+e*1.2,waves:2.4+t*2.6,irregularity:0.15+t*0.65,
        turbulence:0.35+t*0.3,flow:0.85+e*0.4,breath:0.04+e*0.08};
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
