import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { createTeleApi } from '../api/teleApi';
import { SessionService } from '../services/sessionService';

dotenv.config();

const port = process.env['PORT'] ?? '3001';
const databaseUrl = process.env['DATABASE_URL'];
const dailyApiKey = process.env['DAILY_API_KEY'];

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!dailyApiKey) throw new Error('DAILY_API_KEY is required');

const pool = new Pool({ connectionString: databaseUrl });
const sessionService = new SessionService(pool, dailyApiKey);

const app = express();
app.use(express.json());
app.use('/api', createTeleApi(sessionService));

app.listen(Number(port), () => {
  console.log(`Telemedicine service running on port ${port}`);
});
