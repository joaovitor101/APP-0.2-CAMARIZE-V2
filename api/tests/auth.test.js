/**
 * Testes unitários para o middleware de autenticação (Auth.js)
 *
 * Testa Authorization, RequireRole e BlockMembersWrite
 * sem necessidade de banco de dados real — tudo é mockado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
// Mock do jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

// Mock do userController (para JWTSecret)
vi.mock('../controllers/userController.js', () => ({
  default: {
    JWTSecret: 'test-secret-key-for-unit-tests',
  },
}));

// Mock do userService
vi.mock('../services/userService.js', () => ({
  default: {
    getById: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';
import userService from '../services/userService.js';
import Auth, { BlockMembersWrite } from '../middleware/Auth.js';

// ── Helpers ─────────────────────────────────────────────────────────
const mockReq = (overrides = {}) => ({
  headers: {},
  query: {},
  method: 'GET',
  path: '/',
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => vi.fn();

// ════════════════════════════════════════════════════════════════════
// Authorization
// ════════════════════════════════════════════════════════════════════
describe('Authorization middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deve retornar 401 quando não há header Authorization', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await Auth.Authorization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 401 quando o token é inválido', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const req = mockReq({ headers: { authorization: 'Bearer token-invalido' } });
    const res = mockRes();
    const next = mockNext();

    await Auth.Authorization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 401 quando o usuário não é encontrado no banco', async () => {
    jwt.verify.mockReturnValue({ id: '123', email: 'a@b.com', role: 'admin', tokenVersion: 0 });
    userService.getById.mockResolvedValue(null);

    const req = mockReq({ headers: { authorization: 'Bearer token-valido' } });
    const res = mockRes();
    const next = mockNext();

    await Auth.Authorization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 401 quando tokenVersion não bate', async () => {
    jwt.verify.mockReturnValue({ id: '123', email: 'a@b.com', role: 'admin', tokenVersion: 0 });
    userService.getById.mockResolvedValue({ _id: '123', tokenVersion: 1 });

    const req = mockReq({ headers: { authorization: 'Bearer token-valido' } });
    const res = mockRes();
    const next = mockNext();

    await Auth.Authorization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Sessão expirada') }));
    expect(next).not.toHaveBeenCalled();
  });

  it('deve chamar next() e popular req.loggedUser quando o token é válido', async () => {
    const payload = { id: '123', email: 'a@b.com', role: 'admin', tokenVersion: 0 };
    jwt.verify.mockReturnValue(payload);
    userService.getById.mockResolvedValue({ _id: '123', tokenVersion: 0 });

    const req = mockReq({ headers: { authorization: 'Bearer token-valido' } });
    const res = mockRes();
    const next = mockNext();

    await Auth.Authorization(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.loggedUser).toEqual(expect.objectContaining({
      id: '123',
      email: 'a@b.com',
      role: 'admin',
    }));
  });
});

// ════════════════════════════════════════════════════════════════════
// RequireRole
// ════════════════════════════════════════════════════════════════════
describe('RequireRole middleware', () => {
  it('deve retornar 401 se req.loggedUser não existe', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    Auth.RequireRole(['admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 403 se o role do usuário não está na lista permitida', () => {
    const req = mockReq();
    req.loggedUser = { id: '1', role: 'membro' };
    const res = mockRes();
    const next = mockNext();

    Auth.RequireRole(['admin', 'master'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deve chamar next() se o role do usuário é permitido', () => {
    const req = mockReq();
    req.loggedUser = { id: '1', role: 'admin' };
    const res = mockRes();
    const next = mockNext();

    Auth.RequireRole(['admin', 'master'])(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// BlockMembersWrite
// ════════════════════════════════════════════════════════════════════
describe('BlockMembersWrite middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deve permitir requisições GET sem restrição', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    const next = mockNext();

    await BlockMembersWrite(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('deve permitir POST em rotas públicas sem autenticação', async () => {
    const req = mockReq({ method: 'POST', path: '/users/auth' });
    const res = mockRes();
    const next = mockNext();

    await BlockMembersWrite(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('deve bloquear membros em rotas de escrita (POST)', async () => {
    jwt.verify.mockReturnValue({ id: '1', role: 'membro' });

    const req = mockReq({
      method: 'POST',
      path: '/fazendas',
      headers: { authorization: 'Bearer token' },
    });
    const res = mockRes();
    const next = mockNext();

    await BlockMembersWrite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deve permitir admin em rotas de escrita (POST)', async () => {
    jwt.verify.mockReturnValue({ id: '1', role: 'admin' });

    const req = mockReq({
      method: 'POST',
      path: '/fazendas',
      headers: { authorization: 'Bearer token' },
    });
    const res = mockRes();
    const next = mockNext();

    await BlockMembersWrite(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
