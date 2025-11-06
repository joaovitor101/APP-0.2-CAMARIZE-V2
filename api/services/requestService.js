import Request from "../models/Requests.js";
import userService from "../services/userService.js";
import Fazendas from "../models/Fazendas.js";
import UsuariosxFazendas from "../models/UsuariosxFazendas.js";

class RequestService {
  async create({ requesterUser, requesterRole, targetRole, type, action, payload, fazenda }) {
    const req = new Request({ requesterUser, requesterRole, targetRole, type, action, payload, fazenda });
    return await req.save();
  }

  async list(filter = {}) {
    return await Request.find(filter)
      .populate('requesterUser', 'nome email')
      .populate('approverUser', 'nome email')
      .populate('fazenda', 'nome codigo')
      .sort({ createdAt: -1 });
  }

  async approve(id, approverUser, fazendaId = null) {
    const request = await Request.findById(id);
    if (!request) return null;

    // Se for cadastro de proprietário, criar usuário e fazenda antes de aprovar
    if (request.action === 'cadastrar_proprietario' && request.payload) {
      try {
        const { nome, email, senha, foto_perfil, fazenda: fazendaData } = request.payload;

        // Verificar se usuário já existe (pode ter sido criado enquanto aguardava aprovação)
        let user = await userService.getOne(email);
        
        // Criar fazenda primeiro (sempre criar, mesmo se usuário já existir)
        let fazendaDoc = null;
        if (fazendaData) {
          fazendaDoc = new Fazendas(fazendaData);
          await fazendaDoc.save();
          console.log('✅ [APPROVE PROPRIETARIO] Fazenda criada:', fazendaDoc._id);
        }
        
        if (!user) {
          // Criar usuário como ADMIN (proprietário)
          user = await userService.Create(nome, email, senha, foto_perfil, fazendaDoc ? fazendaDoc._id : undefined, 'admin');
          console.log('✅ [APPROVE PROPRIETARIO] Usuário criado:', user._id);
        } else {
          // Se usuário já existe, atualizar role para admin se necessário
          if (user.role !== 'admin') {
            await userService.updateRole(user._id, 'admin');
            console.log('✅ [APPROVE PROPRIETARIO] Role atualizado para admin');
          }
        }

        // Criar relacionamento usuário-fazenda (sempre criar se não existir)
        if (fazendaDoc && user) {
          const relExists = await UsuariosxFazendas.findOne({ 
            usuario: user._id, 
            fazenda: fazendaDoc._id 
          });
          
          if (!relExists) {
            await UsuariosxFazendas.create({ usuario: user._id, fazenda: fazendaDoc._id });
            console.log('✅ [APPROVE PROPRIETARIO] Relação usuário-fazenda criada');
          } else {
            console.log('⚠️ [APPROVE PROPRIETARIO] Relação já existe');
          }
        }

        // Atualizar requesterUser na solicitação
        request.requesterUser = user._id;
      } catch (error) {
        console.error('❌ [APPROVE PROPRIETARIO] Erro ao criar usuário/fazenda na aprovação:', error);
        throw error;
      }
    }

    // Se for associação de funcionário, apenas criar o relacionamento com a fazenda
    if (request.action === 'associar_funcionario' && request.payload) {
      try {
        if (!fazendaId) {
          throw new Error('Fazenda é obrigatória para aprovar associação de funcionário');
        }

        const { emailFuncionario } = request.payload;

        // Verificar se fazenda existe
        const fazendaDoc = await Fazendas.findById(fazendaId);
        if (!fazendaDoc) {
          throw new Error('Fazenda não encontrada');
        }

        // Buscar usuário pelo email
        const user = await userService.getOne(emailFuncionario);
        if (!user) {
          throw new Error(`Funcionário com email '${emailFuncionario}' não encontrado. O funcionário deve se cadastrar primeiro.`);
        }

        // Verificar se o usuário é membro (funcionário)
        if (user.role !== 'membro') {
          throw new Error('Apenas funcionários podem ser associados a fazendas dessa forma');
        }

        // Criar relacionamento usuário-fazenda se não existir
        const relExists = await UsuariosxFazendas.findOne({ usuario: user._id, fazenda: fazendaId });
        if (!relExists) {
          await UsuariosxFazendas.create({ usuario: user._id, fazenda: fazendaId });
          console.log(`✅ Funcionário ${user.email} associado à fazenda ${fazendaId}`);
        } else {
          console.log(`⚠️ Funcionário ${user.email} já está associado à fazenda ${fazendaId}`);
        }

        // Atualizar requesterUser na solicitação
        request.requesterUser = user._id;
      } catch (error) {
        console.error('Erro ao associar funcionário à fazenda:', error);
        throw error;
      }
    }

    // Se for cadastro de funcionário (legado - manter compatibilidade)
    if (request.action === 'cadastrar_funcionario' && request.payload) {
      try {
        if (!fazendaId) {
          throw new Error('Fazenda é obrigatória para aprovar cadastro de funcionário');
        }

        const { nome, email, senha, foto_perfil } = request.payload;

        // Verificar se usuário já existe
        let user = await userService.getOne(email);
        
        if (!user) {
          // Verificar se fazenda existe
          const fazendaDoc = await Fazendas.findById(fazendaId);
          if (!fazendaDoc) {
            throw new Error('Fazenda não encontrada');
          }

          // Criar usuário como MEMBRO (funcionário)
          user = await userService.Create(nome, email, senha, foto_perfil, fazendaId, 'membro');

          // Criar relacionamento usuário-fazenda
          await UsuariosxFazendas.create({ usuario: user._id, fazenda: fazendaId });

          // Atualizar requesterUser na solicitação
          request.requesterUser = user._id;
        } else {
          // Se usuário já existe, apenas criar o relacionamento se não existir
          const relExists = await UsuariosxFazendas.findOne({ usuario: user._id, fazenda: fazendaId });
          if (!relExists) {
            await UsuariosxFazendas.create({ usuario: user._id, fazenda: fazendaId });
          }
        }
      } catch (error) {
        console.error('Erro ao criar usuário/fazenda na aprovação de funcionário:', error);
        throw error;
      }
    }

    // Aprovar solicitação
    return await Request.findByIdAndUpdate(id, { status: 'aprovado', approverUser, requesterUser: request.requesterUser }, { new: true });
  }

  async reject(id, approverUser) {
    return await Request.findByIdAndUpdate(id, { status: 'recusado', approverUser }, { new: true });
  }

  async deleteByIdForRequester(id, requesterUserId) {
    const found = await Request.findOne({ _id: id, requesterUser: requesterUserId });
    if (!found) return null;
    await Request.deleteOne({ _id: id });
    return { success: true };
  }
}

export default new RequestService();

