# 🚀 API Camarize

Bem-vindo à documentação da API backend do sistema de monitoramento de fazendas de camarões.
Esta API é construída em **Node.js + Express** e utiliza **MongoDB** via Mongoose como banco de dados.

## 📁 Estrutura do Projeto (Pasta `/api`)

```text
api/
├── 📁 controllers/          # Controladores da aplicação (Lógica de requisição/resposta)
├── 📁 middleware/           # Middlewares (Autenticação JWT, Validação de Roles, Cache)
├── 📁 models/               # Modelos e Schemas do MongoDB (Mongoose)
├── 📁 routes/               # Definição das rotas e endpoints da API
├── 📁 services/             # Lógica de negócios centralizada
├── 📁 tests/                # Testes Unitários automatizados (Vitest)
├── 📄 index.js              # Ponto de entrada (Entrypoint) do servidor Express
├── 📄 package.json          # Dependências e scripts NPM
└── 📄 .env                  # Variáveis de ambiente (não versionado)
```

## 🚀 Início Rápido

### 1. Requisitos
- Node.js (v18+)
- Conta no MongoDB Atlas ou MongoDB local rodando.

### 2. Instalação e Configuração
```bash
# Na pasta api, instale as dependências:
npm install

# Crie seu arquivo de ambiente copiando o template (se houver) ou crie manualmente:
# Crie um arquivo .env com o seguinte conteúdo base:
# PORT=4000
# MONGO_URL=mongodb+srv://...
# JWT_SECRET=seu_segredo_jwt
```
> **Nota:** Para detalhes sobre como configurar o banco de dados online, veja o arquivo [MONGODB_ATLAS_SETUP.md](./MONGODB_ATLAS_SETUP.md) nesta mesma pasta.

### 3. Executando o Servidor
```bash
# Inicia a API em modo de desenvolvimento (usando nodemon para auto-reload)
npm start
```
A API estará acessível em `http://localhost:4000` (ou na porta configurada).

## 🔧 Comandos e Scripts Disponíveis

A API possui comandos NPM configurados para facilitar o desenvolvimento:

- **`npm start`** - Inicia o servidor em modo watch (Nodemon).
- **`npm run lint`** - Executa o ESLint para encontrar erros de formatação ou de código.
- **`npm run test`** - Executa a suíte de **Testes Unitários** utilizando o Vitest.
- **`npm run test:watch`** - Executa os testes em modo watch (re-executa ao salvar arquivos).
- **`npm run test:coverage`** - Executa os testes e gera um relatório detalhado de cobertura de código (`coverage/`).

## 🧪 Testes Unitários e CI/CD

O projeto utiliza **Vitest** para garantir a confiabilidade das regras de negócio.
Os testes estão localizados na pasta `api/tests/` e cobrem:
- **Middlewares de Segurança:** Verificação de JWT, Roles (Membro, Admin, Master) e bloqueios de escrita.
- **Services:** Testes focados na lógica de banco de dados (Fazendas, Usuários, etc) através de _Mocks_.

Toda vez que você envia um código (Push/Pull Request) para a branch `main`, o **GitHub Actions** (`.github/workflows/ci.yml`) executa automaticamente:
1. O Linter (`npm run lint`).
2. Os testes automatizados (`npm run test:coverage`).
3. Auditoria de segurança de dependências (`npm audit`).
4. Build de validação Docker.

Você deve garantir que os testes locais passem antes de solicitar um Merge.

## 🗄️ Modelagem de Dados (Banco de Dados)

O banco de dados é gerido de forma NoSQL via **MongoDB**, mas com uma estrutura fortemente referenciada para lidar com a complexidade do domínio.

Para visualizar as Entidades e Relacionamentos do banco de dados, consulte o diagrama oficial:
👉 **[Ver Diagrama de Entidade-Relacionamento (ERD_CAMARIZE.md)](./ERD_CAMARIZE.md)**

## 🔐 Segurança e Autenticação

- **JWT (JSON Web Tokens):** Utilizado para validar a identidade nas requisições. O token deve ser enviado no cabeçalho `Authorization: Bearer <token>`.
- **RBAC (Role-Based Access Control):** A API restringe rotas dependendo do papel do usuário (`membro`, `admin`, `master`).
- **Membros vs. Escrita:** Usuários com o perfil `membro` são automaticamente bloqueados em rotas HTTP de mutação (`POST`, `PUT`, `PATCH`, `DELETE`) pelo middleware global, precisando criar solicitações de alteração para que um `admin` aprove.

## 📞 Suporte / Debugging

Se houver problemas na inicialização:
1. Verifique se o seu IP está liberado na Whitelist do **MongoDB Atlas**.
2. Verifique os logs gerados pelo terminal do Node.js.
3. Certifique-se de que a porta `4000` não está sendo ocupada por outro processo local.