import cativeiroService from "../services/cativeiroService.js";
import TiposCamarao from "../models/Camaroes.js";
import CondicoesIdeais from "../models/Condicoes_ideais.js";
import FazendasxCativeiros from "../models/FazendasxCativeiros.js";
import SensoresxCativeiros from "../models/SensoresxCativeiros.js";
import Cativeiros from "../models/Cativeiros.js";
import ParametrosAtuais from "../models/Parametros_atuais.js";
import Dietas from "../models/Dietas.js";
import DietasxCativeiros from "../models/DietasxCativeiros.js";

const createCativeiro = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.foto_cativeiro = req.file.buffer;
    }
    
    // Valida e converte os valores das condições ideais
    const validarEConverter = (valor, padrao) => {
      if (!valor || valor === '') return padrao;
      const num = parseFloat(valor);
      if (isNaN(num)) return padrao;
      return num;
    };

    const tempIdeal = validarEConverter(data.temp_media_diaria, 26);
    const phIdeal = validarEConverter(data.ph_medio_diario, 7.5);
    const amoniaIdeal = validarEConverter(data.amonia_media_diaria, 0.05);

    // Cria a condição ideal usando os valores validados
    const condicao = await CondicoesIdeais.create({
      id_tipo_camarao: data.id_tipo_camarao,
      temp_ideal: tempIdeal,
      ph_ideal: phIdeal,
      amonia_ideal: amoniaIdeal
    });
    data.condicoes_ideais = condicao._id;
    
    // Deixa os campos de monitoramento diário do cativeiro como null
    data.temp_media_diaria = null;
    data.ph_medio_diario = null;
    data.amonia_media_diaria = null;
    
    // Associar o usuário logado ao cativeiro
    if (req.loggedUser?.id) {
      data.user = req.loggedUser.id;
    }
    
    // dieta (string) pode vir do body
    // dieta como texto pode vir no request (dieta_texto) apenas para conveniência de criação

    const result = await cativeiroService.Create(data);
    if (!result) {
      return res.status(500).json({ error: "Falha ao salvar no banco." });
    }
    
    // Cria o relacionamento na tabela intermediária fazenda-cativeiro
    await FazendasxCativeiros.create({ fazenda: req.body.fazendaId, cativeiro: result._id });
    
    // Cria os relacionamentos sensor-cativeiro para todos os sensores fornecidos
    console.log('🔍 Verificando sensores na criação:', {
      sensorIds: req.body.sensorIds,
      sensorId: req.body.sensorId,
      isArray: Array.isArray(req.body.sensorIds),
      bodyKeys: Object.keys(req.body)
    });
    
    // Processa os sensores fornecidos
    let sensoresParaProcessar = [];
    
    // Verifica se sensorIds é um array (JSON) ou string única (FormData)
    if (req.body.sensorIds) {
      if (Array.isArray(req.body.sensorIds)) {
        // Dados enviados como JSON
        sensoresParaProcessar = req.body.sensorIds;
        console.log('📦 Processando sensorIds como array JSON:', sensoresParaProcessar);
      } else if (typeof req.body.sensorIds === 'string') {
        // Dados enviados como FormData - pode ser string única ou múltiplas
        sensoresParaProcessar = [req.body.sensorIds];
        console.log('📦 Processando sensorIds como string FormData:', sensoresParaProcessar);
      }
    }
    
         if (sensoresParaProcessar.length > 0) {
       try {
         // Filtra apenas sensores válidos e remove duplicatas
         const sensoresValidos = [...new Set(sensoresParaProcessar.filter(sensorId => sensorId && sensorId !== ""))];
         
         if (sensoresValidos.length > 0) {
           // Cria novas relações para todos os sensores válidos
           const relacoes = [];
           for (const sensorId of sensoresValidos) {
             const relacao = await SensoresxCativeiros.create({
               id_sensor: sensorId,
               id_cativeiro: result._id
             });
             relacoes.push(relacao);
             console.log(`✅ Relação sensor-cativeiro criada: Sensor ${sensorId} -> Cativeiro ${result._id}`);
           }
           console.log(`📝 Total de relações criadas: ${relacoes.length}`);
         } else {
           console.log('⚠️  Nenhum sensor válido fornecido no cadastro');
         }
      } catch (error) {
        console.error('❌ Erro ao criar relações sensor-cativeiro:', error.message);
      }
    } else if (req.body.sensorId && req.body.sensorId !== "") {
      // Fallback para compatibilidade com sensorId único
      try {
        const relacao = await SensoresxCativeiros.create({
          id_sensor: req.body.sensorId,
          id_cativeiro: result._id
        });
        console.log(`✅ Relação sensor-cativeiro criada: Sensor ${req.body.sensorId} -> Cativeiro ${result._id}`);
      } catch (error) {
        console.error('❌ Erro ao criar relação sensor-cativeiro:', error.message);
      }
    } else {
      console.log('⚠️  Nenhum sensor fornecido no cadastro');
    }
    
    // Se vier dieta (descrição), registra também em Dietas e relaciona
    // dieta inicial: somente masters podem criar/atribuir na criação
    try {
      const role = req.loggedUser?.role;
      if (role === 'master' && req.body.dieta_texto && String(req.body.dieta_texto).trim()) {
        const dietaDoc = await Dietas.create({ descricao: String(req.body.dieta_texto).trim() });
        await DietasxCativeiros.create({ cativeiro: result._id, dieta: dietaDoc._id, ativo: true });
      }
    } catch (e) {
      console.error('Erro ao criar/atribuir dieta_texto na criação:', e.message);
    }

    res.status(201).json({ 
      message: "Cativeiro criado com sucesso!",
      cativeiroId: result._id,
      sensorRelacionado: req.body.sensorId ? true : false
    });
  } catch (error) {
    console.log("Erro no controller:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
};

const getAllCativeiros = async (req, res) => {
  try {
    const usuarioId = req.loggedUser?.id;
    const role = req.loggedUser?.role;
    
    console.log('🔍 DEBUG getAllCativeiros - usuarioId:', usuarioId, 'role:', role);
    console.log('🔍 DEBUG req.loggedUser completo:', req.loggedUser);
    
    let cativeiros = [];
    if (role === 'master' || role === 'admin') {
      // Master e Admin enxergam todos os cativeiros, já com dados de fazenda anexados
      console.log('🔍 DEBUG - Buscando todos os cativeiros para', role);
      cativeiros = await cativeiroService.getAll();
      console.log('🔍 DEBUG - Cativeiros encontrados:', cativeiros.length);
    } else {
      // Membro ve pelos relacionamentos das suas fazendas
      console.log('🔍 DEBUG - Buscando cativeiros por relacionamentos para role:', role);
      cativeiros = await cativeiroService.getAllByUsuarioViaRelacionamentos(usuarioId);
      console.log('🔍 DEBUG - Cativeiros encontrados por relacionamento:', cativeiros.length);
    }
    
    console.log('🔍 DEBUG - Retornando cativeiros:', cativeiros.length);
    res.status(200).json(cativeiros);
  } catch (error) {
    console.error('❌ Erro em getAllCativeiros:', error);
    res.status(500).json({ error: "Erro ao buscar cativeiros." });
  }
};

const getAllTiposCamarao = async (req, res) => {
  try {
    const tipos = await TiposCamarao.find();
    res.status(200).json(tipos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tipos de camarão." });
  }
};

const getCativeiroById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando cativeiro por ID:', id);
    
    const cativeiro = await cativeiroService.getById(id);
    if (!cativeiro) {
      return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    }
    
    console.log('📊 Dados do cativeiro antes do JSON:');
    console.log('  ID:', cativeiro._id);
    console.log('  Fazenda:', cativeiro.fazenda);
    console.log('  Sensores:', cativeiro.sensores ? cativeiro.sensores.length : 0);
    
    if (cativeiro.sensores && cativeiro.sensores.length > 0) {
      console.log('  Detalhes dos sensores:');
      cativeiro.sensores.forEach((sensor, index) => {
        console.log(`    ${index + 1}. ${sensor.apelido} (${sensor.id_tipo_sensor}) - ID: ${sensor._id}`);
      });
    }
    
    res.status(200).json(cativeiro);
  } catch (error) {
    console.error('❌ Erro no getCativeiroById:', error);
    res.status(500).json({ error: 'Erro ao buscar cativeiro.' });
  }
};

const updateCativeiro = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    
    if (req.file) {
      data.foto_cativeiro = req.file.buffer;
    }

    // Se houver mudança no tipo de camarão, atualizar as condições ideais
    if (data.id_tipo_camarao) {
      // Valida e converte os valores das condições ideais
      const validarEConverter = (valor, padrao) => {
        if (!valor || valor === '') return padrao;
        const num = parseFloat(valor);
        if (isNaN(num)) return padrao;
        return num;
      };

      const tempIdeal = validarEConverter(data.temp_media_diaria, 26);
      const phIdeal = validarEConverter(data.ph_medio_diario, 7.5);
      const amoniaIdeal = validarEConverter(data.amonia_media_diaria, 0.05);

      const condicao = await CondicoesIdeais.create({
        id_tipo_camarao: data.id_tipo_camarao,
        temp_ideal: tempIdeal,
        ph_ideal: phIdeal,
        amonia_ideal: amoniaIdeal
      });
      data.condicoes_ideais = condicao._id;
      // Remove os campos de monitoramento diário
      data.temp_media_diaria = null;
      data.ph_medio_diario = null;
      data.amonia_media_diaria = null;
    }

    const result = await cativeiroService.update(id, data);
    if (!result) {
      return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    }

    // Atualiza as relações sensor-cativeiro se sensores foram fornecidos
    console.log('🔍 Dados recebidos na edição:', {
      sensorIds: req.body.sensorIds,
      sensorId: req.body.sensorId,
      isArray: Array.isArray(req.body.sensorIds),
      bodyKeys: Object.keys(req.body)
    });
    
    // Só mexe nas relações de sensores se houver payload relacionado a sensores
    const hasSensorPayload = typeof req.body.sensorIds !== 'undefined' || typeof req.body.sensorId !== 'undefined';
    if (hasSensorPayload) {
      // Remove relações anteriores para recriar
      await SensoresxCativeiros.deleteMany({ id_cativeiro: id });
      console.log(`🗑️  Relações anteriores removidas para cativeiro ${id}`);

      // Processa os sensores fornecidos
      let sensoresParaProcessar = [];

      // Verifica se sensorIds é um array (JSON) ou string única (FormData)
      if (req.body.sensorIds) {
        if (Array.isArray(req.body.sensorIds)) {
          // Dados enviados como JSON
          sensoresParaProcessar = req.body.sensorIds;
          console.log('📦 Processando sensorIds como array JSON:', sensoresParaProcessar);
        } else if (typeof req.body.sensorIds === 'string') {
          // Dados enviados como FormData - pode ser string única ou múltiplas
          sensoresParaProcessar = [req.body.sensorIds];
          console.log('📦 Processando sensorIds como string FormData:', sensoresParaProcessar);
        }
      }

      if (sensoresParaProcessar.length > 0) {
        // Filtra apenas sensores válidos e remove duplicatas
        const sensoresValidos = [...new Set(sensoresParaProcessar.filter(sensorId => sensorId && sensorId !== ""))];

        if (sensoresValidos.length > 0) {
          // Cria novas relações para todos os sensores válidos
          const relacoes = [];
          for (const sensorId of sensoresValidos) {
            const relacao = await SensoresxCativeiros.create({
              id_sensor: sensorId,
              id_cativeiro: id
            });
            relacoes.push(relacao);
            console.log(`✅ Relação sensor-cativeiro atualizada: Sensor ${sensorId} -> Cativeiro ${id}`);
          }
          console.log(`📝 Total de relações atualizadas: ${relacoes.length}`);
        } else {
          console.log('⚠️  Nenhum sensor válido fornecido na edição');
        }
      }
    } else if (req.body.sensorId && req.body.sensorId !== "") {
      // Fallback para compatibilidade com sensorId único
      try {
        const relacao = await SensoresxCativeiros.create({
          id_sensor: req.body.sensorId,
          id_cativeiro: id
        });
        console.log(`✅ Relação sensor-cativeiro atualizada: Sensor ${req.body.sensorId} -> Cativeiro ${id}`);
      } catch (error) {
        console.error('❌ Erro ao atualizar relação sensor-cativeiro:', error.message);
      }
    } else {
      console.log('ℹ️  Edição sem payload de sensores - mantendo vínculos existentes.');
    }

    // Se alterar dieta (descrição), cria nova Dieta e marca relação ativa
    // dieta removida do fluxo de patch do cativeiro; usar /dietas/assign/:cativeiroId

    res.status(200).json({ 
      message: 'Cativeiro atualizado com sucesso!', 
      cativeiro: result,
      sensorRelacionado: req.body.sensorId ? true : false
    });
  } catch (error) {
    console.log("Erro no controller:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};


const deleteCativeiro = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await cativeiroService.delete(id);
    if (!result) {
      return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    }
    res.status(200).json({ message: 'Cativeiro deletado com sucesso!' });
  } catch (error) {
    console.log("Erro no controller:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const getAllCondicoesIdeais = async (req, res) => {
  try {
    const condicoes = await CondicoesIdeais.find().populate('id_tipo_camarao');
    res.status(200).json(condicoes);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar condições ideais." });
  }
};

const getSensoresCativeiro = async (req, res) => {
  try {
    const { cativeiroId } = req.params;
    // Popula id_sensor e também o id_tipo_sensor interno para que o frontend receba
    // a descrição do tipo do sensor (TiposSensor.descricao)
    const sensores = await SensoresxCativeiros.find({ id_cativeiro: cativeiroId })
      .populate({
        path: 'id_sensor',
        populate: { path: 'id_tipo_sensor', model: 'TiposSensor' }
      })
      .populate('id_cativeiro');

    res.status(200).json(sensores);
  } catch (error) {
    console.error('Erro ao buscar sensores do cativeiro:', error);
    res.status(500).json({ error: "Erro ao buscar sensores do cativeiro." });
  }
};

// Buscar status geral de todos os cativeiros do usuário
const getCativeirosStatus = async (req, res) => {
  try {
    const usuarioId = req.loggedUser?.id;
    
    // Busca todos os cativeiros do usuário usando o service
    const cativeiros = await cativeiroService.getAllByUsuarioViaRelacionamentos(usuarioId);
    
    const cativeirosComStatus = [];
    let totalCativeiros = 0;
    let cativeirosOk = 0;
    let cativeirosAlerta = 0;
    let cativeirosCritico = 0;
    let cativeirosSemDados = 0;

    for (const cativeiro of cativeiros) {
      totalCativeiros++;
      
      // Busca o parâmetro atual mais recente para este cativeiro
      const parametroAtual = await ParametrosAtuais.findOne({ 
        id_cativeiro: cativeiro._id 
      }).sort({ datahora: -1 });
      
      if (!parametroAtual || !cativeiro.condicoes_ideais) {
        cativeirosComStatus.push({
          id: cativeiro._id,
          nome: cativeiro.nome || `Cativeiro ${cativeiro._id}`,
          tipo_camarao: cativeiro.id_tipo_camarao?.nome || 'Tipo não informado',
          status: 'sem_dados',
          statusText: 'Sem dados',
          statusColor: '#9ca3af',
          alertas: [],
          alertasDetalhados: [],
          totalAlertas: 0
        });
        cativeirosSemDados++;
        continue;
      }
      
      const condicaoIdeal = cativeiro.condicoes_ideais;
      
      // Tolerâncias mais realistas por parâmetro (mesmas das notificações)
      const toleranciaTemp = 0.15; // 15% para temperatura
      const toleranciaPh = 0.2;    // 20% para pH
      const toleranciaAmonia = 0.25; // 25% para amônia
      
             let alertas = [];
       const alertasDetalhados = [];
      let status = 'ok';
      let statusText = 'OK';
      let statusColor = '#10b981';
      
      // Verifica temperatura (mesma lógica das notificações)
      if (condicaoIdeal.temp_ideal) {
        const diffTemp = Math.abs(parametroAtual.temp_atual - condicaoIdeal.temp_ideal);
        const toleranciaTempValor = condicaoIdeal.temp_ideal * toleranciaTemp;
        
        if (diffTemp > toleranciaTempValor) {
          const severidade = diffTemp > toleranciaTempValor * 2 ? 'alta' : 'media';
          const tipo = parametroAtual.temp_atual > condicaoIdeal.temp_ideal ? 'aumento' : 'diminuição';
          
          alertas.push(severidade);
          
          alertasDetalhados.push({
            tipo: 'temperatura',
            severidade,
            mensagem: `Temperatura com ${tipo}! Atual: ${parametroAtual.temp_atual}°C, Ideal: ${condicaoIdeal.temp_ideal}°C`,
            valorAtual: parametroAtual.temp_atual,
            valorIdeal: condicaoIdeal.temp_ideal,
            diferenca: diffTemp,
            datahora: parametroAtual.datahora
          });
          
          if (severidade === 'alta') {
            status = 'critico';
            statusText = 'CRÍTICO';
            statusColor = '#ef4444';
          } else if (status !== 'critico') {
            status = 'alerta';
            statusText = 'ALERTA';
            statusColor = '#f59e0b';
          }
        }
      }
      
      // Verifica pH (mesma lógica das notificações)
      if (condicaoIdeal.ph_ideal) {
        const diffPh = Math.abs(parametroAtual.ph_atual - condicaoIdeal.ph_ideal);
        const toleranciaPhValor = condicaoIdeal.ph_ideal * toleranciaPh;
        
        if (diffPh > toleranciaPhValor) {
          const severidade = diffPh > toleranciaPhValor * 2 ? 'alta' : 'media';
          const tipo = parametroAtual.ph_atual > condicaoIdeal.ph_ideal ? 'aumento' : 'diminuição';
          
          alertas.push(severidade);
          
          alertasDetalhados.push({
            tipo: 'ph',
            severidade,
            mensagem: `pH com ${tipo}! Atual: ${parametroAtual.ph_atual}, Ideal: ${condicaoIdeal.ph_ideal}`,
            valorAtual: parametroAtual.ph_atual,
            valorIdeal: condicaoIdeal.ph_ideal,
            diferenca: diffPh,
            datahora: parametroAtual.datahora
          });
          
          if (severidade === 'alta') {
            status = 'critico';
            statusText = 'CRÍTICO';
            statusColor = '#ef4444';
          } else if (status !== 'critico') {
            status = 'alerta';
            statusText = 'ALERTA';
            statusColor = '#f59e0b';
          }
        }
      }
      
      // Verifica amônia (mesma lógica das notificações)
      if (condicaoIdeal.amonia_ideal) {
        const diffAmonia = Math.abs(parametroAtual.amonia_atual - condicaoIdeal.amonia_ideal);
        const toleranciaAmoniaValor = condicaoIdeal.amonia_ideal * toleranciaAmonia;
        
        if (diffAmonia > toleranciaAmoniaValor) {
          const severidade = diffAmonia > toleranciaAmoniaValor * 2 ? 'alta' : 'media';
          const tipo = parametroAtual.amonia_atual > condicaoIdeal.amonia_ideal ? 'aumento' : 'diminuição';
          
          alertas.push(severidade);
          
          alertasDetalhados.push({
            tipo: 'amonia',
            severidade,
            mensagem: `Amônia com ${tipo}! Atual: ${parametroAtual.amonia_atual}mg/L, Ideal: ${condicaoIdeal.amonia_ideal}mg/L`,
            valorAtual: parametroAtual.amonia_atual,
            valorIdeal: condicaoIdeal.amonia_ideal,
            diferenca: diffAmonia,
            datahora: parametroAtual.datahora
          });
          
          if (severidade === 'alta') {
            status = 'critico';
            statusText = 'CRÍTICO';
            statusColor = '#ef4444';
          } else if (status !== 'critico') {
            status = 'alerta';
            statusText = 'ALERTA';
            statusColor = '#f59e0b';
          }
        }
      }
      
      // Remove duplicatas dos alertas
      alertas = [...new Set(alertas)];
      
      // Conta os status
      if (status === 'ok') {
        cativeirosOk++;
      } else if (status === 'alerta') {
        cativeirosAlerta++;
      } else if (status === 'critico') {
        cativeirosCritico++;
      }
      
      cativeirosComStatus.push({
        id: cativeiro._id,
        nome: cativeiro.nome || `Cativeiro ${cativeiro._id}`,
        tipo_camarao: cativeiro.id_tipo_camarao?.nome || 'Tipo não informado',
        status,
        statusText,
        statusColor,
        alertas,
        alertasDetalhados,
        totalAlertas: alertasDetalhados.length,
        ultimaAtualizacao: parametroAtual.datahora
      });
    }
    
    res.json({
      success: true,
      cativeiros: cativeirosComStatus,
      resumo: {
        total: totalCativeiros,
        ok: cativeirosOk,
        alerta: cativeirosAlerta,
        critico: cativeirosCritico,
        semDados: cativeirosSemDados
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar status dos cativeiros:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
};

// Método específico para atualizar dados do cativeiro sem enviar resposta
const updateCativeiroData = async (id, data) => {
  try {
    const result = await cativeiroService.update(id, data);
    if (!result) {
      throw new Error('Cativeiro não encontrado.');
    }
    return result;
  } catch (error) {
    throw error;
  }
};

export default { 
  createCativeiro, 
  getAllCativeiros, 
  getAllTiposCamarao, 
  getCativeiroById, 
  updateCativeiro, 
  updateCativeiroData,
  deleteCativeiro, 
  getAllCondicoesIdeais, 
  getSensoresCativeiro, 
  getCativeirosStatus 
}; 