import { resolveServeApiPort, resolveServeTransport } from '../../src/cli/commands/serve.js';

describe('serve command helpers', () => {
  const origApi = process.env['API_PORT'];
  const origPort = process.env.PORT;
  const origTransport = process.env['TRANSPORT_TYPE'];

  afterEach(() => {
    if (origApi === undefined) delete process.env['API_PORT'];
    else process.env['API_PORT'] = origApi;
    if (origPort === undefined) delete process.env.PORT;
    else process.env.PORT = origPort;
    if (origTransport === undefined) delete process.env['TRANSPORT_TYPE'];
    else process.env['TRANSPORT_TYPE'] = origTransport;
  });

  describe('resolveServeApiPort', () => {
    it('prefers --api-port over env', () => {
      process.env['API_PORT'] = '1111';
      process.env.PORT = '2222';
      expect(resolveServeApiPort('3333')).toBe(3333);
    });

    it('uses API_PORT when CLI omitted', () => {
      delete process.env.PORT;
      process.env['API_PORT'] = '4300';
      expect(resolveServeApiPort(undefined)).toBe(4300);
    });

    it('falls back to PORT when API_PORT unset', () => {
      delete process.env['API_PORT'];
      process.env.PORT = '3300';
      expect(resolveServeApiPort(undefined)).toBe(3300);
    });

    it('returns undefined when nothing set', () => {
      delete process.env['API_PORT'];
      delete process.env.PORT;
      expect(resolveServeApiPort(undefined)).toBeUndefined();
    });

    it('rejects invalid port', () => {
      expect(() => resolveServeApiPort('0')).toThrow(/Invalid/);
    });
  });

  describe('resolveServeTransport', () => {
    it('defaults to stdio when env unset', () => {
      delete process.env['TRANSPORT_TYPE'];
      expect(resolveServeTransport(undefined, true)).toBe('stdio');
    });
  });
});
