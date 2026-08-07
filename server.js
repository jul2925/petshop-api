require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 8000;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const CERT_FILE = path.join(__dirname, 'cert.pem');
const KEY_FILE = path.join(__dirname, 'key.pem');
const DB_FILE = path.join(__dirname, 'shared_data.json');

// ===== MONGODB =====
let mongoClient = null;
let mongoDb = null;
const DB_NAME = process.env.MONGO_DB_NAME || 'petshop_prado';
const COLLECTION = 'appdata';
const DATA_KEY = { _id: 'main' };

async function connectMongo() {
  const mode = process.env.MONGO_MODE || 'local';
  let uri;
  if (mode === 'atlas' && process.env.MONGO_ATLAS_URI) {
    uri = process.env.MONGO_ATLAS_URI;
  } else {
    uri = process.env.MONGO_LOCAL_URI || 'mongodb://localhost:27017';
  }
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    await mongoDb.command({ ping: 1 });
    console.log('[MONGO] Conectado! DB:', DB_NAME);
    return true;
  } catch (e) {
    console.warn('[MONGO] Sem conexao, usando arquivo local:', e.message);
    return false;
  }
}

async function mongoLoad() {
  if (!mongoDb) return null;
  try {
    const doc = await mongoDb.collection(COLLECTION).findOne(DATA_KEY);
    if (doc) { const { _id, ...rest } = doc; return rest; }
  } catch (e) {}
  return null;
}

async function mongoSave(data) {
  if (!mongoDb) return;
  const { _id, ...toSave } = data;
  await mongoDb.collection(COLLECTION).replaceOne(DATA_KEY, toSave, { upsert: true });
}

// ===== JSON FILE FALLBACK =====
function fileLoad() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {}
  return null;
}

function fileSave(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ===== UNIFIED LOAD/SAVE =====
let lastDataVersion = 0;

async function loadData() {
  let data = await mongoLoad();
  if (data && data.products) return data;
  data = fileLoad();
  if (data && data.products) return data;
  return null;
}

async function saveData(data) {
  lastDataVersion++;
  try { await mongoSave(data); } catch (e) {}
  try { fileSave(data); } catch (e) {}
}

// ===== SSE =====
let sseClients = [];

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(c => {
    try { c.res.write(msg); return true; } catch (e) { return false; }
  });
}

// ===== UTILS =====
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function getArrayField(field) {
  return loadData().then(d => d ? (d[field] || []) : []);
}

async function setArrayField(field, items) {
  const data = await loadData();
  if (!data) throw new Error('Dados nao encontrados');
  data[field] = items;
  await saveData(data);
  broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now() });
  return items;
}

function getNextId(items) {
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

// ===== STATIC FILES =====
function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
  };
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Nao encontrado'); return; }
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
    res.end(content);
  });
}

// ===== SERVER =====
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const urlPath = (req.url || '/').split('?')[0];
  const method = req.method;

  try {
    // API ROUTES
    if (urlPath === '/api/health') { json(res, 200, { ok: true }); return; }
    if (urlPath === '/api/status') {
      json(res, 200, { version: lastDataVersion, clients: sseClients.length, uptime: process.uptime(), db: mongoDb ? 'mongodb' : 'file' });
      return;
    }
    if (urlPath === '/api/sync' && method === 'GET') {
      const params = new URL(req.url, 'http://x').searchParams;
      const v = parseInt(params.get('v')) || 0;
      if (v > 0 && v >= lastDataVersion) {
        json(res, 200, { updated: false, version: lastDataVersion });
      } else {
        const data = await loadData();
        json(res, 200, { updated: true, version: lastDataVersion, data });
      }
      return;
    }
    if (urlPath === '/api/events' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      res.write(`event: connected\ndata: {"version":${lastDataVersion}}\n\n`);
      const id = Date.now();
      sseClients.push({ id, res });
      req.on('close', () => { sseClients = sseClients.filter(c => c.id !== id); });
      const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch (e) { clearInterval(hb); } }, 30000);
      req.on('close', () => clearInterval(hb));
      return;
    }
    if (urlPath === '/api/load' && method === 'GET') {
      const data = await loadData();
      json(res, 200, data);
      return;
    }
    if (urlPath === '/api/save' && method === 'POST') {
      const parsed = await parseBody(req);
      await saveData(parsed);
      broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now() });
      json(res, 200, { ok: true, version: lastDataVersion });
      return;
    }

    // GENERIC CRUD
    const collections = ['products', 'employees', 'users', 'clients', 'bathGrooming', 'services', 'sales', 'expenses', 'activityLog'];
    for (const col of collections) {
      const apiName = col === 'bathGrooming' ? 'bathgrooming' : col === 'activityLog' ? 'activitylog' : col;
      if (urlPath === `/api/${apiName}` && method === 'GET') {
        json(res, 200, await getArrayField(col));
        return;
      }
      if (urlPath === `/api/${apiName}` && method === 'POST') {
        const body = await parseBody(req);
        const items = await getArrayField(col);
        const item = { id: getNextId(items), ...body };
        items.push(item);
        await setArrayField(col, items);
        json(res, 201, item);
        return;
      }
      const match = urlPath.match(new RegExp(`^/api/${apiName}/(\\d+)$`));
      if (match && method === 'PUT') {
        const id = parseInt(match[1]);
        const body = await parseBody(req);
        const items = await getArrayField(col);
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) { json(res, 404, { error: 'Nao encontrado' }); return; }
        items[idx] = { ...items[idx], ...body, id };
        await setArrayField(col, items);
        json(res, 200, items[idx]);
        return;
      }
      if (match && method === 'DELETE') {
        const id = parseInt(match[1]);
        const items = await getArrayField(col);
        const filtered = items.filter(i => i.id !== id);
        await setArrayField(col, filtered);
        json(res, 200, { ok: true });
        return;
      }
    }

    // SETTINGS
    if (urlPath === '/api/settings' && method === 'GET') {
      const data = await loadData();
      json(res, 200, data ? data.settings || {} : {});
      return;
    }
    if (urlPath === '/api/settings' && method === 'PUT') {
      const body = await parseBody(req);
      const data = await loadData();
      data.settings = { ...data.settings, ...body };
      await saveData(data);
      broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now() });
      json(res, 200, data.settings);
      return;
    }

    // LOGIN
    if (urlPath === '/api/login' && method === 'POST') {
      const { username, password } = await parseBody(req);
      const users = await getArrayField('users');
      const user = users.find(u => u.username === username && u.password === password && u.active);
      if (user) {
        const { password: _, ...safe } = user;
        json(res, 200, { ok: true, user: safe });
      } else {
        json(res, 401, { error: 'Credenciais invalidas' });
      }
      return;
    }

    // BACKUP
    if (urlPath === '/api/backup' && method === 'GET') {
      const data = await loadData();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="backup.json"' });
      res.end(JSON.stringify(data, null, 2));
      return;
    }

    // STATIC FILES
    let fp = urlPath === '/' ? '/index.html' : urlPath;
    serveFile(res, path.join(__dirname, fp));
  } catch (err) {
    console.error('[ERR]', err.message);
    json(res, 500, { error: 'Erro interno' });
  }
});

// ===== START =====
async function start() {
  await connectMongo();
  const data = await loadData();
  if (data && data.nextProductId) lastDataVersion = 1;

  server.listen(PORT, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('  PetShop Prado - Backend Ativo');
    console.log('=========================================');
    console.log(`  URL:  http://localhost:${PORT}`);
    console.log(`  DB:   ${mongoDb ? 'MongoDB' : 'Arquivo local'}`);
    console.log('=========================================');
  });

  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    https.createServer({ cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) }, server.listeners('request')[0]).listen(HTTPS_PORT, '0.0.0.0');
  }
}

process.on('SIGTERM', async () => { if (mongoClient) await mongoClient.close(); process.exit(0); });
process.on('SIGINT', async () => { if (mongoClient) await mongoClient.close(); process.exit(0); });

start();
