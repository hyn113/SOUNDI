(function (root) {
  const schedules = {
    chordMajor3: [.18,.18,.18,.45], chordMinor3: [.18,.18,.18,.18,.18,.45],
    chordPerfect5: [.9,.2], chordSus2: [.18,.18,.45,.45],
    chordSus4: [.45,.18,.18,.45], chordMajor7: [.45,.45], chordTension: [.18,.18]
  };
  // Older iPhone builds only decode these four pattern names. Preserve the new
  // chord envelopes as contiguous sustained segments instead of failing decoding.
  function nativeEvents(events) {
    return events.flatMap(event => {
      const schedule = schedules[event.pattern];
      if (!schedule) return [{...event, pattern: ['sustained','slowWave','finePulse','densePulse'].includes(event.pattern) ? event.pattern : 'sustained'}];
      const result = [];
      let elapsed = 0, index = 0;
      while (elapsed < event.duration - 1e-8) {
        const duration = Math.min(schedule[index % schedule.length], event.duration - elapsed);
        result.push({...event, pattern: 'sustained', startTime: event.startTime + elapsed,
          duration, intensity: event.intensity * (index % 2 ? .65 : .85)});
        elapsed += duration;
        index++;
      }
      return result;
    });
  }
  let timer = null;
  function handler() { return root.webkit?.messageHandlers?.soundiHaptics; }
  function stop() {
    if (timer !== null) { root.clearInterval(timer); timer = null; }
    if (handler()) { handler().postMessage({type:'stop'}); return true; }
    if (typeof root.navigator?.vibrate === 'function') { root.navigator.vibrate(0); return true; }
    return false;
  }
  function play(events, startAt, visual) {
    stop();
    if (handler()) {
      handler().postMessage({type:'play', events:nativeEvents(events), startAt, visual});
      return true;
    }
    if (typeof root.navigator?.vibrate !== 'function') return false;
    // Browser vibration has no intensity control. Follow note timing and rests;
    // never claim that it reproduces the native strong/weak chord envelopes.
    const origin = Number.isFinite(startAt) ? startAt : Date.now()/1000;
    const end = Math.max(0,...events.map(e=>e.startTime+e.duration));
    const tick = () => {
      const elapsed = Date.now()/1000-origin;
      if (elapsed >= end) { stop(); return; }
      const active = events.find(e=>e.intensity>0 && elapsed>=e.startTime && elapsed<e.startTime+e.duration);
      root.navigator.vibrate(active ? Math.max(1, Math.min(250,Math.round((active.startTime+active.duration-elapsed)*1000))) : 0);
    };
    tick();
    timer = root.setInterval(tick,100);
    return true;
  }
  const api = {nativeEvents, play, stop, get native(){return Boolean(handler());},
    get supported(){return Boolean(handler()) || typeof root.navigator?.vibrate==='function';}};
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.SoundiPhoneHaptics=api;
})(typeof window==='object' ? window : globalThis);
