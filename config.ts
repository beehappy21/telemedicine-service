import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const config = {
  dailyApiKey:     requireEnv('DAILY_API_KEY'),
  databaseUrl:     requireEnv('DATABASE_URL'),
  serviceToken:    requireEnv('SERVICE_TOKEN'),
  emrApiToken:     requireEnv('EMR_API_TOKEN'),
  emrCoreBaseUrl:  process.env['EMR_CORE_BASE_URL']  ?? 'http://localhost:3000',
  emrCoreApiToken: process.env['EMR_CORE_API_TOKEN'] ?? '',
  port:            parseInt(process.env['PORT'] ?? '3001', 10),
};
