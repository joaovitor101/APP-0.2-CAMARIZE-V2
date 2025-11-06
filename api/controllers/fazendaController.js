import fazendaService from "../services/fazendaService.js";
import UsuariosxFazendas from "../models/UsuariosxFazendas.js";
import mongoose from "mongoose";
import userService from "../services/userService.js";

// Função para cadastrar fazenda (padrão Express)
const createFazenda = async (req, res) => {
  try {
    console.log("🔍 [FAZENDA] Body recebido:", req.body);
    console.log("🔍 [FAZENDA] Usuário logado:", req.loggedUser);
    
    const usuarioId = req.loggedUser?.id;
    if (!usuarioId) {
      console.log("❌ [FAZENDA] Usuário não autenticado");
      return res.status(401).json({ error: "Usuário não autenticado" });
    }
    
    console.log("📝 [FAZENDA] Criando fazenda...");
    const result = await fazendaService.Create(
      req.body.nome,
      req.body.rua,
      req.body.bairro,
      req.body.cidade,
      req.body.numero
    );
    
    if (!result) {
      console.log("❌ [FAZENDA] Falha ao salvar fazenda no banco");
      return res.status(500).json({ error: "Falha ao salvar no banco." });
    }
    
    console.log("✅ [FAZENDA] Fazenda criada:", result._id);
    
    // Cria o relacionamento na tabela intermediária
    console.log("🔗 [FAZENDA] Criando relacionamento usuário-fazenda...");
    await UsuariosxFazendas.create({ usuario: usuarioId, fazenda: result._id });
    console.log("✅ [FAZENDA] Relacionamento criado");
    
    res.status(201).json({ message: "Fazenda criada com sucesso!" });
  } catch (error) {
    console.error("❌ [FAZENDA] Erro no controller:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

// Endpoint público para listar todas as fazendas (para cadastro de funcionário)
const getAllFazendasPublic = async (req, res) => {
  try {
    const farms = await fazendaService.getAll();
    res.status(200).json(farms);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao buscar fazendas." });
  }
};

const getAllFazendas = async (req, res) => {
  try {
    const usuarioId = req.loggedUser?.id;
    const userRole = req.loggedUser?.role;
    
    console.log('🔍 [GET ALL FAZENDAS] UsuarioId:', usuarioId, 'Role:', userRole);
    
    // Se for master, retorna todas as fazendas
    if (userRole === 'master') {
      const farms = await fazendaService.getAll();
      console.log('✅ [GET ALL FAZENDAS] Master - retornando', farms.length, 'fazendas');
      return res.status(200).json(farms);
    }
    
    // Se não for master, retorna apenas as fazendas do usuário logado
    if (usuarioId) {
      // Buscar todas as relações do usuário (tentar com string e ObjectId)
      let rels = [];
      
      try {
        // Tentar buscar com ObjectId se for uma string válida
        if (mongoose.Types.ObjectId.isValid(usuarioId)) {
          const userIdObj = new mongoose.Types.ObjectId(usuarioId);
          rels = await UsuariosxFazendas.find({ usuario: userIdObj }).populate('fazenda').lean();
          console.log('🔍 [GET ALL FAZENDAS] Busca com ObjectId - encontradas', rels?.length || 0, 'relações');
          
          // Se não encontrou com ObjectId, tentar também como string (caso o banco tenha salvo como string)
          if (!rels || rels.length === 0) {
            rels = await UsuariosxFazendas.find({ usuario: usuarioId }).populate('fazenda').lean();
            console.log('🔍 [GET ALL FAZENDAS] Busca com string (fallback) - encontradas', rels?.length || 0, 'relações');
          }
        } else {
          // Tentar buscar como string também
          rels = await UsuariosxFazendas.find({ usuario: usuarioId }).populate('fazenda').lean();
          console.log('🔍 [GET ALL FAZENDAS] Busca com string - encontradas', rels?.length || 0, 'relações');
        }
      } catch (searchError) {
        console.error('❌ [GET ALL FAZENDAS] Erro na busca:', searchError);
        rels = [];
      }
      
      // Se não encontrou relações, verificar se o usuário tem fazenda no campo direto (legado)
      if (!rels || rels.length === 0) {
        try {
          const user = await userService.getById(usuarioId);
          
          if (user && user.fazenda) {
            console.log('⚠️ [GET ALL FAZENDAS] Usuário tem fazenda no campo direto (legado), criando relação...');
            
            // Buscar a fazenda
            const fazenda = await fazendaService.getById(user.fazenda);
            if (fazenda) {
              // Criar relação se não existir
              const relExists = await UsuariosxFazendas.findOne({ 
                usuario: mongoose.Types.ObjectId.isValid(usuarioId) ? new mongoose.Types.ObjectId(usuarioId) : usuarioId,
                fazenda: user.fazenda 
              });
              
              if (!relExists) {
                await UsuariosxFazendas.create({ 
                  usuario: mongoose.Types.ObjectId.isValid(usuarioId) ? new mongoose.Types.ObjectId(usuarioId) : usuarioId,
                  fazenda: user.fazenda 
                });
                console.log('✅ [GET ALL FAZENDAS] Relação criada automaticamente');
                
                // Buscar novamente após criar
                const userIdObj = mongoose.Types.ObjectId.isValid(usuarioId) ? new mongoose.Types.ObjectId(usuarioId) : usuarioId;
                rels = await UsuariosxFazendas.find({ usuario: userIdObj }).populate('fazenda').lean();
              } else {
                // Se já existe, buscar novamente
                const userIdObj = mongoose.Types.ObjectId.isValid(usuarioId) ? new mongoose.Types.ObjectId(usuarioId) : usuarioId;
                rels = await UsuariosxFazendas.find({ usuario: userIdObj }).populate('fazenda').lean();
              }
            }
          }
        } catch (legacyError) {
          console.error('❌ [GET ALL FAZENDAS] Erro ao verificar fazenda legado:', legacyError);
        }
      }
      
      // Se ainda não encontrou nada, tentar buscar todas as relações para debug
      if (!rels || rels.length === 0) {
        try {
          const allRels = await UsuariosxFazendas.find({}).populate('usuario').populate('fazenda').lean();
          console.log('⚠️ [GET ALL FAZENDAS] Nenhuma relação encontrada. Total de relações no banco:', allRels?.length || 0);
          if (allRels && allRels.length > 0) {
            console.log('⚠️ [GET ALL FAZENDAS] Relações existentes:', allRels.map(r => ({
              usuarioId: String(r.usuario?._id || r.usuario),
              usuarioEmail: r.usuario?.email,
              fazendaId: String(r.fazenda?._id || r.fazenda),
              fazendaNome: r.fazenda?.nome
            })));
            console.log('⚠️ [GET ALL FAZENDAS] UsuarioId buscado:', usuarioId, 'Tipo:', typeof usuarioId);
          }
        } catch (debugError) {
          console.error('❌ [GET ALL FAZENDAS] Erro no debug:', debugError);
        }
      }
      
      const fazendasDoUsuario = (rels || [])
        .map(rel => rel?.fazenda)
        .filter(f => f !== null && f !== undefined);
      
      console.log('✅ [GET ALL FAZENDAS] Retornando', fazendasDoUsuario.length, 'fazendas para o usuário');
      return res.status(200).json(fazendasDoUsuario);
    }
    
    // Se não houver usuário logado, retorna array vazio
    console.log('⚠️ [GET ALL FAZENDAS] Nenhum usuarioId encontrado');
    return res.status(200).json([]);
  } catch (error) {
    console.error('❌ [GET ALL FAZENDAS] Erro:', error);
    res.status(500).json({ error: "Erro ao buscar fazendas." });
  }
};

const getFazendaById = async (req, res) => {
  try {
    const fazenda = await fazendaService.getById(req.params.id);
    if (!fazenda) return res.status(404).json({ error: "Fazenda não encontrada" });
    res.json(fazenda);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Atualizar foto da fazenda
const updateFotoFazenda = async (req, res) => {
  try {
    const { id } = req.params;
    const { foto_sitio } = req.body;
    const fazenda = await fazendaService.updateFoto(id, foto_sitio);
    if (!fazenda) return res.status(404).json({ error: "Fazenda não encontrada" });
    res.json({ message: "Foto da fazenda atualizada com sucesso!", fazenda });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET foto da fazenda
const getFotoFazenda = async (req, res) => {
  try {
    const { id } = req.params;
    const fazenda = await fazendaService.getById(id);
    if (!fazenda || !fazenda.foto_sitio) {
      return res.status(404).send("Sem foto");
    }
    res.json({ foto: fazenda.foto_sitio });
  } catch (err) {
    res.status(500).send("Erro ao buscar foto");
  }
};

export default { createFazenda, getAllFazendas, getAllFazendasPublic, getFazendaById, updateFotoFazenda, getFotoFazenda }; 