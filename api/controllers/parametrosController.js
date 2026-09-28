import mongoose from "mongoose";
import ParametrosAtuais from "../models/Parametros_atuais.js";
import Cativeiros from "../models/Cativeiros.js";
import cativeiroController from "../controllers/cativeiroController.js";
import parametrosEmitter from "../services/parametrosEmitter.js";

// POST - Receber dados dos sensores do ESP32
const cadastrarParametros = async (req, res) => {
  try {
    const { id_cativeiro, temperatura, ph, amonia } = req.body;

    if (!id_cativeiro) {
      return res.status(400).json({ error: "ID do cativeiro é obrigatório" });
    }

    if (temperatura === undefined || ph === undefined || amonia === undefined) {
      return res.status(400).json({ error: "Temperatura, pH e amônia são obrigatórios" });
    }

    if (typeof temperatura !== 'number' || typeof ph !== 'number' || typeof amonia !== 'number') {
      return res.status(400).json({ error: "Temperatura, pH e amônia devem ser números" });
    }

    const cativeiro = await Cativeiros.findById(id_cativeiro);
    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    const novoParametro = new ParametrosAtuais({
      id_cativeiro,
      temp_atual: temperatura,
      ph_atual: ph,
      amonia_atual: amonia,
      datahora: new Date()
    });

    await novoParametro.save();

    // Notifica dashboards abertos para esse cativeiro
    parametrosEmitter.emit(`parametro:${id_cativeiro.toString()}`);

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

    const access = await cativeiroController.assertCativeiroAccess(cativeiroId, req.loggedUser.id, req.loggedUser.role);
    if (access === null) return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    if (access === false) return res.status(403).json({ error: 'Acesso negado.' });

    const [cativeiro, parametroAtual] = await Promise.all([
      Cativeiros.findById(cativeiroId).lean(),
      ParametrosAtuais.findOne({ id_cativeiro: cativeiroId }).sort({ datahora: -1 }).lean()
    ]);

    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    const parametros = parametroAtual ? {
      temperatura: parametroAtual.temp_atual,
      ph: parametroAtual.ph_atual,
      amonia: parametroAtual.amonia_atual,
      datahora: parametroAtual.datahora
    } : { temperatura: null, ph: null, amonia: null, datahora: null };

    res.json({ cativeiro: { id: cativeiro._id, nome: cativeiro.nome }, parametros });

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

    const access = await cativeiroController.assertCativeiroAccess(cativeiroId, req.loggedUser.id, req.loggedUser.role);
    if (access === null) return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    if (access === false) return res.status(403).json({ error: 'Acesso negado.' });

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - parseInt(dias));

    const [cativeiro, parametros] = await Promise.all([
      Cativeiros.findById(cativeiroId).lean(),
      ParametrosAtuais.find({
        id_cativeiro: cativeiroId,
        datahora: { $gte: dataLimite }
      }).sort({ datahora: 1 }).lean().limit(1000)
    ]);

    if (!cativeiro) {
      return res.status(404).json({ error: "Cativeiro não encontrado" });
    }

    if (parametros.length === 0) {
      return res.json({ cativeiro: { id: cativeiro._id, nome: cativeiro.nome }, dados: [] });
    }

    const dadosFormatados = parametros.map(p => ({
      datahora: p.datahora,
      temperatura: p.temp_atual,
      ph: p.ph_atual,
      amonia: p.amonia_atual
    }));

    res.json({
      cativeiro: { id: cativeiro._id, nome: cativeiro.nome },
      periodo: `${dias} dias`,
      total_registros: dadosFormatados.length,
      dados: dadosFormatados
    });

  } catch (error) {
    console.error('Erro ao buscar parâmetros históricos:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Busca os dados do dashboard para um cativeiro — reutilizada por REST e SSE
async function fetchDashboardData(cativeiroId) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 7);

  const [cativeiro, parametroAtual, dadosAgregados] = await Promise.all([
    Cativeiros.findById(cativeiroId).lean(),
    ParametrosAtuais.findOne({ id_cativeiro: cativeiroId }).sort({ datahora: -1 }).lean(),
    ParametrosAtuais.aggregate([
      {
        $match: {
          id_cativeiro: new mongoose.Types.ObjectId(cativeiroId),
          datahora: { $gte: dataLimite }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$datahora" } },
          temperatura: { $avg: "$temp_atual" },
          ph: { $avg: "$ph_atual" },
          amonia: { $avg: "$amonia_atual" }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  if (!cativeiro) return null;

  const dadosAtuais = parametroAtual ? {
    temperatura: parametroAtual.temp_atual,
    ph: parametroAtual.ph_atual,
    amonia: parametroAtual.amonia_atual,
    datahora: parametroAtual.datahora
  } : { temperatura: null, ph: null, amonia: null, datahora: null };

  const dadosPorDia = new Map();
  dadosAgregados.forEach(item => {
    dadosPorDia.set(item._id, { temperatura: item.temperatura, ph: item.ph, amonia: item.amonia });
  });

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
      dadosSemanais.push({ data: dia, temperatura: null, ph: null, amonia: null });
    }
  }

  return {
    cativeiro: { id: cativeiro._id, nome: cativeiro.nome },
    dadosAtuais,
    dadosSemanais
  };
}

// GET - Dados do dashboard via requisição REST normal
const getDadosDashboard = async (req, res) => {
  try {
    const { cativeiroId } = req.params;
    if (!cativeiroId) return res.status(400).json({ error: "ID do cativeiro é obrigatório" });

    const access = await cativeiroController.assertCativeiroAccess(cativeiroId, req.loggedUser.id, req.loggedUser.role);
    if (access === null) return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    if (access === false) return res.status(403).json({ error: 'Acesso negado.' });

    const dados = await fetchDashboardData(cativeiroId);
    if (!dados) return res.status(404).json({ error: "Cativeiro não encontrado" });
    res.json(dados);

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// GET /parametros/stream/:cativeiroId — SSE: envia dados imediatamente e a cada nova leitura
const streamDashboard = async (req, res) => {
  const { cativeiroId } = req.params;

  try {
    const access = await cativeiroController.assertCativeiroAccess(cativeiroId, req.loggedUser.id, req.loggedUser.role);
    if (access === null) return res.status(404).json({ error: 'Cativeiro não encontrado.' });
    if (access === false) return res.status(403).json({ error: 'Acesso negado.' });
  } catch (error) {
    return res.status(500).json({ error: "Erro interno do servidor" });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': stream-start\n\n');

  console.log(`[SSE] stream aberto para cativeiroId=${cativeiroId}`);

  const push = async () => {
    try {
      const dados = await fetchDashboardData(cativeiroId);
      if (dados) {
        res.write(`data: ${JSON.stringify(dados)}\n\n`);
        console.log(`[SSE] dados enviados para cativeiroId=${cativeiroId}`);
      } else {
        console.error(`[SSE] fetchDashboardData retornou null para cativeiroId=${cativeiroId}`);
        res.end();
      }
    } catch (err) {
      console.error(`[SSE] erro em push() para cativeiroId=${cativeiroId}:`, err.message);
      try { res.end(); } catch (_ignored) { /* connection already closed */ }
    }
  };

  await push();

  const eventKey = `parametro:${cativeiroId}`;
  parametrosEmitter.on(eventKey, push);

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_e) { clearInterval(keepalive); }
  }, 15_000);

  req.on('close', () => {
    parametrosEmitter.off(eventKey, push);
    clearInterval(keepalive);
    console.log(`[SSE] stream fechado para cativeiroId=${cativeiroId}`);
  });
};

export {
  cadastrarParametros,
  getParametrosAtuais,
  getParametrosHistoricos,
  getDadosDashboard,
  streamDashboard
};
