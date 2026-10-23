(function initSoundiMoodAI(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SoundiMoodAI = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function createSoundiMoodAI() {
  const MOODS = ['bright', 'playful', 'ascending', 'airy', 'warm', 'sparse', 'dreamy', 'moon', 'deep', 'layered'];
  const MIN_NOTES_FOR_MOOD = 4;
  const LONG_STEP = 4;
  const SHORT_STEP = 1.5;
  const TENSION_INTERVALS = new Set([1, 2, 6, 10, 11]);
  const CONSONANT_INTERVALS = new Set([0, 3, 4, 5, 7, 8, 9, 12]);

  const moodMeta = {
    bright: { label: { ko: '밝음', en: 'Bright' }, color: '#ffd92f', palette: ['#ffe03d', '#a6f05a', '#ff8a24', '#fff7b8'] },
    playful: { label: { ko: '경쾌함', en: 'Playful' }, color: '#ffcf2f', palette: ['#ffe44d', '#76d9ff', '#99ef6d', '#ff8f7a'] },
    ascending: { label: { ko: '상승감', en: 'Ascending' }, color: '#82d8ff', palette: ['#7fdcff', '#99ef76', '#fff15a', '#eaffc7'] },
    airy: { label: { ko: '공기감', en: 'Airy' }, color: '#aeefff', palette: ['#c7f3ff', '#a9f2df', '#ffffff', '#eafcff'] },
    warm: { label: { ko: '따뜻함', en: 'Warm' }, color: '#ff9d2e', palette: ['#ff9a30', '#ff806d', '#ffe057', '#5fcf76'] },
    sparse: { label: { ko: '여백감', en: 'Sparse' }, color: '#d8e6e0', palette: ['#eeeeee', '#bfe7d8', '#ffd8c2', '#f8f8f8'] },
    dreamy: { label: { ko: '몽환적', en: 'Dreamy' }, color: '#b9a7ff', palette: ['#c7b7ff', '#a8efff', '#c7f2b2', '#f3eeff'] },
    moon: { label: { ko: '푸른 밤', en: 'Moon' }, color: '#6f9fe7', palette: ['#5f95e8', '#b7a7ee', '#d8e8ff', '#eef2ff'] },
    deep: { label: { ko: '깊음', en: 'Deep' }, color: '#344866', palette: ['#1f3f78', '#70659b', '#6f8797', '#d9e1ea'] },
    layered: { label: { ko: '겹쳐짐', en: 'Layered' }, color: '#8cbcff', palette: ['#8bd5ff', '#a184ff', '#ffd966', '#e8f5ff'] }
  };

  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  function safeDivide(value, total) {
    return total ? value / total : 0;
  }

  function average(values, fallback = 0) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
  }

  function normalizeInput(composition, notes, options = {}) {
    const noteMap = new Map((Array.isArray(notes) ? notes : []).map((note) => [note.id, note]));
    const stepCount = Math.max(1, Number(options.stepCount) || 64);
    const items = (Array.isArray(composition) ? composition : [])
      .map((item) => {
        const note = noteMap.get(item?.noteId);
        const step = Number(item?.step);
        if (!note || !Number.isFinite(step)) return null;
        const accidental = Number.isFinite(item.accidental) ? item.accidental : 0;
        return {
          id: item.id || `${item.noteId}-${step}`,
          noteId: item.noteId,
          key: note.key,
          octave: note.octave,
          step: Math.max(0, Math.round(step)),
          midi: (Number(note.midi) || 0) + accidental,
          accidental
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.step - b.step || b.midi - a.midi);
    return { items, stepCount };
  }

  function getSustainStarts(items, stepCount) {
    const occupied = new Set(items.map((item) => `${item.noteId}:${item.step}`));
    return items
      .filter((item) => !occupied.has(`${item.noteId}:${item.step - 1}`))
      .map((item) => {
        let duration = 1;
        while (item.step + duration < stepCount && occupied.has(`${item.noteId}:${item.step + duration}`)) {
          duration += 1;
        }
        return { ...item, duration };
      });
  }

  function getStepCenters(starts) {
    const grouped = new Map();
    starts.forEach((item) => {
      if (!grouped.has(item.step)) grouped.set(item.step, []);
      grouped.get(item.step).push(item.midi);
    });
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([step, midis]) => ({ step, pitch: average(midis) }));
  }

  function countRepeatedRhythmPatterns(activeSteps) {
    if (activeSteps.length < 6) return 0;
    const gaps = activeSteps.slice(1).map((step, index) => Math.min(8, step - activeSteps[index]));
    const counts = new Map();
    for (let index = 0; index <= gaps.length - 3; index += 1) {
      const key = gaps.slice(index, index + 3).join('-');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const max = Math.max(0, ...counts.values());
    return clamp01((max - 1) / 4);
  }

  function getHarmonyTraits(starts) {
    const byStep = new Map();
    starts.forEach((item) => {
      if (!byStep.has(item.step)) byStep.set(item.step, []);
      byStep.get(item.step).push(item.midi);
    });
    let majorThirds = 0;
    let minorThirds = 0;
    let tensePairs = 0;
    let totalPairs = 0;
    let consonantPairs = 0;
    byStep.forEach((midis) => {
      for (let i = 0; i < midis.length; i += 1) {
        for (let j = i + 1; j < midis.length; j += 1) {
          const interval = Math.abs(midis[j] - midis[i]) % 12;
          totalPairs += 1;
          if (interval === 4 || interval === 8) majorThirds += 1;
          if (interval === 3 || interval === 9) minorThirds += 1;
          if (TENSION_INTERVALS.has(interval)) tensePairs += 1;
          if (CONSONANT_INTERVALS.has(interval)) consonantPairs += 1;
        }
      }
    });
    return {
      majorTendency: safeDivide(majorThirds, majorThirds + minorThirds),
      minorTendency: safeDivide(minorThirds, majorThirds + minorThirds),
      dissonance: clamp01(safeDivide(tensePairs, Math.max(1, totalPairs)) * 1.25),
      consonance: safeDivide(consonantPairs, Math.max(1, totalPairs)),
      chordRatio: safeDivide([...byStep.values()].filter((midis) => midis.length >= 2).length, Math.max(1, byStep.size))
    };
  }

  function extractMusicFeatures(composition, notes, options = {}) {
    const { items, stepCount } = normalizeInput(composition, notes, options);
    const starts = getSustainStarts(items, stepCount);
    const noteCount = starts.length;
    const activeSteps = [...new Set(starts.map((item) => item.step))].sort((a, b) => a - b);
    const midis = starts.map((item) => item.midi);
    const minMidi = midis.length ? Math.min(...midis) : 48;
    const maxMidi = midis.length ? Math.max(...midis) : 84;
    const pitchSpan = Math.max(1, options.maxMidi ? options.maxMidi - (options.minMidi || 0) : 84);
    const averageMidi = average(midis, 60);
    const pitchValues = (Array.isArray(notes) ? notes : []).map((note) => Number(note.midi)).filter(Number.isFinite);
    const globalMin = pitchValues.length ? Math.min(...pitchValues) : 24;
    const globalMax = pitchValues.length ? Math.max(...pitchValues) : 108;
    const globalSpan = Math.max(1, globalMax - globalMin);
    const durations = starts.map((item) => item.duration);
    const longRatio = safeDivide(durations.filter((duration) => duration >= LONG_STEP).length, noteCount);
    const shortRatio = safeDivide(durations.filter((duration) => duration <= SHORT_STEP).length, noteCount);
    const highThreshold = globalMin + globalSpan * 0.66;
    const lowThreshold = globalMin + globalSpan * 0.34;
    const centers = getStepCenters(starts);
    const pitchDiffs = centers.slice(1).map((current, index) => current.pitch - centers[index].pitch);
    const intervals = pitchDiffs.map(Math.abs);
    const gaps = activeSteps.slice(1).map((step, index) => step - activeSteps[index]);
    const pitchClasses = starts.map((item) => ((item.midi % 12) + 12) % 12);
    const pitchClassCounts = pitchClasses.reduce((map, pitchClass) => map.set(pitchClass, (map.get(pitchClass) || 0) + 1), new Map());
    const maxPitchClassCount = Math.max(0, ...pitchClassCounts.values());
    const repeatedRhythm = countRepeatedRhythmPatterns(activeSteps);
    const harmony = getHarmonyTraits(starts);
    const firstStep = activeSteps[0] || 0;
    const lastEnd = starts.reduce((max, item) => Math.max(max, item.step + item.duration), 0);
    const usedSteps = Math.max(1, lastEnd - firstStep);
    const occupiedSteps = new Set();
    starts.forEach((item) => {
      for (let step = item.step; step < item.step + item.duration; step += 1) occupiedSteps.add(step);
    });
    const contourChange = centers.slice(1).reduce((sum, current, index) => {
      const previousDirection = index > 0 ? Math.sign(centers[index].pitch - centers[index - 1].pitch) : 0;
      const direction = Math.sign(current.pitch - centers[index].pitch);
      return sum + (previousDirection && direction && previousDirection !== direction ? 1 : 0);
    }, 0);

    return {
      noteCount,
      blockCount: items.length,
      stepCount,
      activeStepCount: activeSteps.length,
      averagePitch: clamp01((averageMidi - globalMin) / globalSpan),
      highRatio: safeDivide(midis.filter((midi) => midi >= highThreshold).length, noteCount),
      lowRatio: safeDivide(midis.filter((midi) => midi <= lowThreshold).length, noteCount),
      pitchRange: clamp01((maxMidi - minMidi) / pitchSpan),
      noteDensity: clamp01(noteCount / Math.max(8, stepCount * 0.55)),
      rhythmicDensity: clamp01(activeSteps.length / Math.max(8, stepCount * 0.5)),
      longNoteRatio: longRatio,
      shortNoteRatio: shortRatio,
      restRatio: clamp01(1 - safeDivide(occupiedSteps.size, usedSteps)),
      repetitionStrength: clamp01(Math.max(safeDivide(maxPitchClassCount, noteCount), repeatedRhythm) * 1.2),
      ascendingRatio: safeDivide(pitchDiffs.filter((diff) => diff > 0.1).length, pitchDiffs.length),
      descendingRatio: safeDivide(pitchDiffs.filter((diff) => diff < -0.1).length, pitchDiffs.length),
      averageInterval: clamp01(average(intervals, 0) / 12),
      rhythmVariation: clamp01(average(gaps.slice(1).map((gap, index) => Math.abs(gap - gaps[index])), 0) / 6),
      majorTendency: harmony.majorTendency,
      minorTendency: harmony.minorTendency,
      dissonance: harmony.dissonance,
      tension: clamp01(harmony.dissonance * 0.65 + average(intervals, 0) / 18 * 0.25 + safeDivide(starts.filter((item) => item.accidental !== 0).length, noteCount) * 0.1),
      chordRatio: harmony.chordRatio,
      overallChange: clamp01((average(intervals, 0) / 12) * 0.36 + clamp01(contourChange / 6) * 0.24 + clamp01(average(gaps, 0) / 8) * 0.14 + clamp01((maxMidi - minMidi) / 24) * 0.26),
      averageDuration: clamp01(average(durations, 1) / 8),
      raw: { starts, activeSteps, centers, gaps, durations }
    };
  }

  function calculateMoodScores(features) {
    const f = features || extractMusicFeatures([], []);
    const ascent = Math.max(0, f.ascendingRatio - f.descendingRatio);
    const openHigh = f.highRatio * f.restRatio;
    const moderateDensity = 1 - Math.min(1, Math.abs(f.rhythmicDensity - 0.46) / 0.46);
    const sparseSpace = clamp01(f.restRatio * 0.72 + (1 - f.noteDensity) * 0.28);
    const layeredWidth = clamp01(f.chordRatio * 0.62 + f.pitchRange * 0.38);
    const scores = {
      bright: 0.14 + f.rhythmicDensity * 0.24 + f.repetitionStrength * 0.2 + f.shortNoteRatio * 0.16 + f.averagePitch * 0.12 + f.majorTendency * 0.08 + (1 - f.tension) * 0.06,
      playful: 0.12 + f.highRatio * 0.28 + f.shortNoteRatio * 0.26 + f.rhythmicDensity * 0.18 + f.overallChange * 0.1 + (1 - f.longNoteRatio) * 0.06,
      ascending: 0.1 + ascent * 0.46 + f.highRatio * 0.2 + f.averagePitch * 0.12 + f.overallChange * 0.08 + (1 - f.lowRatio) * 0.04,
      airy: 0.12 + openHigh * 0.34 + f.highRatio * 0.18 + f.restRatio * 0.18 + (1 - f.rhythmicDensity) * 0.12 + (1 - f.tension) * 0.06,
      warm: 0.16 + moderateDensity * 0.26 + (1 - Math.abs(f.averagePitch - 0.52)) * 0.18 + f.majorTendency * 0.14 + (1 - f.tension) * 0.12 + f.repetitionStrength * 0.06,
      sparse: 0.18 + sparseSpace * 0.38 + f.restRatio * 0.2 + (1 - f.rhythmicDensity) * 0.12 + (1 - f.noteDensity) * 0.08 + (1 - f.overallChange) * 0.04,
      dreamy: 0.14 + f.longNoteRatio * 0.24 + f.pitchRange * 0.22 + f.restRatio * 0.14 + (1 - Math.abs(f.ascendingRatio - f.descendingRatio)) * 0.1 + f.chordRatio * 0.08 + (1 - f.tension) * 0.08,
      moon: 0.14 + f.lowRatio * 0.26 + f.restRatio * 0.22 + f.longNoteRatio * 0.18 + (1 - f.rhythmicDensity) * 0.12 + (1 - f.averagePitch) * 0.08,
      deep: 0.14 + f.lowRatio * 0.3 + f.longNoteRatio * 0.24 + (1 - f.averagePitch) * 0.16 + f.minorTendency * 0.1 + f.chordRatio * 0.06,
      layered: 0.12 + layeredWidth * 0.36 + f.chordRatio * 0.28 + f.pitchRange * 0.14 + f.longNoteRatio * 0.06 + f.repetitionStrength * 0.04
    };
    return Object.fromEntries(MOODS.map((mood) => [mood, clamp01(scores[mood])]));
  }

  function selectDominantMoods(scores, features = {}) {
    const sorted = MOODS
      .map((mood) => ({ mood, score: clamp01(scores?.[mood]) }))
      .sort((a, b) => b.score - a.score);

    // Soundi V-A-T analysis values. Keep brightness/energy as compatibility aliases
    // because other UI and AI-coach code already reads those names.
    const valence = clamp01(features.averagePitch * 0.34 + features.highRatio * 0.24 + features.majorTendency * 0.18 + (1 - features.lowRatio) * 0.14 + (1 - features.tension) * 0.1);
    const arousal = clamp01(features.rhythmicDensity * 0.45 + features.shortNoteRatio * 0.25 + features.overallChange * 0.2 + features.repetitionStrength * 0.1);
    const tension = clamp01(features.tension);

    return {
      primaryMood: sorted[0]?.mood || 'warm',
      secondaryMood: sorted[1]?.mood || 'dreamy',
      primaryScore: sorted[0]?.score || 0,
      secondaryScore: sorted[1]?.score || 0,
      mixedMood: sorted[0] && sorted[1] ? Math.abs(sorted[0].score - sorted[1].score) < 0.12 : false,
      valence,
      arousal,
      tension,
      energy: arousal,
      brightness: valence
    };
  }

  function hexToRgb(hex) {
    const value = String(hex || '#0c0c0c').replace('#', '');
    const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value.padEnd(6, '0');
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('');
  }

  function mixHex(a, b, amount) {
    const from = hexToRgb(a);
    const to = hexToRgb(b);
    return rgbToHex({
      r: from.r + (to.r - from.r) * amount,
      g: from.g + (to.g - from.g) * amount,
      b: from.b + (to.b - from.b) * amount
    });
  }

  function rgbToHsl(rgb) {
    const r = clamp01(rgb.r / 255);
    const g = clamp01(rgb.g / 255);
    const b = clamp01(rgb.b / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    if (delta !== 0) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * (((b - r) / delta) + 2);
      else h = 60 * (((r - g) / delta) + 4);
    }
    if (h < 0) h += 360;
    return { h, s: clamp01(s), l: clamp01(l) };
  }

  function hslToHex(h, s, l) {
    const hue = ((Number(h) % 360) + 360) % 360;
    const sat = clamp01(s);
    const light = clamp01(l);
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = light - c / 2;
    let r = 0; let g = 0; let b = 0;
    if (hue < 60) [r, g, b] = [c, x, 0];
    else if (hue < 120) [r, g, b] = [x, c, 0];
    else if (hue < 180) [r, g, b] = [0, c, x];
    else if (hue < 240) [r, g, b] = [0, x, c];
    else if (hue < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
  }

  function bilinearMix(c00, c10, c01, c11, x, y) {
    const bottom = mixHex(c00, c10, clamp01(x));
    const top = mixHex(c01, c11, clamp01(x));
    return mixHex(bottom, top, clamp01(y));
  }

  // Research-informed V-A colour regions used by the final Soundi web feedback.
  // V low/A low: blue-purple-grey, V high/A low: green-blue-green-blue,
  // V low/A high: red-dark-red, V high/A high: yellow-orange.
  const VAT_COLOR_ANCHORS = {
    lowValenceLowArousal: '#59617A',
    highValenceLowArousal: '#58AFA7',
    lowValenceHighArousal: '#C33A3F',
    highValenceHighArousal: '#F2B53D'
  };

  function createVatPalette(valence, arousal, tension) {
    const v = clamp01(valence);
    const a = clamp01(arousal);
    const t = clamp01(tension);

    // V + A choose a continuous base hue region between the four research-informed anchors.
    const baseHex = bilinearMix(
      VAT_COLOR_ANCHORS.lowValenceLowArousal,
      VAT_COLOR_ANCHORS.highValenceLowArousal,
      VAT_COLOR_ANCHORS.lowValenceHighArousal,
      VAT_COLOR_ANCHORS.highValenceHighArousal,
      v,
      a
    );
    const base = rgbToHsl(hexToRgb(baseHex));

    // V controls brightness; A controls saturation. Ranges avoid pure white/black
    // so gradients remain visible and usable in the interface.
    const lightness = 0.28 + v * 0.50;
    const saturation = 0.20 + a * 0.72;

    // Tension changes relationships inside the palette, not the base emotional region:
    // low T keeps analogous colours; high T increases hue and lightness contrast.
    const hueSpread = 8 + t * 54;
    const lightSpread = 0.025 + t * 0.115;
    const satSpread = 0.02 + t * 0.07;
    const offsets = [-0.52, -0.12, 0.28, 0.70];
    const lightOffsets = [0.42, -0.30, 0.12, -0.52];
    const satOffsets = [-0.18, 0.20, -0.04, 0.14];

    return offsets.map((offset, index) => hslToHex(
      base.h + hueSpread * offset,
      saturation + satSpread * satOffsets[index],
      lightness + lightSpread * lightOffsets[index]
    ));
  }

  function createMoodVisualState(result) {
    const valence = clamp01(Number.isFinite(result?.valence) ? result.valence : result?.brightness);
    const arousal = clamp01(Number.isFinite(result?.arousal) ? result.arousal : result?.energy);
    const tension = clamp01(result?.tension);
    // Mood identity selects the palette. Numeric analysis changes emphasis,
    // not the global lightness or saturation of every colour.
    const primary = moodMeta[result?.primaryMood] || moodMeta.sparse;
    const secondary = moodMeta[result?.secondaryMood] || primary;
    const base = primary.palette;
    const total = (result?.primaryScore || 0) + (result?.secondaryScore || 0);
    const secondaryShare = total > 0 ? clamp01(result.secondaryScore / total) : 0;
    const blend = secondaryShare * 0.44;
    const accent = result?.primaryMood === 'dreamy' ? '#b39aee' : base[0];
    const colors = [
      mixHex(base[0], accent, tension * 0.45),
      mixHex(base[1], secondary.palette[0], blend),
      mixHex(base[2], accent, tension * 0.32),
      mixHex(base[3], secondary.palette[3], blend * 0.65)
    ];

    return {
      colors,
      gradientDuration: Math.round(15000 - arousal * 7600),
      shapeDuration: Math.round(17000 - arousal * 7200),
      pulseDuration: Math.round(4200 - arousal * 2300),
      irregularity: tension,
      focusX: `${32 + valence * 36}%`,
      focusY: `${64 - arousal * 28}%`,
      colorModel: 'mood-palette',
      paletteBlend: blend,
      vat: { valence, arousal, tension }
    };
  }

  function createStablePhraseIndex(values, count, salt = '') {
    if (!count) return 0;
    const parts = ['brightness', 'energy', 'tension', 'repetitionStrength', 'pitchRange', 'rhythmicDensity']
      .map((key) => Math.round(clamp01(values[key]) * 10));
    const key = `${salt}:${parts.join('-')}`;
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
      hash ^= key.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % count;
  }

  function pick(parts, values, salt) {
    return parts[createStablePhraseIndex(values, parts.length, salt)];
  }

  function createFeedbackSentence(result, language = 'ko') {
    if (!result || result.status !== 'ready') {
      return language === 'ko'
        ? '블록을 조금 더 놓아보세요. 곡의 흐름이 보이면 두 줄로 정리해드릴게요.'
        : 'Add a few more notes. Once the structure is clear, I will describe it in two lines.';
    }

    const f = result.features || {};
    const phraseValues = { ...f, brightness: result.brightness, energy: result.energy, tension: result.tension };

    const moodKo = {
      bright: ['밝고 활기찬 분위기의 곡이에요.', '가볍고 활발한 분위기가 두드러지는 곡이에요.', '밝은 쪽으로 움직임이 많은 곡이에요.'],
      playful: ['활기차고 가벼운 분위기의 곡이에요.', '가볍고 움직임이 많은 분위기의 곡이에요.', '빠른 움직임이 두드러지는 밝은 분위기의 곡이에요.'],
      ascending: ['밝고 움직임이 많은 분위기의 곡이에요.', '위로 움직이는 흐름이 두드러지는 밝은 곡이에요.', '밝은 방향으로 변화가 많은 분위기의 곡이에요.'],
      airy: ['차분하고 가벼운 분위기의 곡이에요.', '여백이 느껴지는 가벼운 분위기의 곡이에요.', '조용하고 가벼운 흐름이 두드러지는 곡이에요.'],
      warm: ['차분하고 부드러운 분위기의 곡이에요.', '안정적이고 부드러운 분위기의 곡이에요.', '차분한 흐름이 중심이 되는 부드러운 곡이에요.'],
      sparse: ['조용하고 여유로운 분위기의 곡이에요.', '여백이 많은 차분한 분위기의 곡이에요.', '조용한 흐름이 이어지는 여유로운 곡이에요.'],
      dreamy: ['차분하고 부드러운 분위기의 곡이에요.', '느린 변화가 이어지는 부드러운 분위기의 곡이에요.', '잔잔한 흐름이 중심이 되는 곡이에요.'],
      moon: ['차분하고 무거운 분위기의 곡이에요.', '낮고 조용한 흐름이 두드러지는 곡이에요.', '무게감이 있는 차분한 분위기의 곡이에요.'],
      deep: ['차분하고 무거운 분위기의 곡이에요.', '낮은 쪽에 무게가 실린 차분한 곡이에요.', '무게감 있는 흐름이 중심이 되는 곡이에요.'],
      layered: ['풍성하고 움직임이 많은 분위기의 곡이에요.', '여러 소리가 어우러지는 풍성한 분위기의 곡이에요.', '겹침과 변화가 많은 풍성한 곡이에요.']
    };

    const moodEn = {
      bright: ['This piece has a bright and active mood.', 'This piece feels light and active in structure.', 'This piece has a bright mood with frequent movement.'],
      playful: ['This piece has an active and light mood.', 'This piece has a light mood with plenty of movement.', 'This piece has a bright mood shaped by quick movement.'],
      ascending: ['This piece has a bright mood with a lot of movement.', 'Upward movement stands out in this bright piece.', 'This piece has a bright mood with frequent changes.'],
      airy: ['This piece has a calm and light mood.', 'This piece has a light mood with plenty of space.', 'A quiet and light flow stands out in this piece.'],
      warm: ['This piece has a calm and soft mood.', 'This piece has a stable and soft mood.', 'A calm flow is central to this soft piece.'],
      sparse: ['This piece has a quiet and spacious mood.', 'This piece has a calm mood with plenty of space.', 'A quiet flow continues through this spacious piece.'],
      dreamy: ['This piece has a calm and soft mood.', 'Slow changes shape the soft mood of this piece.', 'A gentle, steady flow is central to this piece.'],
      moon: ['This piece has a calm and weighty mood.', 'A low and quiet flow stands out in this piece.', 'This piece has a calm mood with more weight.'],
      deep: ['This piece has a calm and weighty mood.', 'The lower range gives this piece a calm sense of weight.', 'A weighty flow is central to this calm piece.'],
      layered: ['This piece has a full mood with a lot of movement.', 'Several sounds combine to create a fuller mood.', 'Layering and change stand out in this full piece.']
    };

    const candidates = [];
    const addFeature = (id, strength, ko, en) => {
      if (!Number.isFinite(strength) || strength <= 0) return;
      candidates.push({ id, strength, ko, en });
    };

    // Pitch center: where the piece mainly sits.
    if ((f.averagePitch || 0) >= 0.62) addFeature('pitch-high', (f.averagePitch - 0.5) * 2, ['높은 소리를 중심으로 이어져요', '전체적으로 높은 소리가 많이 사용돼요', '소리가 주로 높은 쪽에 모여 있어요'], ['The piece mainly stays in the higher range', 'Higher sounds are used throughout much of the piece', 'The sounds are mostly concentrated in the higher range']);
    else if ((f.averagePitch || 0) <= 0.38) addFeature('pitch-low', (0.5 - f.averagePitch) * 2, ['낮은 소리를 중심으로 이어져요', '전체적으로 낮은 소리가 많이 사용돼요', '소리가 주로 낮은 쪽에 모여 있어요'], ['The piece mainly stays in the lower range', 'Lower sounds are used throughout much of the piece', 'The sounds are mostly concentrated in the lower range']);
    else addFeature('pitch-mid', 0.22 + (0.5 - Math.abs((f.averagePitch || 0.5) - 0.5)) * 0.15, ['중간 높이의 소리를 중심으로 이어져요', '소리가 주로 중간 높이에 모여 있어요'], ['The piece mainly stays around the middle range', 'The sounds are mostly concentrated in the middle range']);

    // Pitch range and pitch movement are separate: wide range does not always mean frequent movement.
    if ((f.pitchRange || 0) >= 0.55) addFeature('range-wide', f.pitchRange, ['높은 소리와 낮은 소리를 넓게 오가요', '사용하는 소리의 높이 범위가 넓어요', '낮은 쪽부터 높은 쪽까지 폭넓게 움직여요'], ['The piece moves across a wide range of high and low sounds', 'A wide pitch range is used', 'The sounds move broadly from lower to higher ranges']);
    else if ((f.pitchRange || 0) <= 0.24) addFeature('range-narrow', 1 - f.pitchRange, ['비슷한 높이의 소리 안에서 움직여요', '사용하는 소리의 높이 범위가 좁아요', '소리가 비슷한 높이 주변에서 이어져요'], ['The piece moves within a similar pitch range', 'A narrow pitch range is used', 'The sounds continue around similar heights']);

    if ((f.averageInterval || 0) >= 0.45 || (f.overallChange || 0) >= 0.62) addFeature('pitch-change-high', Math.max(f.averageInterval || 0, f.overallChange || 0), ['소리의 높이가 자주 크게 바뀌어요', '앞뒤 소리의 높이 차이가 크게 나타나요', '높낮이 변화가 자주 나타나요'], ['The pitch changes noticeably from sound to sound', 'There are larger pitch differences between neighboring sounds', 'Changes in pitch happen often']);
    else if ((f.averageInterval || 0) <= 0.18 && (f.overallChange || 0) <= 0.38) addFeature('pitch-change-low', 1 - Math.max(f.averageInterval || 0, f.overallChange || 0), ['비슷한 높이의 소리가 차분하게 이어져요', '앞뒤 소리의 높이 변화가 크지 않아요', '높낮이가 크게 바뀌지 않고 이어져요'], ['Sounds at similar pitches continue steadily', 'Pitch does not change much between neighboring sounds', 'The piece continues without large pitch changes']);

    // Duration and duration balance.
    if ((f.shortNoteRatio || 0) >= 0.5) addFeature('duration-short', f.shortNoteRatio, ['짧은 소리가 자주 이어져요', '짧게 끝나는 소리가 많이 나타나요', '짧은 소리가 연속해서 나타나는 구간이 많아요'], ['Short sounds occur often', 'Many sounds end quickly', 'There are many passages with consecutive short sounds']);
    if ((f.longNoteRatio || 0) >= 0.35) addFeature('duration-long', f.longNoteRatio, ['긴 소리가 오래 이어져요', '하나의 소리가 길게 유지되는 구간이 많아요', '길게 이어지는 소리가 자주 나타나요'], ['Long sounds continue for longer', 'Many passages hold one sound for longer', 'Sustained sounds appear often']);
    if ((f.shortNoteRatio || 0) >= 0.28 && (f.longNoteRatio || 0) >= 0.22) addFeature('duration-mixed', Math.min(1, f.shortNoteRatio + f.longNoteRatio), ['짧은 소리와 긴 소리가 함께 사용돼요', '소리의 길이가 짧고 길게 다양하게 바뀌어요'], ['Short and long sounds are both used', 'Sound lengths vary between short and long']);

    // Density and space.
    if ((f.rhythmicDensity || 0) >= 0.58) addFeature('density-high', f.rhythmicDensity, ['소리가 짧은 간격으로 촘촘하게 이어져요', '소리 사이의 간격이 좁고 자주 나타나요', '한 구간 안에 많은 소리가 이어져요'], ['Sounds continue densely with short gaps', 'Sounds appear often with narrow gaps', 'Many sounds occur within each section']);
    else if ((f.restRatio || 0) >= 0.45 || (f.rhythmicDensity || 0) <= 0.28) addFeature('density-low', Math.max(f.restRatio || 0, 1 - (f.rhythmicDensity || 0)), ['소리 사이의 간격이 넓어요', '소리가 없는 여백이 자주 나타나요', '소리와 소리 사이에 쉬는 구간이 많아요'], ['There is more space between sounds', 'Silent spaces appear often', 'There are many resting spaces between sounds']);

    // Repetition versus variation.
    if ((f.repetitionStrength || 0) >= 0.55) addFeature('repeat-high', f.repetitionStrength, ['같거나 비슷한 소리의 패턴이 반복돼요', '비슷한 흐름이 여러 번 다시 나타나요', '같은 소리나 리듬이 반복되는 구간이 많아요'], ['The same or similar sound patterns repeat', 'Similar flows return several times', 'The same sounds or rhythms repeat in many passages']);
    else if ((f.repetitionStrength || 0) <= 0.28 && (f.noteCount || 0) >= 6) addFeature('repeat-low', 1 - f.repetitionStrength, ['같은 패턴의 반복보다 새로운 변화가 더 많아요', '비슷한 흐름이 반복되기보다 계속 달라져요'], ['There are more new changes than repeated patterns', 'The flow keeps changing rather than repeating similar patterns']);

    // Layering/harmony.
    if ((f.chordRatio || 0) >= 0.25) addFeature('layer-high', f.chordRatio, ['여러 소리가 동시에 겹치는 구간이 많아요', '한 번에 여러 소리가 함께 나타나요', '소리가 겹쳐지는 부분이 자주 나타나요'], ['Several sounds overlap at the same time', 'Multiple sounds often occur together', 'Layered sounds appear frequently']);
    else if ((f.chordRatio || 0) <= 0.08 && (f.noteCount || 0) >= 5) addFeature('layer-low', 1 - f.chordRatio, ['한 번에 하나의 소리가 주로 이어져요', '여러 소리가 겹치기보다 하나씩 이어지는 편이에요'], ['The piece mostly continues with one sound at a time', 'Sounds tend to continue one by one rather than overlap']);

    // Tension is kept concrete and broad, without emotional storytelling.
    if ((f.tension || 0) >= 0.52) addFeature('tension-high', f.tension, ['서로 가까운 높이의 소리가 겹치며 긴장감이 생기는 구간이 있어요', '겹친 소리 사이의 간격이 좁은 부분이 자주 나타나요'], ['Some overlapping pitches sit close together, creating more tension', 'Narrow intervals between overlapping sounds appear often']);
    else if ((f.chordRatio || 0) >= 0.18 && (f.tension || 0) <= 0.25) addFeature('tension-low', 1 - f.tension, ['겹치는 소리들이 비교적 안정적인 간격으로 이어져요', '함께 나는 소리의 간격이 비교적 안정적으로 이어져요'], ['Overlapping sounds use relatively stable intervals', 'Sounds that occur together tend to use stable intervals']);

    // Overall pace of structural change.
    if ((f.overallChange || 0) >= 0.62) addFeature('change-high', f.overallChange, ['소리의 높이와 간격이 자주 바뀌어요', '곡이 이어지는 동안 변화가 자주 나타나요', '높낮이와 소리 사이 간격이 계속 달라져요'], ['Pitch and spacing change often', 'Changes occur frequently as the piece continues', 'Pitch and spacing keep shifting']);
    else if ((f.overallChange || 0) <= 0.3) addFeature('change-low', 1 - f.overallChange, ['소리의 변화가 천천히 일어나요', '비슷한 흐름이 큰 변화 없이 이어져요', '곡의 구조가 비교적 천천히 바뀌어요'], ['The sounds change slowly', 'A similar flow continues without large changes', 'The structure changes relatively slowly']);

    const chooseFeatures = () => {
      const ranked = [...candidates].sort((a, b) => b.strength - a.strength);
      if (!ranked.length) return [];
      const first = ranked[0];
      const family = (id) => id.split('-')[0];
      const secondPool = ranked.filter((item) => item.id !== first.id && family(item.id) !== family(first.id));
      const second = secondPool[0] || ranked[1];
      return second && second.strength >= 0.34 ? [first, second] : [first];
    };

    const selected = chooseFeatures();
    const selectedTexts = selected.map((item, index) => {
      const list = language === 'en' ? item.en : item.ko;
      return pick(list, phraseValues, `feature-${item.id}-${index}`);
    });

    const featureSentence = (() => {
      if (!selectedTexts.length) {
        return language === 'ko'
          ? '중간 높이의 소리를 중심으로 비교적 일정하게 이어져요.'
          : 'The piece continues fairly steadily around the middle range.';
      }
      if (language === 'ko') {
        if (selectedTexts.length === 1) return `${selectedTexts[0]}.`;
        const first = selectedTexts[0].replace(/요$/, '');
        return `${first}고, ${selectedTexts[1]}.`;
      }
      if (selectedTexts.length === 1) return `${selectedTexts[0]}.`;
      return `${selectedTexts[0]}, and ${selectedTexts[1].charAt(0).toLowerCase()}${selectedTexts[1].slice(1)}.`;
    })();

    const moodList = language === 'en'
      ? (moodEn[result.primaryMood] || moodEn.warm)
      : (moodKo[result.primaryMood] || moodKo.warm);
    const moodSentence = pick(moodList, phraseValues, `mood-${result.primaryMood}`);

    return `${moodSentence} ${featureSentence}`;
  }

  function buildReasons(result) {
    const f = result.features;
    const reasons = [];
    if (f.highRatio > f.lowRatio + 0.12) reasons.push('high-pitch-focus');
    if (f.lowRatio > f.highRatio + 0.12) reasons.push('low-pitch-focus');
    if (f.shortNoteRatio > 0.5) reasons.push('short-note-density');
    if (f.longNoteRatio > 0.35) reasons.push('long-note-flow');
    if (f.repetitionStrength > 0.55) reasons.push('repeated-patterns');
    if (f.tension > 0.45) reasons.push('interval-tension');
    if (f.chordRatio > 0.22) reasons.push('stacked-notes');
    if (f.restRatio > 0.45) reasons.push('visible-rest-space');
    return reasons.slice(0, 5);
  }

  function analyzeMusicMood(composition, notes, options = {}) {
    const features = extractMusicFeatures(composition, notes, options);
    if (features.noteCount < (options.minNotesForMood || MIN_NOTES_FOR_MOOD)) {
      return {
        status: 'insufficient',
        features,
        scores: Object.fromEntries(MOODS.map((mood) => [mood, 0])),
        primaryMood: 'sparse',
        secondaryMood: 'airy',
        primaryScore: 0,
        secondaryScore: 0,
        valence: 0.5,
        arousal: 0,
        energy: 0,
        tension: 0,
        brightness: 0.5,
        reasons: ['not-enough-notes'],
        visualState: createMoodVisualState({ valence: 0.5, arousal: 0, energy: 0, tension: 0, brightness: 0.5 })
      };
    }
    const scores = calculateMoodScores(features);
    const dominant = selectDominantMoods(scores, features);
    const result = {
      status: 'ready',
      features,
      scores,
      ...dominant
    };
    result.reasons = buildReasons(result);
    result.visualState = createMoodVisualState(result);
    return result;
  }

  return {
    MOODS,
    moodMeta,
    extractMusicFeatures,
    calculateMoodScores,
    selectDominantMoods,
    createMoodVisualState,
    createVatPalette,
    VAT_COLOR_ANCHORS,
    createFeedbackSentence,
    createStablePhraseIndex,
    analyzeMusicMood
  };
}));
