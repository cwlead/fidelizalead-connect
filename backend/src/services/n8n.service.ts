import axios from 'axios';
import { env } from '../env';

export type N8nContactSyncPayload = {
  kind: 'CONTACT_SYNC_START';
  org_id: string;
  instance_name: string;
  // extras úteis p/ o fluxo no n8n
  evolution: {
    base_url: string;
    // não envie apikey se não for necessário lá; ideal é o n8n falar direto com o seu Postgres
  };
  // metadados de auditoria (opcional)
  triggered_at: string; // ISO
};

export async function n8nContactSyncStart(payload: N8nContactSyncPayload) {
  const url = env.N8N_CONTACT_SYNC_WEBHOOK_URL;
  if (!url) throw new Error('missing N8N_CONTACT_SYNC_WEBHOOK_URL');

  const max = 3;
  let lastErr: any;

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const { data, status } = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return { ok: true as const, status, data };
    } catch (e: any) {
      lastErr = e;
      const s = e?.response?.status;
      const body = e?.response?.data ?? e?.message;
      console.warn(`[n8n.sync] attempt ${attempt}/${max} failed`, { status: s, body });
      await new Promise(r => setTimeout(r, attempt * 1000)); // backoff 1s,2s
    }
  }

  throw lastErr;
}
