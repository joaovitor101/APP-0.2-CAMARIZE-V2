import jwt from "jsonwebtoken";
import userController from "../controllers/userController.js";
import userService from "../services/userService.js";

// Função para checagem da autenticação
const Authorization = async (req, res, next) => {
  // Coletar o token do cabeçalho da requisição
  const authToken = req.headers["authorization"];
  if (authToken != undefined) {
    // Dividindo o token
    const bearer = authToken.split(" ");
    const token = bearer[1];
    // Validando o token
    jwt.verify(token, userController.JWTSecret, async (error, data) => {
      if (error) {
        res.status(401).json({ error: "Token inválido. Não autorizado." });
        // Token válido
      } else {
        req.token = token;
        // Buscar dados completos do usuário incluindo role
        try {
          const user = await userService.getById(data.id);
          req.loggedUser = {
            id: data.id,
            email: data.email,
            role: user ? user.role : 'membro', // Adicionar role ao loggedUser
          };
          console.log('🔍 DEBUG Authorization - req.loggedUser:', req.loggedUser);
        } catch (err) {
          console.error('❌ Erro ao buscar usuário no Authorization:', err);
          req.loggedUser = {
            id: data.id,
            email: data.email,
            role: 'membro', // fallback
          };
        }
        next();
      }
    });
  } else {
    res.status(401).json({ error: "Token inválido." });
  }
};

// Middleware para checar se usuário tem uma das roles permitidas
const RequireRole = (roles) => async (req, res, next) => {
  try {
    if (!req.loggedUser?.id) return res.status(401).json({ error: 'Não autenticado' });
    const user = await userService.getById(req.loggedUser.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    req.currentUser = user; // opcional: disponibiliza o usuário completo
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro de autorização' });
  }
};

export default { Authorization, RequireRole };

// Middleware global: bloqueia membros de realizar escritas, exceto em /requests
export const BlockMembersWrite = async (req, res, next) => {
  try {
    const method = (req.method || '').toUpperCase();
    const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    if (!isWrite) return next();

    // Permitir rotas públicas (sem autenticação)
    if (req.path && req.path.startsWith('/requests')) return next();
    if (req.path && req.path.startsWith('/users/auth')) return next();
    if (req.path && req.path.startsWith('/users/register')) return next();
    if (req.path && req.path.startsWith('/users/user')) return next(); // Cadastro básico
    if (req.path && req.path.startsWith('/parametros/cadastrar')) return next(); // ESP32

    // Validar token localmente (não obrigar GETs)
    const authToken = req.headers["authorization"]; 
    if (!authToken) return res.status(401).json({ error: 'Não autenticado' });
    const token = (authToken.split(' ')[1] || '').trim();
    let data;
    try {
      data = jwt.verify(token, userController.JWTSecret);
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await userService.getById(data.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (user.role === 'membro') {
      return res.status(403).json({ error: 'Usuário membro não pode alterar dados. Envie uma solicitação.' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro de autorização' });
  }
};