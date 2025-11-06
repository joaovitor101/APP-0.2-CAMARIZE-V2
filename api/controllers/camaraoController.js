import TiposCamarao from "../models/Camaroes.js";

const createCamarao = async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });
    // Verifica se já existe
    let existente = await TiposCamarao.findOne({ nome });
    if (existente) return res.status(200).json(existente);
    const novo = new TiposCamarao({ nome });
    await novo.save();
    res.status(201).json(novo);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar tipo de camarão." });
  }
};

const getAllCamaroes = async (req, res) => {
  try {
    const tipos = await TiposCamarao.find().lean(); // Usa lean() para melhor performance
    res.status(200).json(tipos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tipos de camarão." });
  }
};

export default { createCamarao, getAllCamaroes }; 