/**
 * Testes unitários para o middleware de cache (cache.js)
 */
import { describe, it, expect, vi } from 'vitest';
import cache from '../middleware/cache.js';

const mockRes = () => {
  const res = {};
  res.set = vi.fn().mockReturnValue(res);
  return res;
};

describe('cache middleware — noStore', () => {
  it('deve definir Cache-Control: no-store', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    cache.noStore(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalled();
  });
});

describe('cache middleware — cacheControl', () => {
  it('deve definir max-age corretamente', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    cache.cacheControl(60)(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, max-age=60');
    expect(res.set).toHaveBeenCalledWith('Vary', 'Authorization');
    expect(next).toHaveBeenCalled();
  });

  it('deve incluir stale-while-revalidate quando swrMaxAge > 0', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    cache.cacheControl(300, 120)(req, res, next);

    expect(res.set).toHaveBeenCalledWith(
      'Cache-Control',
      'private, max-age=300, stale-while-revalidate=120'
    );
    expect(next).toHaveBeenCalled();
  });
});
