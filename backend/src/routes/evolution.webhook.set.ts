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

    // 1) Settings da org
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

    // 2) Eventos (default enxuto + comum)
    const defaultEvents = ['GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'MESSAGES_UPSERT'];
    const finalEvents = Array.from(new Set((events && events.length ? events : defaultEvents)));

    // 3) Monta URL do webhook (override > settings > env)
    let baseUrl = (urlOverride || st?.evolution_webhook_url || env.EVOLUTION_DEFAULT_WEBHOOK_URL || '').trim();
    if (!baseUrl) return res.status(400).json({ ok: false, error: 'missing_webhook_url' });

    // 3.1) Anexa token via query (se existir e ainda não estiver na URL)
    const token = st?.evolution_webhook_token || env.EVOLUTION_WEBHOOK_TOKEN || '';
    const alreadyHasToken = /(?:\?|&)token=/.test(baseUrl);
    const urlWithToken = token && !alreadyHasToken
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : baseUrl;

    // 4) Chamada para Evolution
    const evoResp = await evoSetWebhook(instanceName, urlWithToken, finalEvents, {
      webhook_by_events: typeof byEvents === 'boolean' ? byEvents : true,
      webhook_base64: !!base64,
      enabled: true,
    });

    // 5) Persistência (guarda a base SEM o token — o token já está separado na coluna própria)
    await pool.query(
      `UPDATE org_settings
          SET evolution_webhook_url    = $2,
              evolution_webhook_events = $3,
              updated_at               = NOW()
        WHERE org_id = $1`,
      [user.org_id, baseUrl, finalEvents]
    );

    return res.json({
      ok: true,
      instance: instanceName,
      set: { url: urlWithToken, events: finalEvents },
      provider: evoResp
    });
  } catch (e: any) {
    console.error('[evo.webhook.set]', e?.response?.data ?? e?.message ?? e);
    return res.status(502).json({ ok: false, error: 'evolution_set_failed' });
  }
});
