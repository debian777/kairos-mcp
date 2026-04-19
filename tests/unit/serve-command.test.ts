<<<<<<< HEAD
import { resolveServeServerPort, resolveServeTransport } from '../../src/cli/commands/serve.js';

describe('serve command helpers', () => {
  const origServer = process.env['SERVER_PORT'];
  const origTransport = process.env['TRANSPORT_TYPE'];

  afterEach(() => {
    if (origServer === undefined) delete process.env['SERVER_PORT'];
    else process.env['SERVER_PORT'] = origServer;
=======
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
>>>>>>> dc915b89 (feat(cli): add API_PORT and serve --api-port; sync defaultUrl)
    if (origTransport === undefined) delete process.env['TRANSPORT_TYPE'];
    else process.env['TRANSPORT_TYPE'] = origTransport;
  });

<<<<<<< HEAD
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
=======
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
>>>>>>> dc915b89 (feat(cli): add API_PORT and serve --api-port; sync defaultUrl)
    });
  });

  describe('resolveServeTransport', () => {
    it('defaults to stdio when env unset', () => {
      delete process.env['TRANSPORT_TYPE'];
      expect(resolveServeTransport(undefined, true)).toBe('stdio');
    });
  });
});
