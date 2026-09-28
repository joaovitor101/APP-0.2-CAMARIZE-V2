# Camarize V2

Plataforma de monitoramento para aquicultura (camarões). Conecta sensores IoT (ESP32) a tanques e viveiros, monitora parâmetros (temperatura, pH, amônia) e envia alertas automatizados quando as condições saem da faixa ideal.

## Estrutura do projeto

```
api/           — Backend Express.js (porta 4000)
front-react/   — Frontend Next.js 14 (porta 3000)
esp32/         — Firmware Arduino para o ESP32
docs/          — Documentação técnica
scripts/       — Scripts de manutenção do banco
tools/         — Docker Compose e configurações
```

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Acesso ao MongoDB Atlas (solicite ao responsável pelo projeto)
- [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) — necessário apenas para a carga inicial do banco de dev

```bash
# Instalar MongoDB Database Tools no macOS
brew tap mongodb/brew
brew install mongodb-database-tools
```

## Configuração para desenvolvimento (Docker)

O ambiente Docker conecta ao banco `camarize-dev` no Atlas — separado do banco de produção. Nunca modifica dados reais.

### 1. Clonar e configurar variáveis de ambiente

```bash
git clone <url-do-repositorio>
cd APP-0.2-CAMARIZE-V2

cp api/.env.docker.example api/.env.docker
```

Abra `api/.env.docker` e preencha:
- `JWT_SECRET` — gere um valor seguro com `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` — solicite ao responsável pelo projeto

A `MONGO_URL` já aponta para `camarize-dev` e não precisa ser alterada.

### 2. Popular o banco de desenvolvimento (primeira vez)

O banco `camarize-dev` começa vazio. Para ter os mesmos dados do banco de produção, peça a URL de produção ao responsável e rode:

```bash
# Dentro de tools/ (ou qualquer pasta, ajuste o --out)
mongodump --uri="URL_DE_PRODUCAO" --out=./dump

mongorestore \
  --uri="MONGO_URL=mongodb+srv://USUARIO:SENHA@SEU_CLUSTER.mongodb.net/camarize-dev?retryWrites=true&w=majority" \
  ./dump/NOME_DO_BANCO_DE_PRODUCAO
```

> O `NOME_DO_BANCO_DE_PRODUCAO` é o nome que aparece no final da URL de produção, antes do `?`.

### 3. Subir os containers

```bash
cd tools
docker compose up --build   # primeira vez
docker compose up           # execuções seguintes
docker compose down         # parar
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- Swagger: http://localhost:4000/api-docs

## Configuração para desenvolvimento (Node.js local)

Se preferir rodar sem Docker:

```bash
# API
cp api/env.example api/.env
# Preencha MONGO_URL, JWT_SECRET e as demais variáveis em api/.env
cd api && npm install && npm start

# Frontend (outro terminal)
cd front-react && npm install && npm run dev
```

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `MONGO_URL` | Connection string do MongoDB Atlas |
| `JWT_SECRET` | Chave para assinar tokens JWT (obrigatório) |
| `EMAIL_USER` | Gmail para envio de alertas |
| `EMAIL_PASS` | Senha de app do Gmail |
| `FRONTEND_URL` | URL do frontend (usada nos links dos e-mails) |
| `VAPID_PUBLIC_KEY` | Chave pública para push notifications |
| `VAPID_PRIVATE_KEY` | Chave privada para push notifications |
| `ENABLE_AUTO_MONITORING` | Ativa o serviço de monitoramento (`true`/`false`) |
| `MONITORING_INTERVAL_MINUTES` | Frequência do monitoramento em minutos |
| `VALIDATE_EMAIL_ON_REGISTER` | Valida e-mail no cadastro (`true`/`false`) |

## Scripts úteis

```bash
cd api
npm run debug                  # Debug da conexão com MongoDB
npm run test-api               # Testa status da API
npm run populate-parametros    # Insere leituras de sensor de teste
npm run clear-all              # Limpa todos os dados mockados
```

## Documentação

- `docs/ERD_CAMARIZE.md` — Diagrama entidade-relacionamento
- `docs/API_README.md` — Referência dos endpoints da API
- `docs/README_ESP32.md` — Integração com o dispositivo IoT
- `docs/MONGODB_ATLAS_SETUP.md` — Configuração do banco de dados
- `/api-docs` — Swagger UI (quando a API estiver rodando)
