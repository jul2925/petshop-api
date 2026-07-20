const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== ARQUIVO DE DADOS =====
const DB_FILE = path.join(__dirname, 'data', 'petshop.json');
const DATA_DIR = path.join(__dirname, 'data');

// Criar pasta data se nao existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ===== DADOS PADRAO =====
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
  users: [
    {id:1,username:'admin',password:'admin123',name:'Administrador Geral',type:'admin',active:true},
    {id:2,username:'func',password:'func123',name:'Funcionario Teste',type:'func',active:true},
    {id:3,username:'cliente',password:'cli123',name:'Cliente Teste',type:'cliente',active:true}
  ],
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
    scale: {
      mode: 'serial',
      protocol: 'toledo',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      unitDefault: 'kg',
      stableTimeout: 2000,
      decimals: 3
    },
    company: {
      name: '',
      fantasyName: '',
      cnpj: '',
      cpf: '',
      ie: '',
      im: '',
      address: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      phone2: '',
      email: '',
      website: '',
      activity: '',
      logo: '',
      motto: ''
    }
  }
};

// ===== FUNCOES DE ARQUIVO =====
function loadFromFile() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && data.products) {
        return data;
      }
    }
  } catch (e) {
    console.error('[ERRO] Ao ler arquivo:', e.message);
  }
  return null;
}

function saveToFile(data) {
  try {
    // Backup do arquivo anterior
    if (fs.existsSync(DB_FILE)) {
      const backupFile = path.join(DATA_DIR, 'petshop.backup.json');
      fs.copyFileSync(DB_FILE, backupFile);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[ERRO] Ao salvar arquivo:', e.message);
    return false;
  }
}

// ===== ROTAS DA API =====

// GET /api/load - Carregar dados
app.get('/api/load', (req, res) => {
  try {
    let data = loadFromFile();
    if (!data) {
      console.log('[INFO] Nenhum arquivo encontrado, criando com dados padrao...');
      data = DEFAULT_DB;
      saveToFile(data);
    }
    res.json(data);
  } catch (e) {
    console.error('[ERRO] /api/load:', e.message);
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

// POST /api/save - Salvar dados
app.post('/api/save', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.products) {
      return res.status(400).json({ error: 'Dados invalidos' });
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

// GET /api/status - Status do servidor
app.get('/api/status', (req, res) => {
  const data = loadFromFile();
  res.json({
    status: 'online',
    version: '1.0.0',
    products: data ? data.products.length : 0,
    users: data ? data.users.length : 0,
    clients: data ? data.clients.length : 0,
    sales: data ? data.sales.length : 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// DELETE /api/reset - Resetar dados (cuidado!)
app.delete('/api/reset', (req, res) => {
  try {
    saveToFile(DEFAULT_DB);
    console.log('[AVISO] Dados resetados!');
    res.json({ ok: true, message: 'Dados resetados para padrao' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao resetar dados' });
  }
});

// ===== SERVIR ARQUIVOS ESTATICOS =====
app.use(express.static(path.join(__dirname)));

// Rota fallback - servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('   PetShop Prado - Servidor API');
  console.log('========================================');
  console.log(`Porta: ${PORT}`);
  console.log(`Arquivo DB: ${DB_FILE}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'desenvolvimento'}`);
  console.log('========================================');
  console.log('Endpoints:');
  console.log('  GET  /api/load   - Carregar dados');
  console.log('  POST /api/save   - Salvar dados');
  console.log('  GET  /api/status - Status do servidor');
  console.log('========================================');
});
