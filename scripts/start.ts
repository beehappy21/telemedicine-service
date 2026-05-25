import { config } from '../config';
import { createPool } from '../database/db';
import { SessionService } from '../services/sessionService';
import { EmrClient } from '../services/emrClient';
import { startSessionReminder } from '../services/sessionReminder';
import { createApp } from '../app';

async function main() {
  const pool = await createPool({ connectionString: config.databaseUrl });
  const sessionService = new SessionService(pool, config.dailyApiKey);
  const emrClient = new EmrClient(config.emrCoreBaseUrl, config.emrCoreApiToken);

  startSessionReminder(pool, config.notifyWebhookUrl);

  const app = createApp(sessionService, {
    serviceToken:     config.serviceToken,
    emrApiToken:      config.emrApiToken,
    notifyWebhookUrl: config.notifyWebhookUrl,
    dailyApiKey:      config.dailyApiKey,
  }, emrClient);

  const server = app.listen(config.port, () => {
    console.log(`Telemedicine service running on port ${config.port}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
