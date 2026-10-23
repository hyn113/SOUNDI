const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) return;
    process.env[key] = rawValue.replace(/^[\"']|[\"']$/g, '');
  });
}

loadEnvFile(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 8126);
const HOST = process.env.HOST || '127.0.0.1';
const HAPTIC_SERVICE_TYPE = '_soundihaptics._tcp';
const HAPTIC_SERVICE_DOMAIN = 'local.';
const HAPTIC_DIRECT_PORT = 8127;
let discoveredHapticDevice = null;
let hapticBrowseProcess = null;
let hapticResolveProcess = null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xbkpqoeetjipjirslteq.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SOUNDI_ADMIN_PASSWORD = '1021';
const rootDir = __dirname;
const adminSessions = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, X-Soundi-User-Id',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const parts = [];
  (response.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    });
  });
  return parts.join('\n');
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Empty model response');
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

async function createOpenAIFeedback(payload) {
  if (!OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not set');
    error.statusCode = 503;
    throw error;
  }

  console.log('[Soundi AI] OpenAI 요청 시작');
  console.log(`[Soundi AI] 모델: ${OPENAI_MODEL}`);

  const compactPayload = {
    language: payload.language,
    intent: payload.intent,
    vat: payload.vat,
    blockFeatures: payload.blockFeatures,
    composition: {
      primaryMood: payload.composition?.primaryMood,
      secondaryMood: payload.composition?.secondaryMood,
      energy: payload.composition?.energy,
      tension: payload.composition?.tension,
      brightness: payload.composition?.brightness,
      density: payload.composition?.density,
      highRatio: payload.composition?.highRatio,
      lowRatio: payload.composition?.lowRatio,
      chordRatio: payload.composition?.chordRatio,
      repetitionStrength: payload.composition?.repetitionStrength,
      longNoteRatio: payload.composition?.longNoteRatio,
      shortNoteRatio: payload.composition?.shortNoteRatio,
      rhythmVariation: payload.composition?.rhythmVariation
    }
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_output_tokens: 1200,
      reasoning: { effort: 'low' },
      instructions: [
        'You analyze symbolic block-composition data for Soundi.',
        'Do not claim to hear audio. Use only the supplied numeric and symbolic features.',
        'Return JSON only with exactly two keys: summary and gapAnalysis.',
        'summary: one short sentence describing the current composition itself, grounded in register, note length, density, repetition, energy, or harmony.',
        'gapAnalysis: an array of 2 short sentences comparing the current composition with the user intent and explaining what musical qualities need to change.',
        'Do not give step-by-step edit instructions; the client creates those deterministically.',
        'Avoid praise, metaphors, vague language, and repeated information.',
        'For Korean, use a natural friendly 해요체 ending such as ~해요, ~보여요, ~좋아요. Do not use report-style endings such as ~이다, ~한다, ~해야 한다, ~필요하다.',
        'Phrase comparisons as helpful guidance, not commands. Prefer expressions like ~하면 더 잘 어울려요, ~을 늘리면 좋아요, ~을 줄여보세요.',
        'Do not sound like an academic report or evaluation sheet. Write as a calm music-making assistant speaking directly to the user.',
        'Never show internal analysis terms or model variables to the user, including arousal, valence, tension, VAT, pitchHeight, rhythmDensity, repetitionStrength, harmonyStability, or similar technical labels.',
        'Translate all internal analysis into plain everyday language. For example, instead of saying arousal is low, say the song feels calm or has less movement; instead of high tension, say the harmony feels more unsettled or tense.',
        'Use words that a beginner with no music-theory background can understand. Prefer simple phrases such as 음이 자주 움직여요, 블록 사이가 촘촘해요, 높은 음이 많아요, 긴 음이 많아요, 같은 패턴이 자주 반복돼요.',
        'Keep each sentence conversational and easy to scan. Avoid English terms in parentheses and avoid specialist vocabulary unless it is a visible Soundi UI label.',
        'If language is ko, write Korean only. If language is en, write English only.'
      ].join(' '),
      input: JSON.stringify(compactPayload)
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'OpenAI request failed');
    error.statusCode = response.status;
    throw error;
  }

  if (data.status === 'incomplete') {
    console.warn('[Soundi AI] OpenAI 응답 미완료', data.incomplete_details || {});
  }

  const outputText = getOutputText(data);
  console.log('[Soundi AI] OpenAI 응답 성공');
  console.log(`[Soundi AI] 출력 길이: ${outputText.length}자`);

  if (!outputText.trim()) {
    const reason = data.incomplete_details?.reason || data.status || 'empty_output';
    const error = new Error(`Empty model response (${reason})`);
    error.statusCode = 502;
    throw error;
  }

  const parsed = extractJson(outputText);
  const gapAnalysis = Array.isArray(parsed.gapAnalysis)
    ? parsed.gapAnalysis.slice(0, 3).map(String).filter(Boolean)
    : parsed.gapAnalysis
      ? [String(parsed.gapAnalysis)]
      : [];

  return {
    summary: String(parsed.summary || ''),
    gapAnalysis
  };
}

async function handleAnalyze(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const payload = JSON.parse(await readBody(req));
    const feedback = await createOpenAIFeedback(payload);
    sendJson(res, 200, { feedback });
  } catch (error) {
    console.error('[Soundi AI] OpenAI 호출 실패', error);
    console.log('[Soundi AI] 로컬 분석으로 전환');
    sendJson(res, error.statusCode || 500, { error: error.message || 'Analysis failed' });
  }
}

async function handleAdminLogin(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const body = JSON.parse(await readBody(req));
    const password = String(body.password || '');

    if (password !== SOUNDI_ADMIN_PASSWORD) {
      sendJson(res, 401, { error: 'Invalid admin password' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.add(token);
    sendJson(res, 200, { ok: true, token });
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Admin login failed' });
  }
}


async function handleArchiveDelete(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'DELETE') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  if (!SUPABASE_SECRET_KEY) {
    sendJson(res, 503, { error: 'SUPABASE_SECRET_KEY is not set' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const prefix = '/api/archive/';
  const songId = decodeURIComponent(url.pathname.slice(prefix.length)).trim();
  if (!songId) {
    sendJson(res, 400, { error: 'Song id is required' });
    return;
  }

  const adminToken = String(req.headers['x-admin-token'] || '');
  const isAdmin = Boolean(adminToken && adminSessions.has(adminToken));
  const userId = String(req.headers['x-soundi-user-id'] || '').trim();

  try {
    if (!isAdmin) {
      if (!userId) {
        sendJson(res, 403, { error: 'User authorization failed' });
        return;
      }

      const lookupResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(songId)}&select=owner_id`,
        {
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
          }
        }
      );
      const rows = await lookupResponse.json();
      if (!lookupResponse.ok || !Array.isArray(rows) || !rows.length || rows[0].owner_id !== userId) {
        sendJson(res, 403, { error: 'Song ownership check failed' });
        return;
      }
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(songId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          Prefer: 'return=minimal'
        }
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Supabase delete failed (${response.status})`);
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('[Soundi Archive] 삭제 실패', error);
    sendJson(res, 500, { error: error.message || 'Delete failed' });
  }
}


function stopProcess(processHandle) {
  if (!processHandle) return;
  try {
    processHandle.kill('SIGTERM');
  } catch {
    // Ignore cleanup failures.
  }
}

function resolveHapticService(serviceName) {
  stopProcess(hapticResolveProcess);

  const resolver = spawn('dns-sd', [
    '-L',
    serviceName,
    HAPTIC_SERVICE_TYPE,
    HAPTIC_SERVICE_DOMAIN
  ]);

  hapticResolveProcess = resolver;

  let buffer = '';

  resolver.stdout.on('data', (chunk) => {
    buffer += chunk.toString();

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    lines.forEach((line) => {
      const match = line.match(/can be reached at\s+(.+):(\d+)(?:\s|$)/i);
      if (!match) return;

      const host = match[1].trim();
      const port = Number(match[2]);

      if (!host || !Number.isFinite(port)) return;

      const previous = discoveredHapticDevice;
      discoveredHapticDevice = {
        name: serviceName,
        host,
        port,
        discoveredAt: Date.now()
      };

      if (
        !previous ||
        previous.host !== host ||
        previous.port !== port ||
        previous.name !== serviceName
      ) {
        console.log(
          `[Soundi Haptics] 기기 자동 연결: ${serviceName} (${host}:${port})`
        );

        sendHapticTcpPayload(JSON.stringify({
          type: 'hello',
          deviceName: 'Soundi Web'
        })).catch((error) => {
          console.warn('[Soundi Haptics] 연결 확인 전송 실패:', error.message);
        });
      }
    });
  });

  resolver.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      console.warn('[Soundi Haptics] Bonjour resolve:', message);
    }
  });

  resolver.on('error', (error) => {
    console.warn(
      '[Soundi Haptics] dns-sd resolve 실행 실패:',
      error.message
    );
  });
}

function startHapticBonjourDiscovery() {
  stopProcess(hapticBrowseProcess);

  const browser = spawn('dns-sd', [
    '-B',
    HAPTIC_SERVICE_TYPE,
    HAPTIC_SERVICE_DOMAIN
  ]);

  hapticBrowseProcess = browser;

  let buffer = '';

  browser.stdout.on('data', (chunk) => {
    buffer += chunk.toString();

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    lines.forEach((line) => {
      const match = line.match(
        /^\s*\S+\s+(Add|Rmv)\s+\d+\s+\d+\s+\S+\s+\S+\s+(.+)$/
      );

      if (!match) return;

      const action = match[1];
      const serviceName = match[2].trim();

      if (!serviceName) return;

      if (action === 'Add') {
        resolveHapticService(serviceName);
        return;
      }

      if (
        action === 'Rmv' &&
        discoveredHapticDevice?.name === serviceName
      ) {
        console.log(
          `[Soundi Haptics] 기기 연결 해제: ${serviceName}`
        );
        discoveredHapticDevice = null;
      }
    });
  });

  browser.stderr.on('data', (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      console.warn('[Soundi Haptics] Bonjour browse:', message);
    }
  });

  browser.on('error', (error) => {
    console.warn(
      '[Soundi Haptics] dns-sd browse 실행 실패:',
      error.message
    );
  });

  browser.on('close', () => {
    if (hapticBrowseProcess === browser) {
      hapticBrowseProcess = null;
    }
  });
}

process.on('SIGINT', () => {
  stopProcess(hapticBrowseProcess);
  stopProcess(hapticResolveProcess);
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopProcess(hapticBrowseProcess);
  stopProcess(hapticResolveProcess);
  process.exit(0);
});


function normalizeHapticHost(host) {
  const value = String(host || '').trim();
  if (!value) return '';
  return value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

function sendHapticTcpPayload(payload, target = discoveredHapticDevice) {
  return new Promise((resolve, reject) => {
    if (!target) {
      reject(new Error('No Soundi haptic device discovered'));
      return;
    }

    let settled = false;
    let reply = "";
    const requestedAt = Date.now() / 1000;
    const socket = net.createConnection({
      host: target.host,
      port: target.port
    });

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };

    socket.setTimeout(4000);

    socket.on('connect', () => {
      socket.end(payload);
    });

    socket.on('data', chunk => { reply += chunk.toString(); });
    socket.on('close', (hadError) => {
      if (hadError) return;
      try {
        const response = reply ? JSON.parse(reply) : null;
        if (response?.ok === false) { finish(() => reject(new Error(response.error || 'Device rejected request'))); return; }
        if (Number.isFinite(response?.deviceTime)) {
          target.clockOffset = response.deviceTime - (requestedAt + Date.now() / 1000) / 2;
        }
        finish(() => resolve(response));
      } catch (error) { finish(() => reject(error)); }
    });

    socket.on('timeout', () => {
      socket.destroy(new Error('Haptic device connection timed out'));
    });

    socket.on('error', (error) => {
      finish(() => reject(error));
    });
  });
}



async function handleHapticsPair(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req));
    const pairingCode = String(body.pairingCode || '').replace(/\D/g, '').slice(0, 6);
    const manualHost = normalizeHapticHost(body.host);

    if (pairingCode.length !== 6) {
      sendJson(res, 400, { error: '6자리 연결 코드를 입력해주세요.' });
      return;
    }

    const target = manualHost
      ? {
          name: 'iPhone',
          host: manualHost,
          port: HAPTIC_DIRECT_PORT
        }
      : discoveredHapticDevice;

    if (!target) {
      sendJson(res, 404, {
        error: 'iPhone을 아직 찾지 못했어요. iPhone IP를 함께 입력해보세요.'
      });
      return;
    }

    const confirmation = await sendHapticTcpPayload(JSON.stringify({
      type: 'hello',
      deviceName: 'Soundi Web',
      pairingCode
    }), target);

    if (!confirmation?.ok) throw new Error('iPhone 앱을 최신 버전으로 업데이트한 후 다시 연결해주세요.');
    discoveredHapticDevice = target;

    console.log(`[Soundi Haptics] 연결 코드 확인 요청: ${pairingCode}`);

    sendJson(res, 200, {
      ok: true,
      connected: true,
      deviceName: target.name
    });
  } catch (error) {
    console.warn('[Soundi Haptics] 연결 코드 연결 실패:', error.message);
    sendJson(res, 502, { error: error.message || 'Pairing failed' });
  }
}


function handleHapticsStatus(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  sendJson(res, 200, {
    connected: Boolean(discoveredHapticDevice),
    deviceName: discoveredHapticDevice?.name || null,
    host: discoveredHapticDevice?.host || null,
    port: discoveredHapticDevice?.port || null
  });
}

async function handleHapticsPlay(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!discoveredHapticDevice) {
    sendJson(res, 503, { error: 'No Soundi haptic device discovered' });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(req));
    const events = Array.isArray(payload.events) ? payload.events : [];

    if (!events.length) {
      sendJson(res, 400, { error: 'No haptic events' });
      return;
    }

    const body = JSON.stringify({
      type: 'play',
      startAt: Number.isFinite(payload.startAt) ? payload.startAt + (discoveredHapticDevice.clockOffset || 0) : null,
      events,
      visual: payload.visual || null
    });

    await sendHapticTcpPayload(body);

    sendJson(res, 200, {
      ok: true,
      count: events.length,
      target: discoveredHapticDevice.host,
      port: discoveredHapticDevice.port,
      deviceName: discoveredHapticDevice.name
    });
  } catch (error) {
    console.error('[Soundi Haptics] 전송 실패', error);
    sendJson(res, 502, { error: error.message || 'Haptic send failed' });
  }
}

async function handleHapticsStop(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!discoveredHapticDevice) {
    sendJson(res, 503, { error: 'No Soundi haptic device discovered' });
    return;
  }

  try {
    await sendHapticTcpPayload(JSON.stringify({ type: 'stop' }));
    sendJson(res, 200, {
      ok: true,
      target: discoveredHapticDevice.host,
      port: discoveredHapticDevice.port,
      deviceName: discoveredHapticDevice.name
    });
  } catch (error) {
    console.error('[Soundi Haptics] 정지 전송 실패', error);
    sendJson(res, 502, { error: error.message || 'Haptic stop failed' });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(rootDir, requestedPath));
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/haptics/pair')) {
    handleHapticsPair(req, res);
    return;
  }
  if (req.url.startsWith('/api/haptics/status')) {
    handleHapticsStatus(req, res);
    return;
  }
  if (req.url.startsWith('/api/haptics/stop')) {
    handleHapticsStop(req, res);
    return;
  }
  if (req.url.startsWith('/api/haptics/play')) {
    handleHapticsPlay(req, res);
    return;
  }
  if (req.url.startsWith('/api/archive/')) {
    handleArchiveDelete(req, res);
    return;
  }
  if (req.url.startsWith('/api/admin/login')) {
    handleAdminLogin(req, res);
    return;
  }
  if (req.url.startsWith('/api/analyze')) {
    handleAnalyze(req, res);
    return;
  }
  serveStatic(req, res);
});

startHapticBonjourDiscovery();

server.listen(PORT, HOST, () => {
  const aiState = OPENAI_API_KEY ? `OpenAI model ${OPENAI_MODEL}` : 'local fallback only';
  console.log(`soundi 10 running at http://localhost:${PORT}/ (${aiState})`);
});
