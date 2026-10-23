const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
function harness(overrides = {}) {
  const calls = [], timers = [];
  const context = vm.createContext({
    console: {log() {}, warn() {}}, Date, AbortSignal,
    performance: {now: () => 2000},
    window: {setTimeout: (fn, ms) => {timers.push({fn, ms}); return timers.length;}},
    fetch: async (url, options) => {calls.push({url, options}); return {ok: true, json: async () => ({ok: true})};},
    getLoopBounds: () => ({start: 4, end: 12}),
    getStepIntervalSeconds: () => 0.5,
    buildHapticEventsFromComposition: () => [
      {startTime: 0, duration: 1}, {startTime: 1, duration: 2}, {startTime: 3, duration: 1}
    ],
    buildSoundiVisualPlayback: () => ({timeline: []}),
    isPlaying: true, playbackGeneration: 1, playStep: 7, playTimer: null,
    tickPlayback: () => calls.push({tick: true}), ...overrides
  });
  vm.runInContext(source.slice(source.indexOf('let hapticRequestQueue'), source.indexOf('function getHarmonyDirection')), context);
  vm.runInContext(source.slice(source.indexOf('function schedulePlaybackStart'), source.indexOf('function tickPlayback')), context);
  return {context, calls, timers, run: code => vm.runInContext(code, context)};
}
test('resume trims elapsed events and remaining duration at the resume position', async () => {
  const h = harness();
  await h.run('sendSoundiHapticsToActiveDevice(100, 7)');
  const body = JSON.parse(h.calls[0].options.body);
  assert.equal(body.startAt, 100);
  assert.deepEqual(body.events, [{startTime: 0, duration: 1.5}, {startTime: 1.5, duration: 1}]);
});
test('music begins on scheduled deadline without waiting for an unreachable phone', async () => {
  const h = harness({fetch: () => new Promise(() => {})});
  h.run('schedulePlaybackStart(1)');
  assert.equal(h.timers[0].ms, 1000);
  h.timers[0].fn();
  assert.equal(h.calls.filter(c => c.tick).length, 1);
});
test('stop during the lead-in cancels the pending music start', () => {
  const h = harness(); h.run('schedulePlaybackStart(1)');
  h.context.isPlaying = false; h.context.playbackGeneration = 2;
  h.timers[0].fn();
  assert.equal(h.calls.filter(c => c.tick).length, 0);
});
test('stop cannot overtake a pending play request', async () => {
  let finish;
  const urls = [];
  const h = harness({fetch: (url) => {urls.push(url); return urls.length === 1 ? new Promise(resolve => {finish = resolve;}) : Promise.resolve({ok: true, json: async () => ({})});}});
  const play = h.run('sendSoundiHapticsToActiveDevice(100, 4)');
  const stop = h.run('stopSoundiHapticsOnActiveDevice()');
  await Promise.resolve();
  assert.deepEqual(urls, ['/api/haptics/play']);
  finish({ok: true, json: async () => ({})});
  await Promise.all([play, stop]);
  assert.deepEqual(urls, ['/api/haptics/play', '/api/haptics/stop']);
});
test('network failure does not block subsequent stop', async () => {
  let attempts = 0;
  const h = harness({fetch: async () => {if (++attempts === 1) throw new Error('offline'); return {ok: true};}});
  assert.equal(await h.run('sendSoundiHapticsToActiveDevice(100, 4)'), false);
  assert.equal(await h.run('stopSoundiHapticsOnActiveDevice()'), true);
});

const net = require('node:net');
const serverSource = fs.readFileSync(require('node:path').join(__dirname, '../server.js'), 'utf8');
async function withReceiver(reply, verify) {
  const server = net.createServer({allowHalfOpen: true}, socket => {
    let data = '';
    socket.on('data', chunk => {data += chunk;});
    socket.on('end', () => socket.end(JSON.stringify(reply)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const target = {host: '127.0.0.1', port: server.address().port};
  const ctx = vm.createContext({net, Date, JSON, Promise, Error, Number, discoveredHapticDevice: target});
  vm.runInContext(serverSource.slice(serverSource.indexOf('function sendHapticTcpPayload'), serverSource.indexOf('async function handleHapticsPair')), ctx);
  try { await verify(ctx, target); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('TCP transport rejects an incorrect pairing code reported by the phone', async () => {
  await withReceiver({ok: false, error: 'wrong code'}, async ctx => {
    await assert.rejects(vm.runInContext('sendHapticTcpPayload("{}")', ctx), /wrong code/);
  });
});
test('TCP transport reads phone acknowledgement and estimates clock offset', async () => {
  await withReceiver({ok: true, deviceTime: Date.now() / 1000 + 3}, async (ctx, target) => {
    const result = await vm.runInContext('sendHapticTcpPayload("{}")', ctx);
    assert.equal(result.ok, true);
    assert.ok(target.clockOffset > 2.5 && target.clockOffset < 3.5);
  });
});
