import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const migrationPath = path.resolve(__dirname, '../database/migrations/0001_telemedicine_sessions.up.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await client.query(sql);
    console.log('Migration completed successfully');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  runMigrations(databaseUrl).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
