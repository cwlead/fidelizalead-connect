import { Router } from 'express';
import { raw as bodyRaw } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { env } from '../env';

/**
 * Segurança do webhook:
 * - Preferencial: query ?token=... OU header x-webhook-token
 * - Opcional: HMAC em x-evolution-signature (sha256 do corpo bruto) com segredo EVOLUTION_WEBHOOK_SECRET
 *
 * Env esperados:
 * - EVOLUTION_WEBHOOK_TOKEN   -> token simples para validar origem
 * - EVOLUTION_WEBHOOK_SECRET  -> (opcional) segredo HMAC para validar assinatura
 */
const WEBHOOK_TOKEN  = env.EVOLUTION_WEBHOOK_TOKEN;
const WEBHOOK_SECRET = env.EVOLUTION_WEBHOOK_SECRET; // opcional

export const evolutionWebhook = Router();

/**
 * POST /api/evolution/webhook
 * Content-Type: application/json (corpo cru necessário para HMAC)
 *
 * Observações:
 * - Usamos express.raw SOMENTE nesta rota para acessar o corpo cru.
 * - Deduções de campos porque cada fork pode variar:
 *    instanceName: payload.instance | payload.instanceName | payload.session | payload.device
 *    eventType:    payload.event   | payload.type         | payload.action
 *    eventId:      payload.eventId | payload.id
 */
evolutionWebhook.post(
  '/webhook',
  bodyRaw({ type: 'application/json' }),
  async (req, res) => {
    try {
      // 1) Autorização via token simples
      const token = (req.query.token as string) || (req.headers['x-webhook-token'] as string);
      if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
        return res.status(401).json({ ok: false, error: 'unauthorized_webhook' });
      }

      // 2) Corpo cru + JSON parse
      const rawBuf = req.body as Buffer;
      if (!rawBuf || !Buffer.isBuffer(rawBuf)) {
        return res.status(400).json({ ok: false, error: 'invalid_body' });
      }
      const rawText = rawBuf.toString('utf8');

      let payload: any;
      try {
        payload = JSON.parse(rawText);
      } catch {
        return res.status(400).json({ ok: false, error: 'invalid_json' });
      }

      // 3) (Opcional) Validação HMAC
      if (WEBHOOK_SECRET) {
        const given = (req.headers['x-evolution-signature'] ||
                       req.headers['x-signature'] ||
                       req.headers['x-hub-signature']) as string | undefined;

        const expected = crypto
          .createHmac('sha256', WEBHOOK_SECRET)
          .update(rawBuf)
          .digest('hex');

        if (!given || given !== expected) {
          return res.status(401).json({ ok: false, error: 'invalid_signature' });
        }
      }

      // 4) Normalização de campos variáveis entre forks
      const instanceName =
        payload.instance ||
        payload.instanceName ||
        payload.session ||
        payload.device ||
        null;

      const eventType =
        payload.event ||
        payload.type ||
        payload.action ||
        null;

      const eventId =
        payload.eventId ||
        payload.id ||
        null;

      // 5) Resolve org_id a partir do instanceName (se informado)
      let orgId: string | null = null;
      if (instanceName) {
        const q = await pool.query<{ org_id: string }>(
          `
          SELECT org_id
            FROM org_settings
           WHERE evolution_instance_name = $1
          LIMIT 1
          `,
          [String(instanceName)]
        );
        orgId = q.rows[0]?.org_id ?? null;
      }

      // 6) Idempotência por hash do corpo
      const payloadHash = crypto.createHash('sha256').update(rawText).digest('hex');

      // 7) Persiste no log (ignora duplicados pela unique constraint)
      await pool.query(
        `
        INSERT INTO wpp.event_log (org_id, instance_name, event_type, event_id, payload_hash, raw_json, received_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (payload_hash) DO NOTHING
        `,
        [orgId, instanceName, eventType, eventId, payloadHash, rawText]
      );

      // 8) Retorno rápido (não enviar ao n8n ainda — próxima etapa)
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      console.error('[evolution_webhook]', e?.response?.data ?? e?.message ?? e);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  }
);
