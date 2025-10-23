// src/routes/org.connection.ts
import { Router } from 'express';
import { pool } from '../db';
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { evoGetConnectionState } from '../services/evolution.connection.service'; // caminho correto

/**
 * GET /api/org/connection/summary
 * Retorna:
 * {
 *   org_id: string,
 *   evolution_connected: boolean | null,
 *   evolution_state: "open" | "connecting" | "close" | "closed" | null
 * }
 */
export const orgConnectionRouter = Router();

orgConnectionRouter.get('/connection/summary', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgIdFromJwt = user?.org_id as string | undefined;
    const orgIdFromQuery = (req.query.org_id as string | undefined)?.trim();
    const orgId = orgIdFromJwt || orgIdFromQuery;

    if (!orgId) {
      return res.status(400).json({ ok: false, error: 'missing_org_id' });
    }

    // 1) Ler org_settings
    const stQ = await pool.query<{
      evolution_connected: boolean | null;
      evolution_instance_name: string | null;
    }>(
      `
        select evolution_connected, evolution_instance_name
          from public.org_settings
         where org_id = $1
         limit 1
      `,
      [orgId]
    );

    const st = stQ.rows[0];
    const evolution_connected: boolean | null = st?.evolution_connected ?? null;
    const instanceName = st?.evolution_instance_name || null;

    // 2) Estado "live" via Evolution (opcional)
    let evolution_state: string | null = null;
    if (instanceName) {
      try {
        evolution_state = await evoGetConnectionState(instanceName); // "open" | "connecting" | "close" | "closed" | ...
      } catch {
        evolution_state = null;
      }
    }

    return res.json({
      org_id: orgId,
      evolution_connected,
      evolution_state,
    });
  } catch (err: any) {
    console.error('[GET /org/connection/summary] error', err?.message || err);
    return res.status(502).json({ ok: false, error: 'connection_summary_failed' });
  }
});
