const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  // Provide all required vars by default; each test overrides what it needs
  process.env = {
    ...ORIGINAL_ENV,
    DAILY_API_KEY:  'test-daily-key',
    DATABASE_URL:   'postgresql://test',
    SERVICE_TOKEN:  'test-service-token',
    EMR_API_TOKEN:  'test-emr-token',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('config', () => {
  it('throws when DAILY_API_KEY is missing', () => {
    delete process.env['DAILY_API_KEY'];
    expect(() => require('../config')).toThrow('DAILY_API_KEY');
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env['DATABASE_URL'];
    expect(() => require('../config')).toThrow('DATABASE_URL');
  });

  it('throws when SERVICE_TOKEN is missing', () => {
    delete process.env['SERVICE_TOKEN'];
    expect(() => require('../config')).toThrow('SERVICE_TOKEN');
  });

  it('throws when EMR_API_TOKEN is missing', () => {
    delete process.env['EMR_API_TOKEN'];
    expect(() => require('../config')).toThrow('EMR_API_TOKEN');
  });

  it('returns valid config when all required env vars are set', () => {
    process.env['PORT']             = '4000';
    process.env['EMR_CORE_BASE_URL'] = 'http://emr:3000';
    process.env['EMR_CORE_API_TOKEN'] = 'emr-outbound-token';

    const { config } = require('../config') as typeof import('../config');

    expect(config.dailyApiKey).toBe('test-daily-key');
    expect(config.databaseUrl).toBe('postgresql://test');
    expect(config.serviceToken).toBe('test-service-token');
    expect(config.emrApiToken).toBe('test-emr-token');
    expect(config.port).toBe(4000);
    expect(config.emrCoreBaseUrl).toBe('http://emr:3000');
    expect(config.emrCoreApiToken).toBe('emr-outbound-token');
  });

  it('defaults port to 3001 when PORT is not set', () => {
    delete process.env['PORT'];
    const { config } = require('../config') as typeof import('../config');
    expect(config.port).toBe(3001);
  });

  it('defaults emrCoreBaseUrl when EMR_CORE_BASE_URL is not set', () => {
    delete process.env['EMR_CORE_BASE_URL'];
    const { config } = require('../config') as typeof import('../config');
    expect(config.emrCoreBaseUrl).toBe('http://localhost:3000');
  });
});
