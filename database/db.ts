import { Pool, PoolConfig } from 'pg';

export interface DbOptions extends PoolConfig {
  connectionString: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export async function createPool(options: DbOptions): Promise<Pool> {
  const { maxRetries = 5, retryDelayMs = 1000, ...poolConfig } = options;
  const pool = new Pool(poolConfig);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      return pool;
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${err}`);
      }
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  return pool;
}
