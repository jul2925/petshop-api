const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';
const BCRYPT_ROUNDS = 10;

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET nao definido nas variaveis de ambiente');
  process.exit(1);
}

const ALLOWED_ORIGINS = [
  'https://jul2925.github.io',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Nao permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DB_FILE = path.join(__dirname, 'data', 'petshop.json');
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DB = {
  products: [
    {id:1,name:'Racao Premium Cao Adulto 15kg',cat:'Alimentacao',price:189.90,stock:40,minStock:8,unit:'kg',barcode:'7891000001001',emoji:'🐕'},
    {id:2,name:'Racao Premium Gato Adulto 10kg',cat:'Alimentacao',price:159.90,stock:35,minStock:8,unit:'kg',barcode:'7891000001002',emoji:'🐱'},
    {id:3,name:'Racao Filhote Cao 8kg',cat:'Alimentacao',price:129.90,stock:30,minStock:6,unit:'kg',barcode:'7891000001003',emoji:'🐶'},
    {id:4,name:'Racao Filhote Gato 5kg',cat:'Alimentacao',price:99.90,stock:25,minStock:6,unit:'kg',barcode:'7891000001004',emoji:'🐈'},
    {id:5,name:'Racao Senior Cao 12kg',cat:'Alimentacao',price:169.90,stock:20,minStock:5,unit:'kg',barcode:'7891000001006',emoji:'🐕'},
    {id:6,name:'Petisco Dental Cao 150g',cat:'Alimentacao',price:24.90,stock:60,minStock:10,unit:'g',barcode:'7891000001007',emoji:'🦴'},
    {id:7,name:'Petisco Gato Tubo 20g x6',cat:'Alimentacao',price:18.90,stock:80,minStock:12,unit:'un',barcode:'7891000001008',emoji:'🐟'},
    {id:8,name:'Ossinho Defumado 120g',cat:'Alimentacao',price:19.90,stock:50,minStock:10,unit:'g',barcode:'7891000001009',emoji:'🦴'},
    {id:9,name:'Sache Frango Gato 85g',cat:'Alimentacao',price:5.90,stock:200,minStock:30,unit:'g',barcode:'7891000001010',emoji:'🍗'},
    {id:10,name:'Sache Carne Gato 85g',cat:'Alimentacao',price:5.90,stock:180,minStock:30,unit:'g',barcode:'7891000001011',emoji:'🥩'},
    {id:11,name:'Shampoo Neutro Cao 500ml',cat:'Higiene',price:32.90,stock:40,minStock:8,unit:'ml',barcode:'7891000001012',emoji:'🧴'},
    {id:12,name:'Shampoo Antipulga 500ml',cat:'Higiene',price:39.90,stock:35,minStock:8,unit:'ml',barcode:'7891000001013',emoji:'🧴'},
    {id:13,name:'Areia Sanitaria Silica 5kg',cat:'Higiene',price:29.90,stock:80,minStock:15,unit:'kg',barcode:'7891000001015',emoji:'🧱'},
    {id:14,name:'Areia Sanitaria Bentonita 10kg',cat:'Higiene',price:24.90,stock:60,minStock:12,unit:'kg',barcode:'7891000001016',emoji:'🧱'},
    {id:15,name:'Perfume Pet Spray 120ml',cat:'Higiene',price:28.90,stock:45,minStock:8,unit:'ml',barcode:'7891000001018',emoji:'🌸'},
    {id:16,name:'Coleira Couro Pequena',cat:'Acessorios',price:49.90,stock:25,minStock:5,unit:'un',barcode:'7891000001021',emoji:'📿'},
    {id:17,name:'Coleira Couro Media',cat:'Acessorios',price:59.90,stock:25,minStock:5,unit:'un',barcode:'7891000001022',emoji:'📿'},
    {id:18,name:'Coleira Couro Grande',cat:'Acessorios',price:69.90,stock:20,minStock:5,unit:'un',barcode:'7891000001023',emoji:'📿'},
    {id:19,name:'Guia de Passeio Retractil',cat:'Acessorios',price:44.90,stock:30,minStock:6,unit:'un',barcode:'7891000001024',emoji:'🔗'},
    {id:20,name:'Bolinha de Silicone',cat:'Brinquedos',price:14.90,stock:100,minStock:15,unit:'un',emoji:'⚽'},
    {id:21,name:'Ratinho de Pelucia x3',cat:'Brinquedos',price:22.90,stock:60,minStock:10,unit:'un',emoji:'🐭'},
    {id:22,name:'Corda Trancada Cao',cat:'Brinquedos',price:29.90,stock:45,minStock:8,unit:'un',emoji:'🪢'},
    {id:23,name:'Casinha Cao Medio',cat:'Casas e Camas',price:189.90,stock:15,minStock:3,unit:'un',emoji:'🏠'},
    {id:24,name:'Cama Peluda Oval P',cat:'Casas e Camas',price:89.90,stock:20,minStock:5,unit:'un',emoji:'🛏️'},
    {id:25,name:'Cama Peluda Oval M',cat:'Casas e Camas',price:119.90,stock:15,minStock:4,unit:'un',emoji:'🛏️'},
    {id:26,name:'Caixa de Transporte P',cat:'Transporte',price:79.90,stock:20,minStock:5,unit:'un',emoji:'📦'},
    {id:27,name:'Caixa de Transporte M',cat:'Transporte',price:99.90,stock:15,minStock:4,unit:'un',emoji:'📦'},
    {id:28,name:'Comedouro Inox P',cat:'Acessorios',price:29.90,stock:40,minStock:8,unit:'un',emoji:'🥣'},
    {id:29,name:'Comedouro Inox M',cat:'Acessorios',price:34.90,stock:35,minStock:8,unit:'un',emoji:'🥣'},
    {id:30,name:'Bebedouro Automatico 2L',cat:'Acessorios',price:79.90,stock:20,minStock:5,unit:'un',emoji:'💧'},
    {id:31,name:'Antipulga Cao P 4un',cat:'Saude',price:59.90,stock:40,minStock:8,unit:'un',emoji:'💊'},
    {id:32,name:'Antipulga Cao G 4un',cat:'Saude',price:79.90,stock:30,minStock:6,unit:'un',emoji:'💊'},
    {id:33,name:'Antipulga Gato 3un',cat:'Saude',price:54.90,stock:35,minStock:8,unit:'un',emoji:'💊'},
    {id:34,name:'Vermifugo Cao 2un',cat:'Saude',price:39.90,stock:50,minStock:10,unit:'un',emoji:'💊'},
    {id:35,name:'Vermifugo Gato 2un',cat:'Saude',price:34.90,stock:45,minStock:10,unit:'un',emoji:'💊'},
    {id:36,name:'Vacina V10 Cao',cat:'Saude',price:89.90,stock:20,minStock:5,unit:'un',emoji:'💉'},
    {id:37,name:'Vacina V4 Gato',cat:'Saude',price:79.90,stock:20,minStock:5,unit:'un',emoji:'💉'},
    {id:38,name:'Vitamina Pet 250ml',cat:'Saude',price:44.90,stock:30,minStock:6,unit:'ml',emoji:'🧪'},
    {id:39,name:'Roupa Pet Estampada P',cat:'Roupas',price:39.90,stock:20,minStock:5,unit:'un',emoji:'👗'},
    {id:40,name:'Roupa Pet Estampada M',cat:'Roupas',price:49.90,stock:20,minStock:5,unit:'un',emoji:'👗'}
  ],
  employees: [
    {id:1,name:'Carlos Silva',role:'Caixa',shift:'Manha',salary:2200,active:true,phone:'(11)99999-1111'},
    {id:2,name:'Maria Santos',role:'Estoque',shift:'Tarde',salary:2400,active:true,phone:'(11)99999-2222'},
    {id:3,name:'Joao Oliveira',role:'Gerente',shift:'Manha',salary:4500,active:true,phone:'(11)99999-3333'}
  ],
  users: [],
  clients: [
    {id:1,name:'Joao Pereira',phone:'(11)98888-1001',cpf:'123.456.789-00',email:'joao@email.com',address:'Rua das Flores, 100 - SP',active:true,dogs:[]},
    {id:2,name:'Ana Beatriz',phone:'(11)98888-1002',cpf:'987.654.321-00',email:'ana@email.com',address:'Av. Brasil, 200 - SP',active:true,dogs:[{name:'Rex',breed:'Labrador',age:3,color:'Dourado'}]},
    {id:3,name:'Carlos Mendes',phone:'(11)98888-1003',cpf:'456.789.123-00',email:'carlos@email.com',address:'Rua Augusta, 300 - SP',active:true,dogs:[{name:'Thor',breed:'Bulldog',age:4,color:'Marrom'}]}
  ],
  bathGrooming: [
    {id:1,clientId:2,dogName:'Rex',service:'Banho e Tosa Completa',date:new Date(Date.now()-86400000*2).toISOString(),price:120,status:'Concluido',notes:'Cachorro calmo',professional:'Maria Santos'},
    {id:2,clientId:2,dogName:'Luna',service:'Banho Simples',date:new Date(Date.now()-86400000).toISOString(),price:60,status:'Concluido',notes:'Usar shampoo hipoalergenico',professional:'Ana Costa'}
  ],
  sales: [],
  expenses: [],
  activityLog: [],
  nextProductId: 41,
  nextEmployeeId: 4,
  nextUserId: 4,
  nextSaleId: 1,
  nextClientId: 4,
  nextBathId: 3,
  nextExpenseId: 1,
  settings: {
    pixKey: '',
    pixName: 'PetShop Prado',
    pixCity: 'Sao Paulo',
    scale: { mode:'serial', protocol:'toledo', baudRate:9600, dataBits:8, stopBits:1, parity:'none', unitDefault:'kg', stableTimeout:2000, decimals:3 },
    company: { name:'', fantasyName:'', cnpj:'', cpf:'', ie:'', im:'', address:'', number:'', complement:'', neighborhood:'', city:'', state:'', zip:'', phone:'', phone2:'', email:'', website:'', activity:'', logo:'', motto:'' }
  }
};

const DEFAULT_USERS = [
  {id:1,username:'admin',password:'admin123',name:'Administrador Geral',type:'admin',active:true},
  {id:2,username:'func',password:'func123',name:'Funcionario Teste',type:'func',active:true},
  {id:3,username:'cliente',password:'cli123',name:'Cliente Teste',type:'cliente',active:true}
];

function loadFromFile() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.products) return data;
    }
  } catch (e) {
    console.error('[ERRO] Ao ler arquivo:', e.message);
  }
  return null;
}

function saveToFile(data) {
  try {
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, path.join(DATA_DIR, 'petshop.backup.json'));
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[ERRO] Ao salvar arquivo:', e.message);
    return false;
  }
}

async function initDefaultUsers() {
  let data = loadFromFile();
  if (!data) {
    data = Object.assign({}, DEFAULT_DB);
    data.users = [];
    saveToFile(data);
  }

  if (!data.users) data.users = [];
  if (!data.nextUserId) data.nextUserId = 1;

  for (const defUser of DEFAULT_USERS) {
    const exists = data.users.find(u => u.username === defUser.username);
    if (!exists) {
      const hashedPassword = await bcrypt.hash(defUser.password, BCRYPT_ROUNDS);
      data.users.push({
        id: data.nextUserId++,
        username: defUser.username,
        password: hashedPassword,
        name: defUser.name,
        type: defUser.type,
        active: defUser.active
      });
      console.log(`[INIT] Usuario "${defUser.username}" criado com senha hasheada`);
    } else {
      const isHashed = exists.password && exists.password.startsWith('$2');
      if (!isHashed) {
        exists.password = await bcrypt.hash(exists.password, BCRYPT_ROUNDS);
        console.log(`[INIT] Senha de "${defUser.username}" hasheada pela primeira vez`);
      }
    }
  }
  saveToFile(data);
  console.log(`[INIT] ${data.users.length} usuarios verificados no banco`);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, type: user.type, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticacao necessario' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

function removePassword(user) {
  const u = Object.assign({}, user);
  delete u.password;
  return u;
}

// ===== PUBLIC ROUTES =====

app.get('/api/status', (req, res) => {
  const data = loadFromFile();
  res.json({
    status: 'online',
    version: '2.1.0',
    products: data ? data.products.length : 0,
    users: data ? data.users.length : 0,
    clients: data ? data.clients.length : 0,
    sales: data ? data.sales.length : 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario e senha sao obrigatorios' });
    }

    let data = loadFromFile();
    if (!data) {
      data = Object.assign({}, DEFAULT_DB);
      data.users = [];
      saveToFile(data);
    }

    const user = (data.users || []).find(u => u.username === username && u.active);
    if (!user) {
      return res.status(401).json({ error: 'Usuario ou senha invalidos' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Usuario ou senha invalidos' });
    }

    const token = generateToken(user);

    console.log(`[LOGIN] ${user.username} (${user.type}) logado com sucesso`);

    res.json({
      token,
      user: removePassword(user)
    });
  } catch (e) {
    console.error('[ERRO] /api/auth/login:', e.message);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

app.post('/api/auth/validate', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let data = loadFromFile();
    if (!data) return res.json({ valid: false });
    const user = (data.users || []).find(u => u.id === decoded.id && u.active);
    if (!user) return res.json({ valid: false });
    res.json({ valid: true, user: removePassword(user) });
  } catch (e) {
    res.json({ valid: false });
  }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha sao obrigatorias' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 4 caracteres' });
    }

    let data = loadFromFile();
    if (!data) return res.status(500).json({ error: 'Dados nao encontrados' });

    const user = (data.users || []).find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    saveToFile(data);

    console.log(`[AUTH] ${user.username} alterou a senha`);
    res.json({ ok: true, message: 'Senha alterada com sucesso' });
  } catch (e) {
    console.error('[ERRO] /api/auth/change-password:', e.message);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

app.post('/api/auth/create-user', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password, name, type } = req.body;
    if (!username || !password || !name || !type) {
      return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
    }
    if (!['admin', 'func', 'cliente'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de usuario invalido' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres' });
    }

    let data = loadFromFile();
    if (!data) return res.status(500).json({ error: 'Dados nao encontrados' });
    if (!data.users) data.users = [];
    if (!data.nextUserId) data.nextUserId = 1;

    const exists = data.users.find(u => u.username === username);
    if (exists) return res.status(400).json({ error: 'Nome de usuario ja existe' });

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const newUser = {
      id: data.nextUserId++,
      username,
      password: hashedPassword,
      name,
      type,
      active: true
    };
    data.users.push(newUser);
    saveToFile(data);

    console.log(`[ADMIN] Novo usuario "${username}" (${type}) criado por ${req.user.username}`);
    res.json({ ok: true, user: removePassword(newUser) });
  } catch (e) {
    console.error('[ERRO] /api/auth/create-user:', e.message);
    res.status(500).json({ error: 'Erro ao criar usuario' });
  }
});

// ===== PROTECTED DATA ROUTES =====

app.get('/api/load', authMiddleware, (req, res) => {
  try {
    let data = loadFromFile();
    if (!data) {
      data = Object.assign({}, DEFAULT_DB);
      data.users = [];
      saveToFile(data);
    }

    if (req.user.type !== 'admin') {
      delete data.activityLog;
    }

    res.json(data);
  } catch (e) {
    console.error('[ERRO] /api/load:', e.message);
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

app.post('/api/save', authMiddleware, (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.products) {
      return res.status(400).json({ error: 'Dados invalidos' });
    }

    if (req.user.type !== 'admin') {
      if (data.settings) delete data.settings;
      if (data.activityLog) delete data.activityLog;
    }

    const saved = saveToFile(data);
    if (saved) {
      res.json({ ok: true, message: 'Dados salvos com sucesso' });
    } else {
      res.status(500).json({ error: 'Erro ao salvar arquivo' });
    }
  } catch (e) {
    console.error('[ERRO] /api/save:', e.message);
    res.status(500).json({ error: 'Erro ao salvar dados' });
  }
});

app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
  try {
    let data = loadFromFile();
    if (!data || !data.users) return res.json([]);
    const safeUsers = data.users.map(u => removePassword(u));
    res.json(safeUsers);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao listar usuarios' });
  }
});

app.put('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, type, active, password } = req.body;

    let data = loadFromFile();
    if (!data) return res.status(500).json({ error: 'Dados nao encontrados' });

    const user = (data.users || []).find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

    if (name) user.name = name;
    if (type && ['admin', 'func', 'cliente'].includes(type)) user.type = type;
    if (active !== undefined) user.active = active;
    if (password && password.length >= 4) {
      user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    saveToFile(data);
    console.log(`[ADMIN] Usuario "${user.username}" atualizado por ${req.user.username}`);
    res.json({ ok: true, user: removePassword(user) });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao atualizar usuario' });
  }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    let data = loadFromFile();
    if (!data) return res.status(500).json({ error: 'Dados nao encontrados' });

    const user = (data.users || []).find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'Nao e possivel excluir seu proprio usuario' });

    user.active = false;
    saveToFile(data);
    console.log(`[ADMIN] Usuario "${user.username}" desativado por ${req.user.username}`);
    res.json({ ok: true, message: 'Usuario desativado' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir usuario' });
  }
});

app.delete('/api/reset', authMiddleware, adminOnly, (req, res) => {
  try {
    const data = Object.assign({}, DEFAULT_DB);
    data.users = [];
    saveToFile(data);
    initDefaultUsers();
    console.log(`[ADMIN] Dados resetados por ${req.user.username}`);
    res.json({ ok: true, message: 'Dados resetados para padrao' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao resetar dados' });
  }
});

// ===== API INFO (sem static files) =====

app.get('/', (req, res) => {
  res.json({
    name: 'PetShop Prado API',
    version: '2.1.0',
    status: 'online',
    endpoints: {
      public: {
        status: 'GET /api/status',
        login: 'POST /api/auth/login',
        validate: 'POST /api/auth/validate'
      },
      protected: {
        load: 'GET /api/load',
        save: 'POST /api/save',
        changePassword: 'POST /api/auth/change-password'
      },
      admin: {
        createUser: 'POST /api/auth/create-user',
        listUsers: 'GET /api/users',
        editUser: 'PUT /api/users/:id',
        disableUser: 'DELETE /api/users/:id',
        reset: 'DELETE /api/reset'
      }
    }
  });
});

// ===== START =====

const server = initDefaultUsers().then(() => {
  const instance = app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('   PetShop Prado - API v2.1.0');
    console.log('========================================');
    console.log(`Porta: ${PORT}`);
    console.log(`DB: ${DB_FILE}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
    console.log('========================================');
  });

  // Graceful Shutdown
  const shutdown = async (signal) => {
    console.log(`\n[${signal}] Encerrando servidor...`);
    instance.close(() => {
      console.log('[OK] Servidor encerrado graciosamente');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[FATAL] Forcando encerramento');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return instance;
}).catch(e => {
  console.error('[FATAL] Erro ao inicializar:', e);
  process.exit(1);
});
