import axios from 'axios';
import { env } from '../env';

export async function evoSetWebhook(
  instanceName: string,
  url: string,
  events: string[],
  opts?: { webhook_by_events?: boolean; webhook_base64?: boolean; enabled?: boolean }
) {
  const EVO_BASE = env.EVOLUTION_BASE_URL;
  const EVO_KEY  = env.EVOLUTION_AUTH_KEY;

  const enabled  = opts?.enabled ?? true;
  const byEvents = opts?.webhook_by_events ?? true;
  const base64   = opts?.webhook_base64 ?? false;

  // ✅ payload que o seu fork exige (nested simples)
  const payload = {
    webhook: {
      url,
      enabled,
      events,
      webhook_by_events: byEvents,
      webhook_base64: base64,
      webhookByEvents: byEvents,
      webhookBase64: base64,
    }
  };

  try {
    const { data } = await axios.post(
      `${EVO_BASE}/webhook/set/${encodeURIComponent(instanceName)}`,
      payload,
      { headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    const resp   = err?.response?.data ?? err?.message;
    console.error('[evo.webhook.set] evolution error', { status, resp, payload });
    throw err;
  }
}
