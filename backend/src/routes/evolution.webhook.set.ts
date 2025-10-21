import { Router } from 'express';
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { pool } from '../db';
import { env } from '../env';
import { evoSetWebhook } from '../services/evolution.webhook.service';

export const evolutionWebhookSet = Router();

/**
 * POST /api/evolution/webhook/set
 * body: { events?: string[], urlOverride?: string, byEvents?: boolean, base64?: boolean }
 * - Lê org_settings para descobrir a instância e montar a URL (se não houver override)
 * - Seta o webhook na Evolution
 * - Persiste url e events em org_settings
 */


evolutionWebhookSet.get('/webhook/set/ping', (_req, res) => res.json({ ok: true }));


evolutionWebhookSet.post('/webhook/set', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user?.org_id) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const { events, urlOverride, byEvents, base64 } = req.body as {
      events?: string[];
      urlOverride?: string;
      byEvents?: boolean;
      base64?: boolean;
    };

    // 1) Carrega settings da org (instância + token e url salvos)
    const stQ = await pool.query(
      `SELECT evolution_instance_name, evolution_webhook_url, evolution_webhook_token
         FROM org_settings
        WHERE org_id = $1
        LIMIT 1`,
      [user.org_id]
    );
    const st = stQ.rows[0];
    if (!st?.evolution_instance_name) {
      return res.status(412).json({ ok: false, error: 'instance_not_configured' });
    }

    const instanceName = st.evolution_instance_name;

    // 2) Define eventos (default aos pedidos)
    const finalEvents = (events && events.length)
      ? events
      : ['GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE'];

    // 3) Monta URL do webhook
    // Prioridade: override explícito > salv(a) em settings > env default
    let baseUrl = urlOverride || st?.evolution_webhook_url || env.EVOLUTION_DEFAULT_WEBHOOK_URL;
    if (!baseUrl) {
      // última alternativa: derive do próprio app (se você tiver APP_PUBLIC_BASE_URL no .env)
      // ex.: `${env.APP_PUBLIC_BASE_URL}/api/evolution/webhook`
      return res.status(400).json({ ok: false, error: 'missing_webhook_url' });
    }

    // Anexa token por query se existir (padrão do nosso receiver)
    const token = st?.evolution_webhook_token || env.EVOLUTION_WEBHOOK_TOKEN;
    const hasQuery = baseUrl.includes('?');
    const urlWithToken = token
      ? `${baseUrl}${hasQuery ? '&' : '?'}token=${encodeURIComponent(token)}`
      : baseUrl;

    // 4) Chama Evolution
    const evoResp = await evoSetWebhook(instanceName, urlWithToken, finalEvents, {
    webhook_by_events: true,     // garante compat
    webhook_base64: !!base64,
    enabled: true,
    });

    // 5) Persiste url + events em org_settings para auditoria/consulta
    await pool.query(
      `UPDATE org_settings
          SET evolution_webhook_url = $2,
              evolution_webhook_events = $3,
              updated_at = NOW()
        WHERE org_id = $1`,
      [user.org_id, baseUrl, finalEvents]
    );

    return res.json({ ok: true, instance: instanceName, set: { url: urlWithToken, events: finalEvents }, provider: evoResp });
  } catch (e: any) {
    console.error('[evo.webhook.set]', e?.response?.data ?? e?.message ?? e);
    return res.status(502).json({ ok: false, error: 'evolution_set_failed' });
  }
});
