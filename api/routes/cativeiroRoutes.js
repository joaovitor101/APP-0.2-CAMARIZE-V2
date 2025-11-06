import express from "express";
const cativeiroRoutes = express.Router();
import cativeiroController from "../controllers/cativeiroController.js";
import multer from 'multer';
const upload = multer();
import Auth from '../middleware/Auth.js';

// Endpoint para cadastrar cativeiro
cativeiroRoutes.post("/cativeiros", Auth.Authorization, upload.single('foto_cativeiro'), cativeiroController.createCativeiro);
// Endpoint para listar todos os cativeiros
cativeiroRoutes.get("/cativeiros", Auth.Authorization, cativeiroController.getAllCativeiros);
// Endpoint para buscar status geral dos cativeiros
cativeiroRoutes.get("/cativeiros-status", Auth.Authorization, cativeiroController.getCativeirosStatus);
cativeiroRoutes.get("/cativeiros/:id", cativeiroController.getCativeiroById);
cativeiroRoutes.get("/cativeiros/:cativeiroId/sensores", cativeiroController.getSensoresCativeiro);
cativeiroRoutes.get("/tipos-camarao", cativeiroController.getAllTiposCamarao);
cativeiroRoutes.get("/condicoes-ideais", cativeiroController.getAllCondicoesIdeais);
// Endpoint para atualizar cativeiro
cativeiroRoutes.put("/cativeiros/:id", Auth.Authorization, upload.single('foto_cativeiro'), cativeiroController.updateCativeiro);
// Endpoint para atualizar cativeiro (PATCH para atualizações parciais)
cativeiroRoutes.patch("/cativeiros/:id", Auth.Authorization, cativeiroController.updateCativeiro);
// Endpoint para deletar cativeiro
cativeiroRoutes.delete("/cativeiros/:id", Auth.Authorization, cativeiroController.deleteCativeiro);

// Endpoint para atualizar foto do cativeiro
cativeiroRoutes.post("/cativeiros/:id/foto", Auth.Authorization, upload.single('foto'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário é admin ou master
    if (!req.loggedUser || (req.loggedUser.role !== 'admin' && req.loggedUser.role !== 'master')) {
      return res.status(403).json({ error: "Apenas administradores e masters podem alterar a foto do cativeiro." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma foto foi enviada." });
    }

    // Preparar os dados para atualização
        await cativeiroController.updateCativeiroData(id, { foto_cativeiro: req.file.buffer });
    
    // Chamar o controller sem passar o res
    await cativeiroController.updateCativeiroData(id, req.body);

    res.status(200).json({ message: "Foto do cativeiro atualizada com sucesso!" });
  } catch (error) {
    console.error('Erro ao atualizar foto do cativeiro:', error);
    res.status(500).json({ error: "Erro ao atualizar foto do cativeiro." });
  }
});

// Endpoint para obter foto do cativeiro
cativeiroRoutes.get("/cativeiros/:id/foto", async (req, res) => {
  try {
    const { id } = req.params;
    const cativeiro = await cativeiroController.getCativeiroById({ params: { id } }, { json: () => {} });
    
    if (!cativeiro || !cativeiro.foto_cativeiro) {
      return res.status(404).send("Sem foto");
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(cativeiro.foto_cativeiro);
  } catch (error) {
    console.error('Erro ao buscar foto do cativeiro:', error);
    res.status(500).send("Erro ao buscar foto do cativeiro");
  }
});

export default cativeiroRoutes; 