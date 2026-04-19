import { resolveServeServerPort, resolveServeTransport } from '../../src/cli/commands/serve.js';

describe('serve command helpers', () => {
  const origServer = process.env['SERVER_PORT'];
  const origTransport = process.env['TRANSPORT_TYPE'];

  afterEach(() => {
    if (origServer === undefined) delete process.env['SERVER_PORT'];
    else process.env['SERVER_PORT'] = origServer;
    if (origTransport === undefined) delete process.env['TRANSPORT_TYPE'];
    else process.env['TRANSPORT_TYPE'] = origTransport;
  });

  describe('resolveServeServerPort', () => {
    it('prefers --server-port over env', () => {
      process.env['SERVER_PORT'] = '1111';
      expect(resolveServeServerPort('3333')).toBe(3333);
    });

    it('uses SERVER_PORT when CLI omitted', () => {
      process.env['SERVER_PORT'] = '4300';
      expect(resolveServeServerPort(undefined)).toBe(4300);
    });

    it('returns undefined when SERVER_PORT unset', () => {
      delete process.env['SERVER_PORT'];
      expect(resolveServeServerPort(undefined)).toBeUndefined();
    });

    it('rejects invalid port', () => {
      expect(() => resolveServeServerPort('0')).toThrow(/Invalid/);
    });
  });

  describe('resolveServeTransport', () => {
    it('defaults to stdio when env unset', () => {
      delete process.env['TRANSPORT_TYPE'];
      expect(resolveServeTransport(undefined, true)).toBe('stdio');
    });
  });
});
