import ParametrosAtuais from "../models/Parametros_atuais.js";
import Cativeiros from "../models/Cativeiros.js";

// POST - Receber dados dos sensores do ESP32
const cadastrarParametros = async (req, res) => {
  try {
    const { id_cativeiro, temperatura, ph, amonia } = req.body;

    // Validação dos dados obrigatórios
    if (!id_cativeiro) {
      return res.status(400).json({ error: "ID do cativeiro é obrigatório" });
    }

    if (temperatura === undefined || ph === undefined || amonia === undefined) {
      return res.status(400).json({ error: "Temperatura, pH e amônia são obrigatórios" });
    }

    // Validação dos tipos de dados
    if (typeof temperatura !== 'number' || typeof ph !== 'number' || typeof amonia !== 'number') {
      return res.status(400).json({ error: "Temperatura, pH e amônia devem ser números" });
    }

    // Verificar se o cativeiro existe
    const cativeiro = await Cativeiros.findById(id_cativeiro);
    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    // Criar novo registro de parâmetros
    const novoParametro = new ParametrosAtuais({
      id_cativeiro,
      temp_atual: temperatura,
      ph_atual: ph,
      amonia_atual: amonia,
      datahora: new Date()
    });

    await novoParametro.save();

    res.status(201).json({
      success: true,
      message: "Parâmetros cadastrados com sucesso",
      data: {
        id: novoParametro._id,
        cativeiro: cativeiro.nome,
        temperatura,
        ph,
        amonia,
        datahora: novoParametro.datahora
      }
    });

  } catch (error) {
    console.error('Erro ao cadastrar parâmetros:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// GET - Buscar dados atuais de um cativeiro específico
const getParametrosAtuais = async (req, res) => {
  try {
    const { cativeiroId } = req.params;
    
    if (!cativeiroId) {
      return res.status(400).json({ error: "ID do cativeiro é obrigatório" });
    }

    // Busca o cativeiro e parâmetro em paralelo para melhor performance
    const [cativeiro, parametroAtual] = await Promise.all([
      Cativeiros.findById(cativeiroId).lean(),
      ParametrosAtuais.findOne({ id_cativeiro: cativeiroId }).sort({ datahora: -1 }).lean()
    ]);
    
    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    // Se não há dados, usa valores padrão
    const parametros = parametroAtual ? {
      temperatura: parametroAtual.temp_atual,
      ph: parametroAtual.ph_atual,
      amonia: parametroAtual.amonia_atual,
      datahora: parametroAtual.datahora
    } : {
      temperatura: null,
      ph: null,
      amonia: null,
      datahora: null
    };

    res.json({
      cativeiro: {
        id: cativeiro._id,
        nome: cativeiro.nome
      },
      parametros: parametros
    });

  } catch (error) {
    console.error('Erro ao buscar parâmetros atuais:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// GET - Buscar dados históricos dos últimos X dias
const getParametrosHistoricos = async (req, res) => {
  try {
    const { cativeiroId } = req.params;
    const { dias = 7 } = req.query;
    
    if (!cativeiroId) {
      return res.status(400).json({ error: "ID do cativeiro é obrigatório" });
    }

    // Busca o cativeiro e calcula data limite
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(dias));
    
    // Busca cativeiro e parâmetros em paralelo
    const [cativeiro, parametros] = await Promise.all([
      Cativeiros.findById(cativeiroId).lean(),
      ParametrosAtuais.find({
        id_cativeiro: cativeiroId,
        datahora: { $gte: dataLimite }
      }).sort({ datahora: 1 }).lean().limit(1000) // Limite para evitar sobrecarga
    ]);
    
    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    // Se não há dados históricos, retorna array vazio
    if (parametros.length === 0) {
      return res.json({
        cativeiro: {
          id: cativeiro._id,
          nome: cativeiro.nome
        },
        dados: []
      });
    }

    // Formata os dados para retorno
    const dadosFormatados = parametros.map(parametro => ({
      datahora: parametro.datahora,
      temperatura: parametro.temp_atual,
      ph: parametro.ph_atual,
      amonia: parametro.amonia_atual
    }));

    res.json({
      cativeiro: {
        id: cativeiro._id,
        nome: cativeiro.nome
      },
      periodo: `${dias} dias`,
      total_registros: dadosFormatados.length,
      dados: dadosFormatados
    });

  } catch (error) {
    console.error('Erro ao buscar parâmetros históricos:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// GET - Buscar dados para o dashboard (atual + histórico resumido)
const getDadosDashboard = async (req, res) => {
  try {
    const { cativeiroId } = req.params;
    
    if (!cativeiroId) {
      return res.status(400).json({ error: "ID do cativeiro é obrigatório" });
    }

    // OTIMIZAÇÃO: Buscar cativeiro e dados em paralelo + usar agregação
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 7);
    
    const [cativeiro, parametroAtual, dadosAgregados] = await Promise.all([
      Cativeiros.findById(cativeiroId).lean(),
      ParametrosAtuais.findOne({ id_cativeiro: cativeiroId }).sort({ datahora: -1 }).lean(),
      // Usar agregação para calcular médias diárias diretamente no banco
      ParametrosAtuais.aggregate([
        {
          $match: {
            id_cativeiro: cativeiroId,
            datahora: { $gte: dataLimite }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$datahora" }
            },
            temperatura: { $avg: "$temp_atual" },
            ph: { $avg: "$ph_atual" },
            amonia: { $avg: "$amonia_atual" }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    // Se não há dados, usa valores padrão
    const dadosAtuais = parametroAtual ? {
      temperatura: parametroAtual.temp_atual,
      ph: parametroAtual.ph_atual,
      amonia: parametroAtual.amonia_atual,
      datahora: parametroAtual.datahora
    } : {
      temperatura: null,
      ph: null,
      amonia: null,
      datahora: null
    };

    // Criar mapa dos dados agregados
    const dadosPorDia = new Map();
    dadosAgregados.forEach(item => {
      dadosPorDia.set(item._id, {
        temperatura: item.temperatura,
        ph: item.ph,
        amonia: item.amonia
      });
    });

    // Calcula médias diárias para os últimos 7 dias
    const dadosSemanais = [];
    for (let i = 6; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      const dia = data.toISOString().split('T')[0];
      
      const dados = dadosPorDia.get(dia);
      if (dados) {
        dadosSemanais.push({
          data: dia,
          temperatura: Number(dados.temperatura.toFixed(2)),
          ph: Number(dados.ph.toFixed(2)),
          amonia: Number(dados.amonia.toFixed(3))
        });
      } else {
        // Se não há dados para este dia, usa valores padrão
        dadosSemanais.push({
          data: dia,
          temperatura: null,
          ph: null,
          amonia: null
        });
      }
    }

    res.json({
      cativeiro: {
        id: cativeiro._id,
        nome: cativeiro.nome
      },
      dadosAtuais: dadosAtuais,
      dadosSemanais: dadosSemanais
    });

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export {
  cadastrarParametros,
  getParametrosAtuais,
  getParametrosHistoricos,
  getDadosDashboard
}; 