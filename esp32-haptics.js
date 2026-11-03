(function (root) {
  'use strict';
  const SERVICE = 'c9dc1000-9f3b-4f37-8ab4-6e10d5010001';
  const FRAME = 'c9dc1001-9f3b-4f37-8ab4-6e10d5010001';
  const INFO = 'c9dc1002-9f3b-4f37-8ab4-6e10d5010001';
  const DIAGNOSTICS = 'c9dc1003-9f3b-4f37-8ab4-6e10d5010001';
  function decodeDiagnostics(value) {
    if (!value || value.byteLength !== 15 || value.getUint8(0) !== 1) return null;
    const flags = value.getUint8(1);
    return { enabled: !!(flags & 1), connected: !!(flags & 2), locked: !!(flags & 4), fresh: !!(flags & 8),
      dial: value.getUint16(2, true), frames: value.getUint16(4, true), receivedPeak: value.getUint8(6),
      outputs: Array.from({length:8}, (_,i)=>value.getUint8(7+i)) };
  }
  const clamp = v => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  function amplitude(event, elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= event.duration) return 0;
    const intensity = clamp(event.intensity);
    // Optional onset accent stays inside the scheduled duration and both master gains.
    if (event.onsetAccent && elapsed < 0.10 && intensity > 0) return 1;
    switch (event.pattern) {
      case 'sustained': return intensity;
      case 'chordMajor3':
      case 'chordMinor3':
      case 'chordPerfect5':
      case 'chordSus2':
      case 'chordSus4':
      case 'chordMajor7':
      case 'chordTension': {
        const schedules = {
          chordMajor3: [0.18,0.18,0.18,0.45],
          chordMinor3: [0.18,0.18,0.18,0.18,0.18,0.45],
          chordSus2: [0.18,0.18,0.45,0.45],
          chordSus4: [0.45,0.18,0.18,0.45],
          chordPerfect5: [0.9,0.2],
          chordMajor7: [0.45,0.45],
          chordTension: [0.18,0.18]
        };
        const durations=schedules[event.pattern];
        let t=elapsed % durations.reduce((a,b)=>a+b,0);
        for(let i=0;i<durations.length;i++){
          if(t < durations[i]-1e-9) return intensity * (i%2===0 ? 0.85 : 0.65);
          t-=durations[i];
        }
        return intensity * 0.65;
      }
      // Keep a continuous low level so chord texture cannot be mistaken for a rest.
      case 'testSeparated': return intensity * (elapsed % 0.4 < 0.25 ? 0.85 : 0.65);
      case 'testGrouped': {
        const t = elapsed % 0.85;
        return t < 0.2 || (t >= 0.35 && t < 0.55) ? intensity : 0;
      }
      case 'testWave': return intensity * (0.65 + 0.35 * (1 - Math.cos(2 * Math.PI * elapsed / 1.2)) / 2);
      case 'finePulse': return elapsed % 0.17 < 0.10 ? intensity : 0;
      case 'densePulse': return elapsed % 0.10 < 0.06 ? intensity : 0;
      case 'slowWave': {
        const phase = (elapsed % 0.25) / 0.125;
        const blend = phase <= 1 ? phase : 2 - phase;
        const low = Math.max(0.12, intensity * 0.55);
        return low + (Math.min(1, intensity * 1.10) - low) * blend;
      }
      default: return 0;
    }
  }
  // Normalize once per song, before resume trimming. Highest chord note chooses one row.
  function relativeRow(pitch, range) {
    if (!Number.isFinite(pitch) || !Array.isArray(range) || range.length !== 2 ||
        !range.every(Number.isFinite) || range[1] < range[0]) return null;
    if (range[0] === range[1]) return 2; // One pitch: lower of the two middle rows.
    const position = clamp((pitch - range[0]) / (range[1] - range[0]));
    return 3 - Math.min(3, Math.floor(position * 4));
  }
  function structureOf(pitches) {
    const notes=[...new Set(pitches.filter(Number.isFinite))];
    if(!notes.length)return null;
    const pcs=[...new Set(notes.map(n=>((n%12)+12)%12))].sort((a,b)=>a-b);
    const shape=(intervals)=>pcs.length===intervals.length && pcs.some(root=>
      intervals.map(i=>(root+i)%12).sort((a,b)=>a-b).every((n,i)=>n===pcs[i]));
    // Suspended chords share pitch sets under inversion: use the lowest sounding note as bass/root.
    const bass=Math.min(...notes);
    const bassShape=[...new Set(notes.map(n=>((n-bass)%12+12)%12))].sort((a,b)=>a-b).join(',');
    let pattern='chordTension';
    if(notes.length===1)pattern='sustained';
    else if(bassShape==='0,2,7')pattern='chordSus2';
    else if(bassShape==='0,5,7')pattern='chordSus4';
    else if(shape([0,4,7,11])||shape([0,4,11]))pattern='chordMajor7';
    else if(shape([0,4])||shape([0,4,7]))pattern='chordMajor3';
    else if(shape([0,3])||shape([0,3,7]))pattern='chordMinor3';
    else if(shape([0,7])||pcs.length===1)pattern='chordPerfect5';
    return {center:notes.reduce((a,b)=>a+b,0)/notes.length,
      intensity:notes.length===1?.70:notes.length===2?.85:1,pattern};
  }

  function spatialEvents(events) {
    const pitches = events.flatMap(e => Array.isArray(e.pitches) ? e.pitches.filter(Number.isFinite) : []);
    const fallbackRange = pitches.length ? [Math.min(...pitches), Math.max(...pitches)] : null;
    return events.map(e => {
      const notes = Array.isArray(e.pitches) ? e.pitches.filter(Number.isFinite) : [];
      const structure=e.structureMapping?structureOf(notes):null;
      return {...e, ...(structure?{intensity:structure.intensity,pattern:structure.pattern,onsetAccent:false}:{}),
        motorRow:notes.length?relativeRow(structure?structure.center:Math.max(...notes),e.pitchRange||fallbackRange):null};
    });
  }
  function frameAt(events, elapsed, gain = 1, channels = [0,1,2,3,4,5,6,7]) {
    const frame = new Uint8Array(9); frame[0] = 1;
    const allowed = new Set(channels.filter(c => Number.isInteger(c) && c >= 0 && c < 8));
    for (const event of events) {
      const duty = Math.round(255 * clamp(amplitude(event, elapsed - event.startTime) * clamp(gain)));
      const row = event.motorRow;
      const targets = Number.isInteger(row) && row >= 0 && row < 4 ? [row, row + 4] : [];
      for (const channel of targets) {
        if (allowed.has(channel)) frame[channel + 1] = Math.max(frame[channel + 1], duty);
      }
    }
    // Per-motor calibration from assembled-device comparison: motors 5–8.
    const rightGains = [1, 0.97, 0.65, 0.87];
    for (let channel=4;channel<8;channel++) frame[channel+1]=Math.round(frame[channel+1]*rightGains[channel-4]);
    return frame;
  }
  class Controller {
    constructor({ bluetooth, now = () => performance.now(), notify = () => {}, every = (fn, ms) => root.setInterval(fn, ms), cancel = id => root.clearInterval(id) } = {}) {
      this.bluetooth = bluetooth; this.now = now; this.notify = notify;
      this.every = every; this.cancel = cancel; this.events = []; this.gain = 0.6;
      this.connected = false; this.connecting = false; this.generation = 0;
      this.pending = null; this.writing = false; this.channels = [0,1,2,3,4,5,6,7];
    }
    async connect() {
      if (this.connecting || this.connected) return;
      if (!this.bluetooth) throw new Error('iMac Chrome에서 HTTPS 사이트로 열어주세요.');
      this.connecting = true;
      try {
        const device = await this.bluetooth.requestDevice({filters: [{services: [SERVICE]}]});
        this.device = device;
        device.addEventListener('gattserverdisconnected', () => {
          if (this.device === device) this.reset('블루투스 연결이 끊겼어요. 다시 연결해주세요.');
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE);
        const info = await (await service.getCharacteristic(INFO)).readValue();
        if (new TextDecoder().decode(info) !== 'SOUNDI8/1') throw new Error('SOUNDI-8 펌웨어 버전을 확인해주세요.');
        this.characteristic = await service.getCharacteristic(FRAME);
        this.diagnostics = null;
        try {
          const telemetry = await service.getCharacteristic(DIAGNOSTICS);
          telemetry.addEventListener('characteristicvaluechanged', event => {
            if (this.device === device) {
              this.diagnostics = decodeDiagnostics(event.target.value);
              this.diagnosticsAt = this.now();
            }
          });
          await telemetry.startNotifications();
        } catch (_) { /* Older firmware can still play without telemetry. */ }
        this.connected = true; this.events = [];
        this.timer = this.every(() => this.tick(), 20);
        this.tick();
        this.notify('SOUNDI-8 연결됨 · 재생하면 진동이 시작돼요.');
      } catch (error) { this.disconnect(); throw error; }
      finally { this.connecting = false; }
    }
    reset(message) {
      this.generation++; this.connected = false; this.events = []; this.pending = null;
      this.characteristic = null; this.diagnostics = null;
      if (this.timer !== undefined) this.cancel(this.timer);
      this.timer = undefined; this.notify(message);
    }
    disconnect() {
      const device = this.device; this.device = null;
      this.reset('SOUNDI-8 연결 해제됨');
      if (device?.gatt.connected) device.gatt.disconnect();
    }
    play(events, startAt) {
      if (!Number.isFinite(startAt)) startAt = Date.now() / 1000;
      this.events = spatialEvents(events.filter(e => Number.isFinite(e.startTime) && Number.isFinite(e.duration) && e.duration > 0));
      this.origin = this.now() + (startAt * 1000 - Date.now());
      this.channels = [0,1,2,3,4,5,6,7]; this.tick(); return this.connected;
    }
    test(channel) {
      this.testChannels([channel]);
    }
    testChannels(channels) {
      if (!this.connected || !Array.isArray(channels)) return;
      const selected = [...new Set(channels.filter(channel => Number.isInteger(channel) && channel >= 0 && channel < 8))];
      if (!selected.length) return;
      this.events = selected.map(channel => ({
        startTime: 0, duration: 0.6, intensity: 1.0, pattern: 'sustained', motorRow: channel % 4
      }));
      this.origin = this.now(); this.channels = selected; this.tick();
    }
    stop() { this.events = []; this.tick(); }
    previewFrame() {
      return frameAt(this.events, (this.now() - this.origin) / 1000, this.gain, this.channels);
    }
    tick() {
      if (!this.connected) return;
      // Retain only the newest frame; slow writes cannot accumulate old pulses.
      this.pending = this.previewFrame();
      void this.flush();
    }
    async flush() {
      if (this.writing || !this.connected) return;
      this.writing = true;
      const generation = this.generation;
      try {
        while (this.pending && this.connected && generation === this.generation) {
          const frame = this.pending; this.pending = null;
          await this.characteristic.writeValueWithoutResponse(frame);
        }
      } catch (error) {
        if (generation === this.generation) { this.disconnect(); this.notify('진동 전송이 중단됐어요. 다시 연결해주세요.'); }
      } finally {
        this.writing = false;
        if (this.connected && this.pending) void this.flush();
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { amplitude, frameAt, Controller, decodeDiagnostics, relativeRow, spatialEvents, structureOf };
  root.SoundiHapticStructure = structureOf;
  if (!root.document) return;
  // Keep connection controls accessible before playback and during motor tests.
  // The original feedback panel is hidden whenever music is stopped.
  const connectionUI = document.querySelector('.haptic-status-ui');
  document.getElementById('composeView').appendChild(connectionUI);
  const status = document.getElementById('esp32Status');
  const connect = document.getElementById('esp32Connect');
  const controller = new Controller({bluetooth: root.navigator.bluetooth, notify: message => {
    status.textContent = message;
    connect.textContent = controller.connected ? '블루투스 연결 해제' : 'SOUNDI-8 블루투스 연결';
    document.querySelectorAll('[data-motor-test], [data-motor-test-channels]').forEach(button => { button.disabled = !controller.connected; });
    root.dispatchEvent(new Event('soundi-esp32-status'));
  }});
  root.SoundiESP32 = controller;
  const preview = document.getElementById('esp32Preview');
  const diagnosticView = document.createElement('p');
  diagnosticView.id = 'esp32Diagnostics';
  preview.insertAdjacentElement('afterend', diagnosticView);
  root.setInterval(() => {
    const d = controller.diagnostics;
    diagnosticView.textContent = !controller.connected ? '보드 상태: 연결 대기'
      : !d ? '보드 상태: 진단 응답 대기 (지원 펌웨어 필요)'
      : controller.now() - controller.diagnosticsAt > 1500 ? '보드 상태: 응답 지연 · 마지막 값은 현재 상태가 아닙니다'
      : `보드 상태: 다이얼 ${Math.round(d.dial / 4095 * 100)}% (${d.dial}) · 스위치 ${d.enabled ? 'ON' : 'OFF'} · 수신 ${d.frames}회 · 신호 ${d.fresh ? '정상' : '없음'} · 잠금 ${d.locked ? 'ON' : 'OFF'} · 수신 세기 ${Math.round(d.receivedPeak / 255 * 100)}% · 출력 명령 ${d.outputs.map(v=>Math.round(v/255*100)+'%').join(' / ')} (진동 측정값 아님)`;
    const values = Array.from(controller.previewFrame().slice(1), value => `${Math.round(value / 255 * 100)}%`);
    preview.textContent = `${controller.connected ? '전송 목표' : '미연결 · 계산값'}: ${values.join(' / ')}`;
  }, 100);
  connect.addEventListener('click', async () => {
    connect.disabled = true;
    try {
      if (controller.connected) controller.disconnect();
      else { status.textContent = 'SOUNDI-8을 선택해주세요…'; await controller.connect(); }
    } catch (error) { status.textContent = error.name === 'NotFoundError' ? '기기 선택을 취소했어요.' : error.message; }
    finally { connect.disabled = false; }
  });
  document.querySelectorAll('[data-motor-test]').forEach(button => button.addEventListener('click', () => {
    root.dispatchEvent(new Event('soundi-esp32-test'));
    controller.test(Number(button.dataset.motorTest));
    status.textContent = `${Number(button.dataset.motorTest) + 1}번 모터 · 0.6초 테스트`;
  }));
  document.querySelectorAll('[data-motor-test-channels]').forEach(button => button.addEventListener('click', () => {
    const channels = button.dataset.motorTestChannels.split(',').map(value => Number(value.trim()));
    root.dispatchEvent(new Event('soundi-esp32-test'));
    controller.testChannels(channels);
    status.textContent = `오른쪽 4개 모터 · 0.6초 테스트`;
  }));
  document.getElementById('esp32Stop').addEventListener('click', () => {
    root.dispatchEvent(new Event('soundi-esp32-test')); controller.stop();
    status.textContent = controller.connected ? '모든 모터 정지됨' : '기기를 연결해주세요.';
  });
  document.getElementById('esp32Gain').addEventListener('input', event => {
    controller.gain = Number(event.target.value) / 100;
    document.getElementById('esp32GainValue').textContent = `${event.target.value}%`;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && controller.connected) { root.dispatchEvent(new Event('soundi-esp32-test')); controller.stop(); }
  });
  root.addEventListener('pagehide', () => controller.disconnect());
})(typeof window === 'undefined' ? globalThis : window);
