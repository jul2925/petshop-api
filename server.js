require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mongo = require('./mongo');

const PORT = process.env.PORT || 8000;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const CERT_FILE = path.join(__dirname, 'cert.pem');
const KEY_FILE = path.join(__dirname, 'key.pem');
const STATIC_DIR = __dirname;

let sseClients = [];
let lastDataVersion = 0;

// ===== UTILS =====
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Arquivo nao encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[ext] || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(content);
  });
}

// ===== SSE =====
function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(client => {
    try {
      client.res.write(msg);
      return true;
    } catch (e) {
      return false;
    }
  });
}

// ===== MONGO DATA LAYER =====
const COLLECTION = 'appdata';
const DATA_KEY = { _id: 'main' };

async function loadData() {
  try {
    const doc = await mongo.findOne(COLLECTION, DATA_KEY);
    if (doc) {
      const { _id, ...rest } = doc;
      return rest;
    }
  } catch (e) {
    console.error('[DB] Erro ao ler dados:', e.message);
  }
  return null;
}

async function saveData(data) {
  lastDataVersion++;
  const { _id, ...toSave } = data;
  await mongo.replaceOne(COLLECTION, DATA_KEY, toSave);
}

// ===== GENERIC CRUD HELPER =====
async function getArrayField(field) {
  const data = await loadData();
  return data ? (data[field] || []) : [];
}

async function setArrayField(field, items) {
  const data = await loadData();
  if (!data) throw new Error('Dados nao encontrados');
  data[field] = items;
  await saveData(data);
  broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now(), field });
  return items;
}

function getNextId(items) {
  if (!items || items.length === 0) return 1;
  return Math.max(...items.map(i => i.id || 0)) + 1;
}

// ===== ROUTES =====
function parseUrl(req) {
  const [pathPart, queryString] = (req.url || '/').split('?');
  const params = {};
  if (queryString) {
    queryString.split('&').forEach(p => {
      const [k, v] = p.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { path: pathPart, params, method: req.method };
}

async function handleApi(req, res) {
  const { path, params, method } = parseUrl(req);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return true;
  }

  // ===== SYSTEM =====

  // Health check
  if (path === '/api/health' && method === 'GET') {
    json(res, 200, { ok: true, uptime: process.uptime() });
    return true;
  }

  // Status
  if (path === '/api/status' && method === 'GET') {
    json(res, 200, {
      version: lastDataVersion,
      clients: sseClients.length,
      uptime: process.uptime(),
      db: 'mongodb',
      dbName: process.env.MONGO_DB_NAME || 'petshop_prado',
      mode: process.env.MONGO_MODE || 'local'
    });
    return true;
  }

  // ===== SSE =====
  if (path === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`event: connected\ndata: {"version":${lastDataVersion}}\n\n`);

    const clientId = Date.now();
    sseClients.push({ id: clientId, res });
    console.log(`[SSE] Cliente conectado (${sseClients.length} total)`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c.id !== clientId);
      console.log(`[SSE] Cliente desconectado (${sseClients.length} total)`);
    });

    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch (e) { clearInterval(heartbeat); }
    }, 30000);
    req.on('close', () => clearInterval(heartbeat));
    return true;
  }

  // ===== FULL DATA (compatibilidade com client antigo) =====

  // Load - carregar todos os dados
  if (path === '/api/load' && method === 'GET') {
    const data = await loadData();
    json(res, 200, data);
    return true;
  }

  // Save - salvar todos os dados
  if (path === '/api/save' && method === 'POST') {
    try {
      const parsed = await parseBody(req);
      await saveData(parsed);
      broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now() });
      json(res, 200, { ok: true, version: lastDataVersion });
      console.log(`[SAVE] Dados salvos (v${lastDataVersion}) e notificados ${sseClients.length} clientes`);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return true;
  }

  // ===== PRODUCTS CRUD =====
  if (path === '/api/products' && method === 'GET') {
    const items = await getArrayField('products');
    json(res, 200, items);
    return true;
  }

  if (path === '/api/products' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('products');
      const nextId = getNextId(items);
      const item = { id: nextId, ...body };
      items.push(item);
      await setArrayField('products', items);
      json(res, 201, item);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return true;
  }

  if (path.match(/^\/api\/products\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('products');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Produto nao encontrado' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('products', items);
      json(res, 200, items[idx]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return true;
  }

  if (path.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('products');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Produto nao encontrado' }); return true; }
      await setArrayField('products', filtered);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return true;
  }

  // ===== EMPLOYEES CRUD =====
  if (path === '/api/employees' && method === 'GET') {
    json(res, 200, await getArrayField('employees'));
    return true;
  }

  if (path === '/api/employees' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('employees');
      const item = { id: getNextId(items), ...body };
      items.push(item);
      await setArrayField('employees', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/employees\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('employees');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Funcionario nao encontrado' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('employees', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/employees\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('employees');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Funcionario nao encontrado' }); return true; }
      await setArrayField('employees', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== USERS CRUD =====
  if (path === '/api/users' && method === 'GET') {
    json(res, 200, await getArrayField('users'));
    return true;
  }

  if (path === '/api/users' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('users');
      const item = { id: getNextId(items), ...body };
      items.push(item);
      await setArrayField('users', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/users\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('users');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Usuario nao encontrado' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('users', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/users\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('users');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Usuario nao encontrado' }); return true; }
      await setArrayField('users', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== CLIENTS CRUD =====
  if (path === '/api/clients' && method === 'GET') {
    json(res, 200, await getArrayField('clients'));
    return true;
  }

  if (path === '/api/clients' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('clients');
      const item = { id: getNextId(items), active: true, dogs: [], ...body };
      items.push(item);
      await setArrayField('clients', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/clients\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('clients');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Cliente nao encontrado' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('clients', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/clients\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('clients');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Cliente nao encontrado' }); return true; }
      await setArrayField('clients', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== BATH & GROOMING CRUD =====
  if (path === '/api/bathgrooming' && method === 'GET') {
    json(res, 200, await getArrayField('bathGrooming'));
    return true;
  }

  if (path === '/api/bathgrooming' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('bathGrooming');
      const item = { id: getNextId(items), date: new Date().toISOString(), status: 'Agendado', ...body };
      items.push(item);
      await setArrayField('bathGrooming', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/bathgrooming\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('bathGrooming');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Agendamento nao encontrado' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('bathGrooming', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/bathgrooming\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('bathGrooming');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Agendamento nao encontrado' }); return true; }
      await setArrayField('bathGrooming', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== SERVICES CRUD =====
  if (path === '/api/services' && method === 'GET') {
    json(res, 200, await getArrayField('services'));
    return true;
  }

  if (path === '/api/services' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('services');
      const item = { id: getNextId(items), active: true, ...body };
      items.push(item);
      await setArrayField('services', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/services\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('services');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Servico nao encontrado' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('services', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/services\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('services');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Servico nao encontrado' }); return true; }
      await setArrayField('services', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== SALES CRUD =====
  if (path === '/api/sales' && method === 'GET') {
    json(res, 200, await getArrayField('sales'));
    return true;
  }

  if (path === '/api/sales' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('sales');
      const item = { id: getNextId(items), date: new Date().toISOString(), status: 'concluido', ...body };
      items.push(item);
      await setArrayField('sales', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/sales\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('sales');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Venda nao encontrada' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('sales', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/sales\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('sales');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Venda nao encontrada' }); return true; }
      await setArrayField('sales', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== EXPENSES CRUD =====
  if (path === '/api/expenses' && method === 'GET') {
    json(res, 200, await getArrayField('expenses'));
    return true;
  }

  if (path === '/api/expenses' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('expenses');
      const item = { id: getNextId(items), date: new Date().toISOString(), ...body };
      items.push(item);
      await setArrayField('expenses', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/expenses\/\d+$/) && method === 'PUT') {
    try {
      const id = parseInt(path.split('/').pop());
      const body = await parseBody(req);
      const items = await getArrayField('expenses');
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) { json(res, 404, { error: 'Despesa nao encontrada' }); return true; }
      items[idx] = { ...items[idx], ...body, id };
      await setArrayField('expenses', items);
      json(res, 200, items[idx]);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  if (path.match(/^\/api\/expenses\/\d+$/) && method === 'DELETE') {
    try {
      const id = parseInt(path.split('/').pop());
      const items = await getArrayField('expenses');
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) { json(res, 404, { error: 'Despesa nao encontrada' }); return true; }
      await setArrayField('expenses', filtered);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== ACTIVITY LOG =====
  if (path === '/api/activitylog' && method === 'GET') {
    json(res, 200, await getArrayField('activityLog'));
    return true;
  }

  if (path === '/api/activitylog' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const items = await getArrayField('activityLog');
      const item = { date: new Date().toISOString(), ...body };
      items.unshift(item);
      if (items.length > 500) items.length = 500;
      await setArrayField('activityLog', items);
      json(res, 201, item);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== SETTINGS =====
  if (path === '/api/settings' && method === 'GET') {
    const data = await loadData();
    json(res, 200, data ? data.settings || {} : {});
    return true;
  }

  if (path === '/api/settings' && method === 'PUT') {
    try {
      const body = await parseBody(req);
      const data = await loadData();
      if (!data) { json(res, 404, { error: 'Dados nao encontrados' }); return true; }
      data.settings = { ...data.settings, ...body };
      await saveData(data);
      broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now(), field: 'settings' });
      json(res, 200, data.settings);
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== LOGIN =====
  if (path === '/api/login' && method === 'POST') {
    try {
      const { username, password } = await parseBody(req);
      const users = await getArrayField('users');
      const user = users.find(u => u.username === username && u.password === password && u.active);
      if (user) {
        const { password: _, ...safeUser } = user;
        json(res, 200, { ok: true, user: safeUser });
      } else {
        json(res, 401, { error: 'Usuario ou senha invalidos' });
      }
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== SEED (recriar dados) =====
  if (path === '/api/seed' && method === 'POST') {
    try {
      const DEFAULT_DB = require('./seed-data');
      await saveData(DEFAULT_DB);
      json(res, 200, { ok: true, message: 'Dados iniciais restaurados' });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // ===== BACKUP (exportar dados) =====
  if (path === '/api/backup' && method === 'GET') {
    const data = await loadData();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="petshop-prado-backup.json"'
    });
    res.end(JSON.stringify(data, null, 2));
    return true;
  }

  // ===== RESTORE (importar dados) =====
  if (path === '/api/restore' && method === 'POST') {
    try {
      const parsed = await parseBody(req);
      if (!parsed || !parsed.products) {
        json(res, 400, { error: 'Dados de backup invalidos' });
        return true;
      }
      await saveData(parsed);
      broadcastSSE('update', { version: lastDataVersion, timestamp: Date.now() });
      json(res, 200, { ok: true, message: 'Dados restaurados com sucesso' });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  return false;
}

// ===== HTTP SERVER =====
const server = http.createServer(async (req, res) => {
  try {
    // Tenta API primeiro
    if (req.url.startsWith('/api/')) {
      const handled = await handleApi(req, res);
      if (handled) return;
    }

    // Arquivos estaticos
    let filePath = (req.url || '/').split('?')[0];
    filePath = filePath === '/' ? '/index.html' : filePath;
    filePath = path.join(STATIC_DIR, filePath);
    serveFile(res, filePath);
  } catch (err) {
    console.error('[SERVER] Erro:', err.message);
    json(res, 500, { error: 'Erro interno do servidor' });
  }
});

// ===== INICIALIZACAO =====
async function start() {
  try {
    await mongo.connect();
    await mongo.createIndex('appdata', '_id');

    const data = await loadData();
    if (data && data.nextProductId) {
      lastDataVersion = 1;
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log('=========================================');
      console.log('  PetShop Prado - Backend Ativo');
      console.log('=========================================');
      console.log(`  HTTP:     http://localhost:${PORT}`);
      console.log(`  Status:   http://localhost:${PORT}/api/status`);
      console.log(`  Health:   http://localhost:${PORT}/api/health`);
      console.log(`  API:      http://localhost:${PORT}/api/load`);
      console.log(`  SSE:      http://localhost:${PORT}/api/events`);
      console.log(`  MongoDB:  ${process.env.MONGO_MODE || 'local'}`);
      console.log('=========================================');

      // HTTPS (apenas local, se certificados existirem)
      if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
        const httpsOptions = {
          cert: fs.readFileSync(CERT_FILE),
          key: fs.readFileSync(KEY_FILE)
        };
        const httpsServer = https.createServer(httpsOptions, server.listeners('request')[0]);
        httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
          console.log(`[HTTPS] Servidor HTTPS ativo na porta ${HTTPS_PORT}`);
        });
      }
    });
  } catch (err) {
    console.error('[FATAL] Erro ao iniciar:', err.message);
    process.exit(1);
  }
}

// ===== TRAY (apenas Windows/local) =====
if (process.platform === 'win32' && !process.env.RENDER) {
  try {
    const SysTray = require('systray2').default;
    function readIconBuffer() {
      const iconPath = path.join(__dirname, 'icon.png');
      try {
        if (fs.existsSync(iconPath)) {
          const buf = fs.readFileSync(iconPath);
          if (buf.length > 0 && buf.length < 100000) return buf;
        }
      } catch (e) {}
      return null;
    }
    const iconBase64 = readIconBuffer();
    const menuConfig = {
      title: 'PetShop Prado',
      tooltip: 'PetShop Prado - Servidor',
      items: [
        { title: 'Abrir no Navegador', tooltip: '', checked: false, enabled: true },
        { title: 'Status', tooltip: '', checked: false, enabled: true },
        { type: 'separator' },
        { title: 'Sair', tooltip: '', checked: false, enabled: true }
      ]
    };
    if (iconBase64) menuConfig.icon = iconBase64;
    const systray = new SysTray({ menu: menuConfig });
    systray.ready().then(() => {
      console.log('[TRAY] Icone da bandeja criado!');
      systray.onClick(action => {
        if (action.item.title === 'Abrir no Navegador') {
          require('child_process').exec(`start http://localhost:${PORT}`);
        } else if (action.item.title === 'Sair') {
          mongo.close().then(() => { systray.kill(true).then(() => process.exit(0)); });
        }
      });
    }).catch(() => {});
  } catch (e) {}
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[SERVER] Encerrando...');
  await mongo.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongo.close();
  process.exit(0);
});

start();
