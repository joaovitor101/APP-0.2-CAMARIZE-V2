import userService from "../services/userService.js";
import jwt from "jsonwebtoken";
import fazendaController from "./fazendaController.js";
import Fazendas from "../models/Fazendas.js";
import emailService from "../services/emailService.js";
import requestService from "../services/requestService.js";
import UsuariosxFazendas from "../models/UsuariosxFazendas.js";

// JWTSecret
const JWTSecret = process.env.JWT_SECRET || "apigamessecret";


// No userController.js
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await userService.getById(id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    

    
    res.json(user);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    res.status(500).json({ error: err.message });
  }
};

// Buscar usuário atual (baseado no token)
const getCurrentUser = async (req, res) => {
  try {
    // O middleware de autenticação já adicionou req.loggedUser
    const userId = req.loggedUser.id;
    
    const user = await userService.getById(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    
    // Remove a senha do objeto retornado por segurança
    const { senha, ...userWithoutPassword } = user.toObject();
    
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Erro ao buscar usuário atual:', err);
    res.status(500).json({ error: err.message });
  }
};


// Cadastrando um usuário
const createUser = async (req, res) => {
  try {
    console.log("Dados recebidos para cadastro:", req.body); // Log dos dados recebidos
    const { nome, email, senha, foto_perfil, fazenda, role } = req.body;
    const user = await userService.Create(nome, email, senha, foto_perfil, fazenda, role);
    res.sendStatus(201); // Cod. 201 (CREATED)
  } catch (error) {
    console.log("Erro ao salvar usuário:", error); // Log do erro
    res.sendStatus(500); // Erro interno do servidor
  }
};

// Cadastro completo (usuário + fazenda)
const register = async (req, res) => {
  try {
    console.log("🔍 [REGISTER] Dados recebidos:", req.body);
    const { nome, email, senha, foto_perfil, fazenda } = req.body;
    
    // Verificar se o usuário já existe
    const existingUser = await userService.getOne(email);
    if (existingUser) {
      console.log("❌ [REGISTER] Usuário já existe:", email);
      return res.status(400).json({ 
        error: `Usuário com o email '${email}' já existe. Tente usar um email diferente ou faça login.` 
      });
    }
    
    let fazendaDoc = null;
    if (fazenda) {
      fazendaDoc = new Fazendas(fazenda);
      await fazendaDoc.save();
      console.log("✅ [REGISTER] Fazenda criada:", fazendaDoc._id);
    }
    
    console.log("📝 [REGISTER] Criando usuário...");
    const user = await userService.Create(nome, email, senha, foto_perfil, fazendaDoc ? fazendaDoc._id : undefined, 'membro');
    console.log("✅ [REGISTER] Usuário criado:", user._id);
    
    res.status(201).json(user);
  } catch (err) {
    console.error("❌ [REGISTER] Erro:", err);
    res.status(500).json({ error: err.message });
  }
};

// Removido o método registerUser, pois não será mais usado

// Autenticando um usuário
const loginUser = async (req, res) => {
  try {
    const { email, senha } = req.body;
    // Log dos dados recebidos
    console.log("Tentando login com:", email, senha);
    // Se o e-mail não está vazio
    if (email != undefined) {
      // Busca o usuário no banco
      const user = await userService.getOne(email);
      // Log do usuário encontrado
      console.log("Usuário encontrado:", user);
      // Usuário encontrado
      if (user != undefined) {
        // Senha correta
        if (user.senha == senha) {
          // Gerando o token
          jwt.sign(
            { id: user._id, email: user.email },
            JWTSecret,
            { expiresIn: "48h" },
            (error, token) => {
              if (error) {
                res.status(400).json({ error: "Erro ao gerar o token." }); // Bad request
              } else {
                res.status(200).json({ token: token });
                
              }
            });
          // Senha incorreta
        } else {
          res.status(401).json({ error: "Credenciais inválidas" }); // Unauthorized
        }
    // Usuário não encontrado
      } else {
        res.status(404).json({error: "Usuário não encontrado."}) //Not found
      }
      // E-mail inválido ou vazio
    } else {
        res.status(400).json({error: "O e-mail enviado é inválido."}) // Bad request
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500); // Erro interno do servidor
  }
};

// Atualizar foto do usuário
const updateUserPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { foto_perfil } = req.body;
    
    const user = await userService.updatePhoto(id, foto_perfil);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    
    res.json({ message: "Foto do usuário atualizada com sucesso!", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Listar usuários (opcional: por role) - apenas master
const listUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await userService.listUsers(filter);
    res.json(users.map(u => ({
      id: u._id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      fazenda: u.fazenda,
      foto_perfil: u.foto_perfil,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lista somente masters (permitido para admin e master)
const listMasters = async (req, res) => {
  try {
    const users = await userService.listUsers({ role: 'master' });
    res.json(users.map(u => ({ id: u._id, nome: u.nome, email: u.email, role: u.role })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Atualizar role - apenas master
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['membro', 'admin', 'master'].includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }
    const updated = await userService.updateRole(id, role);
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ id: updated._id, role: updated.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cadastro de funcionário (cria usuário diretamente, sem fazenda associada)
const registerFuncionario = async (req, res) => {
  try {
    console.log("🔍 [REGISTER FUNCIONARIO] Dados recebidos:", req.body);
    const { nome, email, senha, foto_perfil } = req.body;
    
    // Verificar se o usuário já existe
    const existingUser = await userService.getOne(email);
    if (existingUser) {
      console.log("❌ [REGISTER FUNCIONARIO] Usuário já existe:", email);
      return res.status(400).json({ 
        error: `Usuário com o email '${email}' já existe. Tente usar um email diferente ou faça login.` 
      });
    }

    // Criar usuário como MEMBRO (funcionário) sem fazenda associada
    // O admin fará a solicitação de associação à fazenda depois
    const user = await userService.Create(nome, email, senha, foto_perfil, undefined, 'membro');
    console.log("✅ [REGISTER FUNCIONARIO] Usuário criado:", user._id);

    res.status(201).json({ 
      message: "Cadastro realizado com sucesso! Aguarde a associação à fazenda pelo administrador.",
      user
    });
  } catch (err) {
    console.error("❌ [REGISTER FUNCIONARIO] Erro:", err);
    res.status(500).json({ error: err.message });
  }
};

// Cadastro de proprietário (cria solicitação ao invés de usuário direto)
const registerProprietario = async (req, res) => {
  try {
    console.log("🔍 [REGISTER PROPRIETARIO] Dados recebidos:", req.body);
    const { nome, email, senha, foto_perfil, fazenda } = req.body;
    
    // Verificar se o usuário já existe
    const existingUser = await userService.getOne(email);
    if (existingUser) {
      console.log("❌ [REGISTER PROPRIETARIO] Usuário já existe:", email);
      return res.status(400).json({ 
        error: `Usuário com o email '${email}' já existe. Tente usar um email diferente ou faça login.` 
      });
    }

    // Validar dados da fazenda
    if (!fazenda || !fazenda.nome || !fazenda.rua || !fazenda.bairro || !fazenda.cidade || !fazenda.numero) {
      return res.status(400).json({ 
        error: "Dados da fazenda incompletos. Todos os campos são obrigatórios." 
      });
    }

    // Criar solicitação para o master aprovar
    const requestData = {
      requesterUser: null, // Ainda não existe usuário
      requesterRole: 'membro', // Será membro quando aprovado
      targetRole: 'master',
      type: 'pesada',
      action: 'cadastrar_proprietario',
      payload: {
        nome,
        email,
        senha,
        foto_perfil,
        fazenda: {
          nome: fazenda.nome,
          rua: fazenda.rua,
          bairro: fazenda.bairro,
          cidade: fazenda.cidade,
          numero: fazenda.numero
        }
      }
    };

    const createdRequest = await requestService.create(requestData);
    console.log("✅ [REGISTER PROPRIETARIO] Solicitação criada:", createdRequest._id);

    res.status(201).json({ 
      message: "Solicitação de cadastro enviada com sucesso! Aguarde aprovação do Master.",
      requestId: createdRequest._id
    });
  } catch (err) {
    console.error("❌ [REGISTER PROPRIETARIO] Erro:", err);
    res.status(500).json({ error: err.message });
  }
};

// Verificar se email já existe (sem criar usuário)
const checkEmailExists = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const user = await userService.getOne(email);
    res.json({ exists: !!user });
  } catch (err) {
    console.error('Erro ao verificar email:', err);
    res.status(500).json({ error: err.message });
  }
};

// Associar funcionário à fazenda do admin (chamado diretamente pelo admin, sem passar pelo master)
const associarFuncionario = async (req, res) => {
  try {
    const { email } = req.body;
    const adminId = req.loggedUser?.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email do funcionário é obrigatório' });
    }

    if (!adminId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar o admin logado
    const admin = await userService.getById(adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin não encontrado' });
    }

    // Verificar se é admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas admins podem associar funcionários' });
    }

    // Buscar a fazenda do admin
    const relAdminFazenda = await UsuariosxFazendas.findOne({ usuario: adminId }).populate('fazenda');
    if (!relAdminFazenda || !relAdminFazenda.fazenda) {
      return res.status(400).json({ error: 'Admin não possui fazenda associada. Entre em contato com o Master.' });
    }

    const fazendaId = relAdminFazenda.fazenda._id || relAdminFazenda.fazenda;

    // Buscar o funcionário pelo email
    const funcionario = await userService.getOne(email.trim());
    if (!funcionario) {
      return res.status(404).json({ 
        error: `Funcionário com email '${email}' não encontrado. O funcionário deve se cadastrar primeiro.` 
      });
    }

    // Verificar se é funcionário (membro)
    if (funcionario.role !== 'membro') {
      return res.status(400).json({ error: 'Apenas funcionários podem ser associados a fazendas dessa forma' });
    }

    // Verificar se já está associado
    const relExists = await UsuariosxFazendas.findOne({ 
      usuario: funcionario._id, 
      fazenda: fazendaId 
    });

    if (relExists) {
      return res.status(400).json({ 
        error: `Funcionário já está associado à fazenda '${relAdminFazenda.fazenda.nome || fazendaId}'` 
      });
    }

    // Criar relacionamento
    await UsuariosxFazendas.create({ 
      usuario: funcionario._id, 
      fazenda: fazendaId 
    });

    console.log(`✅ Admin ${admin.email} associou funcionário ${funcionario.email} à fazenda ${fazendaId}`);

    res.status(200).json({ 
      message: `Funcionário ${funcionario.nome} associado com sucesso à fazenda!`,
      funcionario: {
        id: funcionario._id,
        nome: funcionario.nome,
        email: funcionario.email
      },
      fazenda: {
        id: fazendaId,
        nome: relAdminFazenda.fazenda.nome || 'N/A'
      }
    });
  } catch (err) {
    console.error('❌ [ASSOCIAR FUNCIONARIO] Erro:', err);
    res.status(500).json({ error: err.message });
  }
};

export default { 
  createUser, 
  loginUser, 
  JWTSecret, 
  register, 
  registerFuncionario,
  registerProprietario,
  checkEmailExists,
  associarFuncionario,
  getUserById, 
  updateUserPhoto, 
  getCurrentUser, 
  listUsers, 
  listMasters, 
  changeUserRole 
};
