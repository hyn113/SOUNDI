// Shared Glide Select-style highlight for choice menus and tab groups.
(() => {
  const groups = '.harmony-type-menu, .custom-select-menu, .analysis-tabs, .my-songs-tabs, .dashboard-tabs';
  const bound = new WeakSet();
  function bind(group) {
    if (bound.has(group)) return;
    bound.add(group);
    group.classList.add('glide-group');
    const isTabs = group.matches('.analysis-tabs, .my-songs-tabs, .dashboard-tabs');
    const move = (item) => {
      if (!item || !group.getClientRects().length) return;
      const box = item.getBoundingClientRect(), parent = group.getBoundingClientRect();
      group.style.setProperty('--glide-x', `${box.left-parent.left+group.scrollLeft}px`);
      group.style.setProperty('--glide-y', `${box.top-parent.top+group.scrollTop}px`);
      group.style.setProperty('--glide-w', `${box.width}px`);
      group.style.setProperty('--glide-h', `${box.height}px`);
    };
    const selected = () => move(group.querySelector('[aria-checked="true"], [aria-selected="true"], .is-active, .is-selected') || group.querySelector('button'));
    if (!isTabs) {
      group.addEventListener('pointerover', event => move(event.target.closest('button')));
      group.addEventListener('focusin', event => move(event.target.closest('button')));
    }
    group.addEventListener('pointerleave', selected);
    group.addEventListener('click', () => requestAnimationFrame(selected));
    new MutationObserver(() => requestAnimationFrame(selected)).observe(group, {subtree:true, attributes:true, childList:true, attributeFilter:['hidden','aria-selected','aria-checked','class']});
    new ResizeObserver(selected).observe(group);
    selected();
  }
  const scan = () => document.querySelectorAll(groups).forEach(bind);
  scan();
  new MutationObserver(scan).observe(document.body, {childList:true, subtree:true});
})();
