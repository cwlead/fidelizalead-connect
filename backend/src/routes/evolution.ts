// src/routes/evolution.ts
import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { pool } from '../db';
import { env } from '../env';
import {
  evoCreateInstanceBasic,
  evoConnectInstance,
} from '../services/evolution.service';
import { evoSetWebhook } from '../services/evolution.webhook.service'; // <- chama SET async (fire-and-forget)
import { enqueueConnectionCheckJob } from '../services/connection.await.service';


export const evolution = Router();

/**
 * POST /api/evolution/connect
 * - Cria/garante a instância na Evolution
 * - Persiste/atualiza na DB: instance_name, evolution_connected=false,
 *   evolution_webhook_url e evolution_webhook_token (vindos do env)
 * - Dispara SET de webhook/ eventos de forma assíncrona (não bloqueia resposta)
 * - Conecta e devolve QR/Code para o front
 */
evolution.post('/connect', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user?.org_id) {
      return res.status(400).json({ ok: false, error: 'missing_org_id' });
    }

    // 1) Carrega settings atuais
    const current = await pool.query(
      `select evolution_instance_name,
              evolution_webhook_url,
              evolution_webhook_token
         from org_settings
        where org_id = $1
        limit 1`,
      [user.org_id]
    );

    // 2) Define/gera instanceName
    let instanceName: string | null = current.rows[0]?.evolution_instance_name ?? null;
    if (!instanceName) {
      const uuid = crypto.randomUUID();
      instanceName = `${env.EVOLUTION_INSTANCE_PREFIX || 'inst'}-${uuid}`;
    }

    // 3) Garante instância na Evolution
    try {
      await evoCreateInstanceBasic(instanceName);
    } catch (e: any) {ngify(e?.detail || e?.message || '');
      if (!/exist|already/i.test(msg)) throw e;
    }

    // 4) Upsert dos dados na org_settings
    const envWebhookUrl   = (env.EVOLUTION_DEFAULT_WEBHOOK_URL || '').trim() || null;
    const envWebhookToken = (env.EVOLUTION_WEBHOOK_TOKEN || '').trim() || null;

    await pool.query(
      `
      insert into org_settings (
        org_id, evolution_instance_name, evolution_connected,
        evolution_webhook_url, evolution_webhook_token,
        created_at, updated_at
      )
      values ($1, $2, false, $3, $4, now(), now())
      on conflict (org_id) do update
         set evolution_instance_name = excluded.evolution_instance_name,
             evolution_connected     = false,
             evolution_webhook_url   = coalesce($3, org_settings.evolution_webhook_url),
             evolution_webhook_token = coalesce($4, org_settings.evolution_webhook_token),
             updated_at              = now()
      `,
      [user.org_id, instanceName, envWebhookUrl, envWebhookToken]
    );
     await enqueueConnectionCheckJob(user.org_id, instanceName);
    // 4.1) Fire-and-forget: SET de webhook + eventos (assíncrono, não bloqueia)
    (async () => {
      try {
        // Base URL (db > env) e token (db > env)
        const stQ = await pool.query(
          `select evolution_webhook_url, evolution_webhook_token
             from org_settings
            where org_id = $1
            limit 1`,
          [user.org_id]
        );
        const baseFromDb = (stQ.rows[0]?.evolution_webhook_url || '').trim();
        const tokenFromDb = (stQ.rows[0]?.evolution_webhook_token || '').trim();

        const baseUrl = baseFromDb || envWebhookUrl || '';
        const token   = tokenFromDb || envWebhookToken || '';

        if (!baseUrl) {
          console.warn('[evo.connect→autoSet] skipping SET: missing baseUrl');
          return;
        }

        // monta URL?token=... (sem duplicar token)
        const alreadyHasToken = /(?:\?|&)token=/.test(baseUrl);
        const urlWithToken = token && !alreadyHasToken
          ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
          : baseUrl;

        // eventos padrão
        const events = ['GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'MESSAGES_UPSERT'];

        // chama Evolution
        const provider = await evoSetWebhook(instanceName!, urlWithToken, events, {
          webhook_by_events: true,
          webhook_base64: false,
          enabled: true,
        });

        // persiste base (SEM token) + eventos (auditoria)
        await pool.query(
          `update org_settings
              set evolution_webhook_url    = $2,
                  evolution_webhook_events = $3,
                  updated_at               = now()
            where org_id = $1`,
          [user.org_id, baseUrl, events]
        );

        console.log('[evo.connect→autoSet] ok', { instanceName, url: urlWithToken, providerStatus: provider?.status || 'ok' });
      } catch (err: any) {
        console.error('[evo.connect→autoSet] failed', err?.response?.data ?? err?.message ?? err);
      }
    })();

    // 5) Conecta e obtém code/pairingCode (QR)
    const connect = await evoConnectInstance(instanceName);
    const { pairingCode, code, count } = connect ?? {};

    // 6) (opcional) QR em base64
    let qrDataUrl: string | null = null;
    if (typeof code === 'string' && code.length) {
      try { qrDataUrl = await QRCode.toDataURL(code); } catch { qrDataUrl = null; }
    }

    return res.json({
      ok: true,
      instance: instanceName,
      connect: { pairingCode, code, count },
      qrDataUrl,
    });
  } catch (e: any) {
    return res.status(502).json({
      ok: false,
      step: 'evolution_connect',
      error: e?.detail || { message: String(e?.message || e) },
    });
  }
});
      
