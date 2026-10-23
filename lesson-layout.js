/* Reuse the live lesson graphics and their event handlers; never clone IDs. */
(() => {
  const compact = matchMedia('(width < 1024px)');
  const mobile = matchMedia('(width < 768px)');
  const mobileWheel = matchMedia('(width < 640px)');
  const conciseCopy = {
    ko: ['음마다 색이 달라요. 같은 음은 같은 색이에요.', '한 블록은 한 박자예요. 이어 붙이면 긴 음이 돼요.', '같은 세로선에 블록을 놓으면 화음이 돼요.', '곡의 분위기를 색과 움직임으로 만나보세요.'],
    en: ['Each note has a colour. The same note keeps its colour.', 'One block, one beat. Join blocks for longer notes.', 'Stack notes in one column to make a chord.', 'See the mood of your music in colour and motion.']
  };
  const stage = document.querySelector('.lesson-stage');
  const menu = stage.querySelector('.lesson-menu');
  const order = ['pitch', 'rhythmLength', 'colorHarmony', 'feedback'];
  const selectors = ['.lesson-color-demo', '.lesson-rhythm-demo', '.lesson-harmony-demo', '.lesson-feedback-demo'];
  const labels = { ko: ['음계', '리듬', '화음', '분위기'], en: ['Notes', 'Rhythm', 'Harmony', 'Mood'] };
  const scroller = document.createElement('div');
  scroller.className = 'lesson-snap-scroll';
  scroller.setAttribute('aria-label', 'Lessons');
  scroller.tabIndex = 0;
  const items = order.map((track, i) => {
    const graphic = stage.querySelector(selectors[i]);
    const home = document.createComment(`lesson ${track} original position`);
    graphic.before(home);
    const section = document.createElement('section');
    section.className = 'lesson-snap-section';
    section.dataset.track = track;
    section.innerHTML = `<h2 id="lesson-heading-${track}"></h2><div class="lesson-preview-card"><div class="lesson-snap-graphic"></div><p class="lesson-snap-copy"></p></div>`;
    if (track === 'colorHarmony') section.append(section.querySelector('.lesson-snap-copy'));
    section.setAttribute('aria-labelledby', `lesson-heading-${track}`);
    scroller.append(section);
    const button = menu.querySelector(`[data-lesson-track="${track}"]`);
    const short = document.createElement('span');
    short.className = 'lesson-short-label';
    button.append(short);
    button.setAttribute('aria-controls', `lesson-heading-${track}`);
    return { track, graphic, home, section, button, short };
  });
  const harmonySection = items.find(item => item.track === 'colorHarmony').section;
  const harmonyDemo = harmonySection.querySelector('.lesson-harmony-demo') || stage.querySelector('.lesson-harmony-demo');
  const harmonyCards = [...harmonyDemo.querySelectorAll('.harmony-card')];
  const shortHarmony = {
    ko: ['도·미·솔이 만드는 밝고 편안한 화음이에요.', '레·파·라가 만드는 차분한 화음이에요.', '미·라·시가 만드는 긴장감 있는 화음이에요.', '파·도 두 음이 만드는 단단하고 열린 화음이에요.', '기본 화음에 한 음을 더해 섬세한 분위기를 만들어요.', '높은 음을 더해 넓고 풍부한 느낌을 만들어요.'],
    en: ['C, E and G make a bright, restful chord.', 'D, F and A make a calm chord.', 'E, A and B create a sense of suspense.', 'F and C make a strong, open sound.', 'One extra note gives the chord a delicate mood.', 'A higher note adds space and richness.']
  };
  harmonyCards.forEach(card => {
    const text = document.createElement('strong');
    text.className = 'harmony-mobile-copy';
    card.querySelector('.harmony-card-copy').append(text);
  });
  // Depth rail and curved picker share a continuous position, so dragging either
  // moves the cards and labels together. Reference: React Bits Depth Carousel / Option Wheel.
  const swipeSurface = harmonySection.querySelector('.lesson-preview-card');
  harmonySection.classList.add('has-depth-carousel');
  const toolbar = harmonyDemo.querySelector('.harmony-toolbar');
  if (toolbar) harmonySection.append(toolbar);
  swipeSurface.tabIndex = 0;
  swipeSurface.setAttribute('role', 'group');
  swipeSurface.setAttribute('aria-label', '화음 카드 · 좌우 방향키로 이동');
  const dial = document.createElement('div');
  dial.className = 'harmony-dial option-wheel';
  dial.setAttribute('role', 'listbox');
  dial.setAttribute('aria-label', '화음 선택 · 스크롤 또는 방향키로 이동');
  dial.tabIndex = 0;
  swipeSurface.after(dial);
  const count = document.createElement('span');
  count.className = 'harmony-dial-output';
  count.setAttribute('aria-live', 'polite');
  harmonySection.append(count);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let cardIndex = 0, position = 0, motionFrame = 0, wheelTimer = 0, wrapTarget = null;
  let available = [], wheelButtons = [], drag = null, suppressClick = false;
  const wrap = value => (value % available.length + available.length) % available.length;
  function paint() {
    available.forEach((card, i) => {
      let offset = i - position;
      if (wrapTarget === available.length && i === 0) offset = available.length-position;
      if (wrapTarget === -1 && i === available.length-1) offset = -1-position;
      const back = Math.max(0, offset);
      const opacity = offset < 0 ? Math.max(0, 1+offset) : Math.max(0, Math.min(1, 4-offset));
      card.style.transform = `translateX(${90*offset}px) translateZ(${-220*offset}px) rotateY(${22*Math.min(1,back)}deg)`;
      card.style.opacity = opacity;
      card.style.filter = `blur(${Math.min(6, back*1.5)}px)`;
      card.style.zIndex = String(Math.round(2000-offset*20));
      card.style.setProperty('--card-depth', Math.min(1,back/4));
      card.style.pointerEvents = i === cardIndex ? 'auto' : 'none';
    });
    wheelButtons.forEach((button, i) => {
      const distance = i-position;
      const angle = distance * .25;
      const x = (1-Math.cos(Math.min(Math.abs(angle),1.5))) * 95;
      const y = Math.sin(Math.max(-1.5,Math.min(1.5,angle))) * (mobileWheel.matches ? 104 : 172);
      button.style.transform = `translate(${x}px, ${y}px) rotate(${distance * -6}deg)`;
      button.style.opacity = Math.max(0,1-Math.abs(distance)*.24);
      button.style.filter = `blur(${Math.min(2, Math.abs(distance)*.4)}px)`;
      button.style.visibility = Math.abs(distance) > 3.5 ? 'hidden' : 'visible';
      button.setAttribute('aria-selected', String(i===cardIndex));
    });
  }
  function announce() {
    available.forEach((card,i) => {
      card.classList.toggle('is-dial-active', i===cardIndex);
      card.inert = i!==cardIndex;
      card.setAttribute('aria-hidden', String(i!==cardIndex));
    });
    dial.setAttribute('aria-activedescendant', `harmony-option-${cardIndex}`);
    count.textContent = `${cardIndex+1} / ${available.length}`;
  }
  function select(rawIndex, animate = true) {
    cancelAnimationFrame(motionFrame);
    clearTimeout(wheelTimer);
    const target = Math.max(-1,Math.min(available.length,rawIndex));
    cardIndex = wrap(target);
    wrapTarget = target < 0 || target >= available.length ? target : null;
    announce();
    const from = position, start = performance.now();
    const duration = animate && !reducedMotion.matches ? 700 : 0;
    const step = now => {
      const progress = duration ? Math.min(1,(now-start)/duration) : 1;
      position = from+(target-from)*(1-Math.pow(1-progress,4));
      paint();
      if (progress < 1) motionFrame = requestAnimationFrame(step);
      else { position = cardIndex; wrapTarget = null; paint(); }
    };
    motionFrame = requestAnimationFrame(step);
  }
  function renderDial() {
    cancelAnimationFrame(motionFrame);
    clearTimeout(wheelTimer);
    available = compact.matches ? harmonyCards : harmonyCards.filter(card => !card.classList.contains('is-tension-card') || harmonyDemo.classList.contains('has-tension'));
    cardIndex = Math.min(cardIndex,available.length-1);
    position = cardIndex; wrapTarget = null;
    harmonyCards.forEach(card => { card.hidden = !available.includes(card); card.inert = true; });
    dial.replaceChildren();
    wheelButtons = available.map((card,i) => {
      const button = document.createElement('button');
      button.type = 'button'; button.tabIndex = -1;
      button.id = `harmony-option-${i}`;
      button.setAttribute('role','option');
      button.textContent = card.querySelector('.harmony-card-name').textContent;
      button.addEventListener('click', () => { if (!suppressClick) select(i); });
      dial.append(button);
      return button;
    });
    announce(); paint();
  }
  [swipeSurface,dial].forEach(surface => {
    const isWheel = surface === dial;
    surface.addEventListener('keydown', event => {
      let target;
      if (['ArrowRight','ArrowDown'].includes(event.key)) target=cardIndex+1;
      if (['ArrowLeft','ArrowUp'].includes(event.key)) target=cardIndex-1;
      if (event.key==='Home') target=0;
      if (event.key==='End') target=available.length-1;
      if (target===undefined) return;
      event.preventDefault(); select(target);
    });
    surface.addEventListener('wheel', event => {
      // Vertical scrolling outside the picker remains lesson navigation.
      if (!isWheel && Math.abs(event.deltaY)>=Math.abs(event.deltaX)) return;
      event.preventDefault(); cancelAnimationFrame(motionFrame);
      const delta = Math.abs(event.deltaY)>Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      position = Math.max(-.8, Math.min(available.length-.2, position+Math.max(-.4,Math.min(.4,delta*(event.deltaMode===1?16:1)/220))));
      wrapTarget = position < 0 ? -1 : position > available.length-1 ? available.length : null;
      paint(); clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => select(Math.round(position)),130);
    }, {passive:false});
    surface.addEventListener('pointerdown', event => {
      if (event.button!==0) return;
      cancelAnimationFrame(motionFrame); clearTimeout(wheelTimer);
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:position,moved:false};
      suppressClick=false;
    });
    surface.addEventListener('pointermove', event => {
      if (!drag || drag.id!==event.pointerId) return;
      const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
      if (!isWheel && !drag.moved && Math.abs(dy)>Math.abs(dx)+8) { drag=null; return; }
      const delta=isWheel ? -dy/(mobileWheel.matches?30:45) : dx/Math.max(80,swipeSurface.clientWidth*.55);
      if (Math.abs(delta)>.06) { drag.moved=true; surface.setPointerCapture(event.pointerId); }
      if (!drag.moved) return;
      position=Math.max(-.85,Math.min(available.length-.15,drag.start+delta));
      wrapTarget=position<0?-1:position>available.length-1?available.length:null;
      paint();
    });
    function end(event) {
      if (!drag || drag.id!==event.pointerId) return;
      suppressClick=drag.moved;
      select(event.type==='pointercancel'?cardIndex:Math.round(position));
      drag=null;
      setTimeout(()=>{suppressClick=false;},0);
    }
    surface.addEventListener('pointerup',end);
    surface.addEventListener('pointercancel',end);
  });
  new MutationObserver(renderDial).observe(harmonyDemo,{attributes:true,attributeFilter:['class']});
  compact.addEventListener('change',renderDial);
  mobile.addEventListener('change',paint);
  mobileWheel.addEventListener('change',paint);
  new MutationObserver(renderDial).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  renderDial();
  stage.prepend(scroller);
  let fromScroll = false;
  let frame = 0;
  function copy() {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
    harmonyCards.forEach((card, i) => card.querySelector('.harmony-mobile-copy').textContent = shortHarmony[lang][i]);
    items.forEach((item, i) => {
      const data = lessonTracks[item.track];
      item.section.querySelector('h2').textContent = `${String(i + 1).padStart(2, '0')} ${data.title[lang]}`;
      item.section.querySelector('.lesson-snap-copy').textContent = mobile.matches ? conciseCopy[lang][i] : data.text[lang];
      item.short.textContent = labels[lang][i];
      item.button.setAttribute('aria-current', String(item.track === lessonTrack));
    });
    renderDial();
  }
  function scrollToTrack(behavior = 'auto') {
    if (!scroller.clientHeight) return;
    scroller.scrollTo({ top: order.indexOf(lessonTrack) * scroller.clientHeight, behavior });
  }
  function layout() {
    stage.classList.add('has-snap-lessons');
    items.forEach(item => {
      item.section.querySelector('.lesson-snap-graphic').append(item.graphic);
    });
    copy();
    requestAnimationFrame(() => scrollToTrack());
  }
  menu.addEventListener('click', event => {
    const button = event.target.closest('[data-lesson-track]');
    if (!button) return;
    event.stopImmediatePropagation();
    fromScroll = true;
    setLessonTrack(button.dataset.lessonTrack);
    fromScroll = false;
    // An immediate snap avoids activating intermediate chapters during tab jumps.
    scrollToTrack();
  }, true);
  scroller.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!scroller.clientHeight) return;
      const index = Math.max(0, Math.min(3, Math.round(scroller.scrollTop / scroller.clientHeight)));
      if (lessonTrack !== order[index]) {
        fromScroll = true;
        setLessonTrack(order[index]);
        fromScroll = false;
      }
    });
  }, { passive: true });
  document.addEventListener('soundi:lessonchange', () => {
    copy();
    if (!fromScroll) scrollToTrack();
  });
  new MutationObserver(copy).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  new ResizeObserver(() => scrollToTrack()).observe(scroller);
  compact.addEventListener('change', layout);
  mobile.addEventListener('change', copy);
  layout();
})();
