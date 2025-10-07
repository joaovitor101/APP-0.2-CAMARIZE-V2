import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Carrega as variáveis de ambiente
dotenv.config();

import userRoutes from './routes/userRoutes.js';
import fazendaRoutes from './routes/fazendaRoutes.js';
import cativeiroRoutes from './routes/cativeiroRoutes.js';
import camaraoRoutes from './routes/camaraoRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import usuariosxFazendasRoutes from './routes/usuariosxFazendasRoutes.js';
import sensoresxCativeirosRoutes from './routes/sensoresxCativeirosRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import testRoutes from './routes/testRoutes.js';
import parametrosRoutes from './routes/parametrosRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import dietaRoutes from './routes/dietaRoutes.js';

// Importar serviço de monitoramento
import monitoringService from './services/monitoringService.js';

// Carrega todos os modelos para garantir que as coleções sejam criadas
import './models/SensoresxCativeiros.js';
import './models/FazendasxCativeiros.js';
import './models/UsuariosxFazendas.js';

const app = express();
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  // Permitir domínios ngrok
  /^https:\/\/.*\.ngrok-free\.app$/,
  /^https:\/\/.*\.ngrok\.io$/,
  // Permitir domínios Vercel
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.vercel\.dev$/,
  // Permitir domínios Render
  /^https:\/\/.*\.onrender\.com$/,
  // Permitir qualquer origem durante desenvolvimento
  "*"
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sem origin (como mobile apps)
    if (!origin) return callback(null, true);
    
    // Em produção, ser mais permissivo para evitar problemas
    if (process.env.NODE_ENV === 'production') {
      console.log('🌐 Origin permitida (produção):', origin);
      return callback(null, true);
    }
    
    // Verificar se a origin está na lista permitida
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('🚫 Origin bloqueada:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
}));


// 🧠 Esses dois devem vir ANTES das rotas
app.use(express.json({ limit: '10mb'}));
app.use(express.urlencoded({ extended: false }));

// 🧪 Log básico para cada requisição
app.use((req, res, next) => {
  console.log('Rota acessada:', req.method, req.url);
  next();
});

// ✅ Rota raiz para health check
app.get('/', (req, res) => {
  res.json({
    message: '🚀 API Camarize funcionando!',
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ✅ Rota de health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ✅ Registra as rotas
app.use('/users', userRoutes);
app.use('/fazendas', fazendaRoutes);
app.use('/', cativeiroRoutes);
app.use('/', camaraoRoutes);
app.use('/', sensorRoutes);
app.use('/usuariosxfazendas', usuariosxFazendasRoutes);
app.use('/sensoresxcativeiros', sensoresxCativeirosRoutes);
app.use('/notifications', notificationRoutes);
app.use('/email', emailRoutes);
app.use('/test', testRoutes);
app.use('/parametros', parametrosRoutes);
app.use('/chat', chatRoutes);
app.use('/dietas', dietaRoutes);
import requestRoutes from './routes/requestRoutes.js';
import { BlockMembersWrite } from './middleware/Auth.js';
// Bloqueio global de escrita para membros (exceto /requests)
app.use(BlockMembersWrite);
app.use('/requests', requestRoutes);
// ✅ Conecta ao MongoDB Atlas
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/camarize";

// Configurações do Mongoose para MongoDB Atlas
const mongooseOptions = {
  maxPoolSize: 10, // Máximo de conexões no pool
  serverSelectionTimeoutMS: 5000, // Timeout para seleção do servidor
  socketTimeoutMS: 45000, // Timeout para operações de socket
  bufferCommands: true, // Habilita o buffer de comandos para evitar erros de conexão
};

// Conecta ao MongoDB
mongoose.connect(mongoUrl, mongooseOptions)
.then(() => {
  console.log("✅ MongoDB Atlas conectado com sucesso!");
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`🌐 Host: ${mongoose.connection.host}`);
  
  // Iniciar monitoramento automático após conexão com banco
  if (process.env.ENABLE_AUTO_MONITORING !== 'false') {
    const intervalMinutes = parseInt(process.env.MONITORING_INTERVAL_MINUTES) || 5;
    monitoringService.startMonitoring(intervalMinutes);
    console.log(`🔍 Monitoramento automático iniciado a cada ${intervalMinutes} minutos`);
  } else {
    console.log('⏸️ Monitoramento automático desabilitado (ENABLE_AUTO_MONITORING=false)');
  }
})
.catch(err => {
  console.error("❌ Erro na conexão com MongoDB Atlas:", err.message);
  console.error("🔧 Verifique se a string de conexão está correta no arquivo .env");
});

// Inicia o servidor em ambiente padrão
const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 API rodando em http://localhost:${port}.`);
  console.log('✅ Servidor pronto para receber requisições!');
});

// Event listeners para monitorar a conexão
mongoose.connection.on('error', (err) => {
  console.error('❌ Erro na conexão MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB desconectado');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconectado');
});
