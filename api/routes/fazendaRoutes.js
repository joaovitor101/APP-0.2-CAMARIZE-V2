import express from "express";
const fazendaRoutes = express.Router();
import fazendaController from "../controllers/fazendaController.js";
import Auth from '../middleware/Auth.js';

// Endpoint público para listar todas as fazendas (para cadastro de funcionário)
fazendaRoutes.get("/public", fazendaController.getAllFazendasPublic);

// Endpoint para cadastrar uma fazenda
fazendaRoutes.post("/", Auth.Authorization, fazendaController.createFazenda);

// Endpoint para listar todas as fazendas (filtrado por usuário se não for master)
fazendaRoutes.get("/", Auth.Authorization, fazendaController.getAllFazendas);

// Endpoint para buscar fazenda por ID
fazendaRoutes.get("/:id", fazendaController.getFazendaById);

// Endpoint para atualizar foto da fazenda
fazendaRoutes.patch("/:id/foto", fazendaController.updateFotoFazenda);

// Endpoint para buscar foto da fazenda
fazendaRoutes.get("/:id/foto", fazendaController.getFotoFazenda);

export default fazendaRoutes; 