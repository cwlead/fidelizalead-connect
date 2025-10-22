import { Router } from 'express';
import { raw as bodyRaw } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { env } from '../env';
import { n8nContactSyncStart } from '../services/n8n.service';
import { evoGetConnectionState } from '../services/evolution.connection.service'; // ⬅️ NOVO

/**
 * Segurança do webhook:
 * - Preferencial: query ?token=... OU header x-webhook-token
 * - Opcional: HMAC em x-evolution-signature (sha256 do corpo bruto) com segredo EVOLUTION_WEBHOOK_SECRET
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
      // 1) Autorização via token simples (query ou header) — robusto p/ array/duplicado
      const rawQueryToken = req.query.token as any;
      const headerToken   = req.headers['x-webhook-token'] as string | string[] | undefined;
      const pick = (v: any) => Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
      const givenToken = String(pick(rawQueryToken) || pick(headerToken) || '');
      if (!WEBHOOK_TOKEN || givenToken !== WEBHOOK_TOKEN) {
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

      // 7.1) Marca conectado e dispara N8N (apenas quando virar FALSE→TRUE), confirmando via connectionState
      try {
        if (orgId && instanceName) {
          const et = (eventType || '').toUpperCase();
          const data = payload?.data || payload;

          // Heurística local: evento de conexão OU state/status = 'open'
          const state = String(payload?.state || data?.state || data?.status || '').toLowerCase();
          const looksConnectionEvent =
            et === 'CONNECTION_UPDATE' || et === 'CONNECTION_STATE' || et === 'APPLICATION_STARTUP';

          // Só tentamos confirmar com provider se ainda não está conectado
          let shouldCheck = false;
          try {
            const r = await pool.query(
              `SELECT evolution_connected FROM org_settings WHERE org_id = $1 LIMIT 1`,
              [orgId]
            );
            shouldCheck = !r.rows[0]?.evolution_connected && (looksConnectionEvent || state === 'open');
          } catch {
            // se falhar o select, não bloqueia
            shouldCheck = looksConnectionEvent || state === 'open';
          }

          if (shouldCheck) {
            // Checagem única no provider
            let finalOpen = false;
            try {
              const providerState = await evoGetConnectionState(String(instanceName));
              finalOpen = providerState === 'open';
            } catch (e) {
              console.warn('[evo.webhook] connectionState check failed:', (e as any)?.message ?? e);
              // fallback: se payload indicou "open", aceitamos
              finalOpen = state === 'open';
            }

            if (finalOpen) {
              // vira true só se estava false (detecta 1ª conexão real)
              const upd = await pool.query(
                `UPDATE org_settings
                    SET evolution_connected = TRUE,
                        updated_at = NOW()
                  WHERE org_id = $1
                    AND evolution_connected = FALSE
                  RETURNING org_id`,
                [orgId]
              );

              const justTurnedTrue = upd.rowCount > 0;

              if (justTurnedTrue) {
                // idempotência extra se a coluna existir
                let already = false;
                try {
                  const r = await pool.query(
                    `SELECT evolution_sync_triggered_at
                       FROM org_settings
                      WHERE org_id = $1
                      LIMIT 1`,
                    [orgId]
                  );
                  already = !!r.rows[0]?.evolution_sync_triggered_at;
                } catch { /* coluna pode não existir */ }

                if (!already) {
                  try {
                    const r = await n8nContactSyncStart({
                      kind: 'CONTACT_SYNC_START',
                      org_id: orgId,
                      instance_name: String(instanceName),
                      evolution: { base_url: env.EVOLUTION_BASE_URL },
                      triggered_at: new Date().toISOString(),
                    });
                    // marca que já disparamos, se a coluna existir
                    try {
                      await pool.query(
                        `UPDATE org_settings
                            SET evolution_sync_triggered_at = NOW(),
                                updated_at = NOW()
                          WHERE org_id = $1`,
                        [orgId]
                      );
                    } catch {/* coluna pode não existir */}
                    console.log('[n8n.sync] triggered', { orgId, instanceName, status: r?.status });
                  } catch (e: any) {
                    console.error('[n8n.sync] failed', e?.response?.data ?? e?.message ?? e);
                  }
                }
              }
            }
          }

          // (opcional) marcar desconectado quando o provider avisar
          const looksClosed =
            state === 'close' || state === 'closed' || et === 'DISCONNECTED' || et === 'LOGOUT';
          if (looksClosed) {
            await pool.query(
              `UPDATE org_settings
                  SET evolution_connected = FALSE,
                      updated_at = NOW()
                WHERE org_id = $1`,
              [orgId]
            );
            // não resetamos evolution_sync_triggered_at: dispara apenas na 1ª conexão da vida
          }
        }
      } catch (e) {
        console.error('[webhook->n8n]', e);
      }

      // 8) Retorno rápido
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      console.error('[evolution_webhook]', e?.response?.data ?? e?.message ?? e);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  }
);
