import { Router } from 'express';
import { processDueConnectionChecks } from '../services/connection.await.service';

export const adminJobs = Router();

adminJobs.post('/jobs/connection/run', async (_req, res) => {
  try {
    await processDueConnectionChecks(10);
    res.json({ ok: true, message: 'Jobs processados com sucesso' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});
