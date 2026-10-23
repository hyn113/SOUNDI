// Restrained Stardust-inspired directional dust, returning to the live orb.
export function createOrbScatter(host, source, gl, reduced) {
  const layer = document.createElement('canvas');
  layer.className = 'orb-scatter-canvas';
  layer.setAttribute('aria-hidden', 'true');
  host.append(layer);
  const ctx = layer.getContext('2d');
  const pad = 72, gap = 2.8;
  const trail = [];
  let points = [], width = 0, height = 0, dpr = 1, pixels, sampled = 0;
  let pointer = null, active = false;
  function move(e) {
    if (reduced.matches) return;
    const r = host.getBoundingClientRect();
    const x = e.clientX-r.left, y = e.clientY-r.top;
    const now = performance.now();
    const elapsed = pointer ? Math.max(16,now-pointer.time)/1000 : .016;
    const dx = pointer ? x-pointer.x : 0, dy = pointer ? y-pointer.y : 0;
    const velocity = Math.min(300,Math.hypot(dx,dy)/elapsed);
    const angle = Math.atan2(dy,dx);
    pointer = {x,y,time:now};
    if(velocity>8) {
      trail.push({x,y,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,time:now});
      if(trail.length>10)trail.shift();
    }
    active = true;
  }
  function leave() { pointer = null; }
  host.addEventListener('pointermove',move,{passive:true});
  host.addEventListener('pointerdown',move,{passive:true});
  host.addEventListener('pointerleave',leave);
  host.addEventListener('pointercancel',leave);
  const release = e=>{if(e.pointerType!=='mouse')leave();};
  host.addEventListener('pointerup',release);
  function reset() {
    active = false; points = []; pointer = null; trail.length = 0;
    source.style.opacity = ''; layer.style.display = 'none';
  }
  function render(dt, now) {
    if (!active || reduced.matches) { if(active)reset(); return; }
    const r = host.getBoundingClientRect();
    const ratio = source.width/r.width;
    if(width!==r.width || height!==r.height || dpr!==ratio) {
      width=r.width; height=r.height; dpr=ratio;
      layer.width=Math.round((width+pad*2)*dpr); layer.height=Math.round((height+pad*2)*dpr);
      layer.style.width=`${width+pad*2}px`; layer.style.height=`${height+pad*2}px`;
      pixels=new Uint8Array(source.width*source.height*4); points=[]; sampled=0;
    }
    if(now-sampled>100 || !points.length) {
      gl.readPixels(0,0,source.width,source.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      sampled=now;
      if(!points.length) {
        for(let y=gap/2;y<height;y+=gap)for(let x=gap/2;x<width;x+=gap)
          points.push({ox:x,oy:y,x,y,vx:0,vy:0,seed:Math.random()*Math.PI*2,size:.5+Math.random()*.65});
      }
      for(const p of points) {
        const i=(Math.min(source.height-1,Math.floor((height-p.oy)*dpr))*source.width+Math.min(source.width-1,Math.floor(p.ox*dpr)))*4;
        p.a=pixels[i+3]/255;
        p.color=`rgb(${Math.min(255,pixels[i]/(p.a||1))},${Math.min(255,pixels[i+1]/(p.a||1))},${Math.min(255,pixels[i+2]/(p.a||1))})`;
      }
    }
    ctx.setTransform(dpr,0,0,dpr,pad*dpr,pad*dpr);
    ctx.clearRect(-pad,-pad,width+pad*2,height+pad*2);
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    ctx.drawImage(source,0,0,width,height);
    const step=Math.min(dt,.025), radius=Math.min(58,width*.18);
    while(trail.length && now-trail[0].time>700)trail.shift();
    let unsettled=false;
    for(const p of points) {
      const spring=24+8*Math.sin(p.seed);
      let ax=(p.ox-p.x)*spring, ay=(p.oy-p.y)*spring;
      if(p.a>.05) {
        // Small eddies travel with the hand, instead of pushing a circular hole.
        for(const t of trail) {
          const dx=p.ox-t.x,dy=p.oy-t.y,dist=Math.hypot(dx,dy);
          if(dist>=radius)continue;
          const weight=(1-dist/radius)**2*Math.exp(-(now-t.time)/180)/Math.sqrt(trail.length);
          const curl=Math.sin(p.seed+now*.0018+dist*.035);
          ax+=(t.vx*5-t.vy*curl*1.3)*weight;
          ay+=(t.vy*5+t.vx*curl*1.3-65)*weight;
        }
        if(pointer) {
          const dx=p.ox-pointer.x,dy=p.oy-pointer.y,dist=Math.hypot(dx,dy);
          const weight=Math.max(0,1-dist/radius)**3;
          ax+=Math.cos(p.seed+now*.001)*110*weight;
          ay+=Math.sin(p.seed+now*.001)*110*weight;
        }
      }
      p.vx=(p.vx+ax*step)*Math.exp(-7*step); p.vy=(p.vy+ay*step)*Math.exp(-7*step);
      p.x+=p.vx*step; p.y+=p.vy*step;
      const distance=Math.hypot(p.x-p.ox,p.y-p.oy);
      if(distance>32) {
        p.x=p.ox+(p.x-p.ox)*32/distance; p.y=p.oy+(p.y-p.oy)*32/distance;
        p.vx*=.7;p.vy*=.7;
      }
      p.mix=Math.min(1,distance/7);
      if(p.mix>.015 || Math.hypot(p.vx,p.vy)>.2)unsettled=true;
    }
    // Retain the soft coloured surface beneath the dust; never punch a hole.
    ctx.globalCompositeOperation='destination-out';
    for(const p of points)if(p.mix>.01 && p.a>.02) {
      ctx.globalAlpha=p.mix*.28; ctx.fillRect(p.ox-gap/2-.15,p.oy-gap/2-.15,gap+.3,gap+.3);
    }
    ctx.globalCompositeOperation='source-over';
    for(const p of points)if(p.mix>.01 && p.a>.02) {
      ctx.globalAlpha=p.a*p.mix*.8; ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    source.style.opacity='0'; layer.style.display='block';
    if(!pointer && !unsettled)reset();
  }
  return {render,get active(){return active;},reset,dispose(){
    host.removeEventListener('pointermove',move);host.removeEventListener('pointerdown',move);
    host.removeEventListener('pointerleave',leave);host.removeEventListener('pointercancel',leave);
    host.removeEventListener('pointerup',release);
    reset();layer.remove();
  }};
}
