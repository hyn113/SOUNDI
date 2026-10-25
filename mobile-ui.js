(() => {
  const mobile = matchMedia('(width < 768px)');
  const compactNavigation = matchMedia('(width < 1024px), (hover: none) and (pointer: coarse)');
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('primaryNavigation');
  const toggle = document.getElementById('mobileMenuToggle');
  const close = document.getElementById('mobileFeedbackClose');
  function setMenu(open, restoreFocus = false) {
    header.classList.toggle('is-menu-open', open);
    if (compactNavigation.matches) {
      document.getElementById('userMenu').hidden = !open;
      document.getElementById('themePicker').hidden = true;
      document.getElementById('themeMenuButton').setAttribute('aria-expanded', 'false');
    }
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    if (restoreFocus) toggle.focus();
  }
  function syncAccount() {
    const account = document.getElementById('userStatusArea');
    const target = compactNavigation.matches ? nav : document.body.dataset.view === 'compose'
      ? document.querySelector('.compose-publish-controls') : document.body;
    if (account && target) {
      if (compactNavigation.matches) target.prepend(account);
      else target.appendChild(account);
    }
    document.getElementById('userMenu').hidden = true;
    setMenu(false);
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => {
    if (event.target.closest('[data-view]')) setMenu(false, compactNavigation.matches);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setMenu(false);
  });
  function closeFeedback() {
    stopPlayback();
    document.getElementById('playButton').focus();
  }
  close.addEventListener('click', closeFeedback);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !compactNavigation.matches) return;
    if (mobile.matches && document.getElementById('composeView').classList.contains('is-playing')) closeFeedback();
    else setMenu(false, true);
  });
  const compose = document.getElementById('composeView');
  let wasFullscreen = false;
  new MutationObserver(() => {
    const fullscreen = mobile.matches && compose.classList.contains('is-playing');
    header.inert = fullscreen;
    compose.querySelector('.controlbar').inert = fullscreen;
    if (fullscreen && !wasFullscreen) {
      setAnalysisTab('visual');
      close.focus({preventScroll:true});
    }
    wasFullscreen = fullscreen;
  }).observe(compose, {attributes:true, attributeFilter:['class']});
  mobile.addEventListener('change', () => {
    header.inert = mobile.matches && compose.classList.contains('is-playing');
    compose.querySelector('.controlbar').inert = header.inert;
    syncAccount();
  });
  compactNavigation.addEventListener('change', syncAccount);
  syncAccount();
})();
