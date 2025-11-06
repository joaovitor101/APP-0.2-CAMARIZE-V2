import express from "express";
const userRoutes = express.Router();
import userController from "../controllers/userController.js";
import Auth from "../middleware/Auth.js";

// Endpoint para cadastrar um usuário
userRoutes.post("/user", userController.createUser);

// Endpoint para autenticação (login) do usuário
userRoutes.post("/auth", userController.loginUser);

// Endpoint para cadastro completo (usuário + sitio)
userRoutes.post("/register", userController.register);

// Endpoint para cadastro de proprietário (cria solicitação)
userRoutes.post("/register/proprietario", userController.registerProprietario);

// Endpoint para cadastro de funcionário (cria solicitação)
userRoutes.post("/register/funcionario", userController.registerFuncionario);

// Endpoint para verificar se email existe
userRoutes.post("/check-email", userController.checkEmailExists);

// Endpoint para buscar usuário atual (requer autenticação)
userRoutes.get("/me", Auth.Authorization, userController.getCurrentUser);

// Lista masters: permitir admin e master (precisa vir ANTES de '/:id')
userRoutes.get('/masters/all', Auth.Authorization, Auth.RequireRole(['admin','master']), userController.listMasters);

userRoutes.get('/:id', userController.getUserById);

// Endpoint para atualizar foto do usuário
userRoutes.patch('/:id/photo', userController.updateUserPhoto);

// Listar usuários (somente master)
userRoutes.get('/', Auth.Authorization, Auth.RequireRole(['master']), userController.listUsers);

// Alterar role do usuário (somente master)
userRoutes.patch('/:id/role', Auth.Authorization, Auth.RequireRole(['master']), userController.changeUserRole);

// Associar funcionário à fazenda do admin (somente admin)
userRoutes.post('/associar-funcionario', Auth.Authorization, Auth.RequireRole(['admin']), userController.associarFuncionario);

export default userRoutes;