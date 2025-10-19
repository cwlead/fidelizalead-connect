import axios from 'axios';
import crypto from 'crypto';
import { env } from '../env';

// Axios apontando pro domínio HTTPS da Evolution
const evo = axios.create({
  baseURL: env.EVOLUTION_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    apikey: env.EVOLUTION_AUTH_KEY, // docs: só apikey
  },
});

/** Helpers com erro detalhado para debug */
async function tryGet(paths: string[]) {
  let last: any;
  for (const p of paths) {
    try { return (await evo.get(p)).data; } catch (e: any) { last = e; }
  }
  throw Object.assign(new Error('Evolution GET failed'), {
    detail: last?.response?.data ?? { message: String(last) }
  });
}
async function tryPost(paths: string[], body: any) {
  let last: any;
  for (const p of paths) {
    try { return (await evo.post(p, body)).data; } catch (e: any) { last = e; }
  }
  throw Object.assign(new Error('Evolution POST failed'), {
    detail: last?.response?.data ?? { message: String(last) },
    body,
  });
}
async function tryPut(paths: string[], body: any) {
  let last: any;
  for (const p of paths) {
    try { return (await evo.put(p, body)).data; } catch (e: any) { last = e; }
  }
  throw Object.assign(new Error('Evolution PUT failed'), {
    detail: last?.response?.data ?? { message: String(last) },
    body,
  });
}

// Somente os 2 eventos que você pediu
const GROUP_EVENTS = ['GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE'] as const;

export function buildInstanceName(seed: string) {
  return `${env.EVOLUTION_INSTANCE_PREFIX}-${seed}`;
}

/**
 * Cria/garante a instância.
 * - Gera token randômico (forks costumam exigir não-vazio).
 * - Usa `webhookUrl` (principal) e `url` (fallback).
 * - NÃO envia `number` quando não for informado (evita 400).
 */
export async function evoEnsureInstance(
  instanceName: string,
  webhook?: string,
  number?: string, // <- novo parâmetro opcional
) {
  const token = crypto.randomBytes(24).toString('hex');
  const webhookUrl = webhook || env.EVOLUTION_DEFAULT_WEBHOOK_URL || '';

  // base SEM number
  const createBody: any = {
    instanceName,
    token,                         // não-vazio
    integration: 'WHATSAPP-BAILEYS' as const,
    qrcode: true,

    ...(webhookUrl
      ? {
          webhookUrl,              // principal aceito
          url: webhookUrl,         // fallback aceito em alguns forks
          webhook_by_events: true,
          events: [...GROUP_EVENTS],
        }
      : {
          webhookUrl: '',
          url: '',
          webhook_by_events: false,
          events: [] as string[],
        }),

    // flags “neutras”
    reject_call: false,
    msg_call: '',
    groups_ignore: true,
    always_online: false,
    read_messages: false,
    read_status: false,
    websocket_enabled: false,
    websocket_events: [] as string[],
    rabbitmq_enabled: false,
    rabbitmq_events: [] as string[],
    sqs_enabled: false,
    sqs_events: [] as string[],

    typebot_url: '',
    typebot: '',
    typebot_expire: 0,
    typebot_keyword_finish: '',
    typebot_delay_message: 0,
    typebot_unknown_message: '',
    typebot_listening_from_me: false,

    proxy: { host: '', port: '', protocol: 'http', username: '', password: '' },

    chatwoot_account_id: 0,
    chatwoot_token: '',
    chatwoot_url: '',
    chatwoot_sign_msg: false,
    chatwoot_reopen_conversation: false,
    chatwoot_conversation_pending: false,
  };

  // 👉 só adiciona `number` se veio válido (E.164 sem '+')
  if (number && /^\d{10,15}$/.test(number)) {
    createBody.number = number;
  }

  const created = await tryPost(['/instance/create'], createBody);

  // alguns forks exigem update separado p/ aplicar webhook/events
  let updated: any = null;
  if (webhookUrl) {
    updated = await tryPut([`/instance/update/${instanceName}`], {
      webhookUrl,
      url: webhookUrl,
      webhook_by_events: true,
      events: [...GROUP_EVENTS],
    }).catch(() => null);
  }
  return { created, updated, token };
}

/**
 * Estado/Status — cobre forks:
 *  - GET /instance/{instanceName}
 *  - GET /instance/connectionState/{instanceName}
 */
export async function evoConnectionState(instanceName: string) {
  const data = await tryGet([
    `/instance/${encodeURIComponent(instanceName)}`,
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  ]);
  return data;
}

/**
 * QR em base64 — cobre forks:
 *  - GET /instance/qrbase64/{instanceName}
 *  - GET /instance/{instanceName} (às vezes devolve { qrcode: base64 })
 */
export async function evoGetQrBase64(instanceName: string) {
  const data = await tryGet([
    `/instance/qrbase64/${encodeURIComponent(instanceName)}`,
    `/instance/${encodeURIComponent(instanceName)}`,
  ]);
  const base64 =
    data?.qrcode ?? data?.base64 ?? data?.qr ?? data?.instance?.qrcode ?? data;
  if (typeof base64 !== 'string' || !base64.length) {
    throw Object.assign(new Error('QR base64 não encontrado'), { detail: data });
  }
  return base64;
}
