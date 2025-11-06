import Cativeiros from "../models/Cativeiros.js";

class cativeiroService {
  async getAll() {
    try {
      // OTIMIZAÇÃO: Buscar cativeiros e relacionamentos em paralelo + usar lean()
      const FazendasxCativeiros = (await import('../models/FazendasxCativeiros.js')).default;
      
      const [cativeiros, rels] = await Promise.all([
        Cativeiros.find()
          .populate('id_tipo_camarao')
          .populate('condicoes_ideais')
          .lean(), // Usa lean() para melhor performance
        FazendasxCativeiros.find({}, 'cativeiro fazenda').populate('fazenda').lean()
      ]);
      
      // Criar mapa de relacionamentos para acesso O(1)
      const relsMap = new Map();
      rels.forEach(rel => {
        if (rel.cativeiro && rel.fazenda) {
          relsMap.set(rel.cativeiro.toString(), rel.fazenda);
        }
      });
      
      // Anexar dados da fazenda a cada cativeiro
      const cativeirosComFazenda = cativeiros.map(cativeiro => {
        const fazenda = relsMap.get(cativeiro._id.toString());
        if (fazenda) {
          cativeiro.fazenda = fazenda._id || fazenda;
          cativeiro.fazendaNome = fazenda.nome;
          cativeiro.fazendaCodigo = fazenda.codigo;
        }
        return cativeiro;
      });
      
      return cativeirosComFazenda;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async Create(data) {
    try {
      const novo = new Cativeiros(data);
      return await novo.save();
    } catch (error) {
      console.log("Erro ao salvar cativeiro:", error);
      return null;
    }
  }

  async getById(id) {
    try {
      // OTIMIZAÇÃO: Buscar tudo em paralelo + usar lean()
      const FazendasxCativeiros = (await import('../models/FazendasxCativeiros.js')).default;
      const SensoresxCativeiros = (await import('../models/SensoresxCativeiros.js')).default;
      
      const [cativeiro, relacaoFazenda, sensoresRelacionados] = await Promise.all([
        Cativeiros.findById(id)
          .populate('id_tipo_camarao')
          .populate('condicoes_ideais')
          .lean(),
        FazendasxCativeiros.findOne({ cativeiro: id }).populate('fazenda').lean(),
        SensoresxCativeiros.find({ id_cativeiro: id }).populate('id_sensor').lean()
      ]);
      
      if (!cativeiro) return null;

      // Anexar fazenda
      if (relacaoFazenda && relacaoFazenda.fazenda) {
        cativeiro.fazenda = relacaoFazenda.fazenda._id || relacaoFazenda.fazenda;
        cativeiro.fazendaNome = relacaoFazenda.fazenda.nome;
        cativeiro.fazendaCodigo = relacaoFazenda.fazenda.codigo;
      }

      // Filtrar sensores válidos
      const sensores = sensoresRelacionados
        .map(rel => rel.id_sensor)
        .filter(Boolean);
      
      cativeiro.sensores = sensores;
      
      return cativeiro;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async update(id, data) {
    try {
      return await Cativeiros.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      console.log("Erro ao atualizar cativeiro:", error);
      return null;
    }
  }

  async delete(id) {
    try {
      // Primeiro, excluir relacionamentos
      const FazendasxCativeiros = (await import('../models/FazendasxCativeiros.js')).default;
      const SensoresxCativeiros = (await import('../models/SensoresxCativeiros.js')).default;
      
      // Excluir relacionamento fazenda-cativeiro
      await FazendasxCativeiros.deleteMany({ cativeiro: id });
      console.log(`🗑️ Relacionamentos fazenda-cativeiro excluídos para cativeiro: ${id}`);
      
      // Excluir relacionamentos sensor-cativeiro
      await SensoresxCativeiros.deleteMany({ id_cativeiro: id });
      console.log(`🗑️ Relacionamentos sensor-cativeiro excluídos para cativeiro: ${id}`);
      
      // Excluir o cativeiro
      const result = await Cativeiros.findByIdAndDelete(id);
      console.log(`🗑️ Cativeiro excluído: ${id}`);
      
      return result;
    } catch (error) {
      console.log("Erro ao deletar cativeiro:", error);
      return null;
    }
  }

  async getAllByUsuarioViaRelacionamentos(usuarioId) {
    try {
      // OTIMIZAÇÃO: Buscar tudo em paralelo + usar lean() + Map para acesso rápido
      const UsuariosxFazendas = (await import('../models/UsuariosxFazendas.js')).default;
      const FazendasxCativeiros = (await import('../models/FazendasxCativeiros.js')).default;
      const Cativeiros = (await import('../models/Cativeiros.js')).default;
      
      // Buscar apenas relacionamentos ATIVOS (ativo === true ou undefined para compatibilidade)
      const fazendasDoUsuario = await UsuariosxFazendas.find({ 
        usuario: usuarioId,
        $or: [
          { ativo: true },
          { ativo: { $exists: false } } // Compatibilidade com registros antigos sem campo ativo
        ]
      }).populate('fazenda').lean();
      
      const fazendaIds = fazendasDoUsuario.map(f => f.fazenda._id || f.fazenda);
      
      if (fazendaIds.length === 0) return [];
      
      // OTIMIZAÇÃO: Buscar relacionamentos uma vez e extrair IDs
      const rels = await FazendasxCativeiros.find({ fazenda: { $in: fazendaIds } }, 'cativeiro fazenda').populate('fazenda').lean();
      const cativeiroIds = rels.map(r => r.cativeiro);
      
      if (cativeiroIds.length === 0) return [];
      
      // Buscar cativeiros em paralelo com os relacionamentos já obtidos
      const cativeiros = await Cativeiros.find({ _id: { $in: cativeiroIds } })
        .populate('id_tipo_camarao')
        .populate('condicoes_ideais')
        .lean();
      
      // Criar mapa de relacionamentos para acesso O(1)
      const relsMap = new Map();
      rels.forEach(rel => {
        if (rel.cativeiro && rel.fazenda) {
          relsMap.set(rel.cativeiro.toString(), rel.fazenda);
        }
      });
      
      // Anexar dados da fazenda a cada cativeiro
      const cativeirosComFazenda = cativeiros.map(cativeiro => {
        const fazenda = relsMap.get(cativeiro._id.toString());
        if (fazenda) {
          cativeiro.fazenda = fazenda._id || fazenda;
          cativeiro.fazendaNome = fazenda.nome;
          cativeiro.fazendaCodigo = fazenda.codigo;
        }
        return cativeiro;
      });
      
      return cativeirosComFazenda;
    } catch (error) {
      console.log(error);
      return [];
    }
  }
}

export default new cativeiroService(); 