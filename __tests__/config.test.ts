const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('config', () => {
  it('throws when DAILY_API_KEY is missing', () => {
    delete process.env['DAILY_API_KEY'];
    process.env['DATABASE_URL'] = 'postgresql://test';
    expect(() => require('../config')).toThrow('DAILY_API_KEY');
  });

  it('throws when DATABASE_URL is missing', () => {
    process.env['DAILY_API_KEY'] = 'test-key';
    delete process.env['DATABASE_URL'];
    expect(() => require('../config')).toThrow('DATABASE_URL');
  });

  it('returns valid config when all required env vars are set', () => {
    process.env['DAILY_API_KEY'] = 'daily-key-123';
    process.env['DATABASE_URL'] = 'postgresql://localhost/test';
    process.env['PORT'] = '4000';
    process.env['EMR_CORE_BASE_URL'] = 'http://emr:3000';
    process.env['EMR_CORE_API_TOKEN'] = 'emr-token';

    const { config } = require('../config') as typeof import('../config');

    expect(config.dailyApiKey).toBe('daily-key-123');
    expect(config.databaseUrl).toBe('postgresql://localhost/test');
    expect(config.port).toBe(4000);
    expect(config.emrCoreBaseUrl).toBe('http://emr:3000');
    expect(config.emrCoreApiToken).toBe('emr-token');
  });

  it('defaults port to 3001 when PORT is not set', () => {
    process.env['DAILY_API_KEY'] = 'k';
    process.env['DATABASE_URL'] = 'postgresql://test';
    delete process.env['PORT'];

    const { config } = require('../config') as typeof import('../config');
    expect(config.port).toBe(3001);
  });

  it('defaults emrCoreBaseUrl when EMR_CORE_BASE_URL is not set', () => {
    process.env['DAILY_API_KEY'] = 'k';
    process.env['DATABASE_URL'] = 'postgresql://test';
    delete process.env['EMR_CORE_BASE_URL'];

    const { config } = require('../config') as typeof import('../config');
    expect(config.emrCoreBaseUrl).toBe('http://localhost:3000');
  });
});
