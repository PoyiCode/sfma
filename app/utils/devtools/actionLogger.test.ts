import { describe, expect, it, vi } from 'vitest';
import { createConsoleActionLogger, createNoopActionLogger } from './actionLogger';

describe('createConsoleActionLogger', () => {
  it('格式 [module] action — detail（detail 經 redactPii）', () => {
    const out = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createConsoleActionLogger(out);
    logger.log('navigation', 'routeChange', '/a→/b');
    expect(out.log).toHaveBeenCalledWith('[navigation] routeChange — /a→/b');
  });
  it('無 detail 時僅 [module] action', () => {
    const out = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    createConsoleActionLogger(out).warn('data', 'persistStorage');
    expect(out.warn).toHaveBeenCalledWith('[data] persistStorage');
  });
  it('detail 內個資被遮蔽', () => {
    const out = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    createConsoleActionLogger(out).log('settings', 'x', 'a@b.com');
    expect(out.log).toHaveBeenCalledWith('[settings] x — [已遮蔽:電子郵件]');
  });
});

describe('createNoopActionLogger', () => {
  it('不呼叫任何 sink、不拋', () => {
    const logger = createNoopActionLogger();
    expect(() => logger.log('m', 'a', 'd')).not.toThrow();
  });
});
