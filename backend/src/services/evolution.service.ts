// src/services/evolution.service.ts
import axios from 'axios';
import crypto from 'crypto';
import { env } from '../env';

const evo = axios.create({
  baseURL: env.EVOLUTION_BASE_URL, // ex.: https://seu-dominio-evolution
  timeout: 20000,
  headers: { 'Content-Type': 'application/json', apikey: env.EVOLUTION_AUTH_KEY },
});

// Helpers com erro legível
function normErr(e: any, defMsg: string) {
  const data = e?.response?.data;
  const msg = data?.message || data?.error || e?.message || defMsg;
  const status = e?.response?.status;
  return { message: msg, status, data };
}

export async function evoCreateInstanceBasic(instanceName: string) {
  // token pode ser vazio segundo a doc, mas geramos um por segurança
  const token = crypto.randomBytes(16).toString('hex');
  try {
    const { data } = await evo.post('/instance/create', {
      instanceName,
      token,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });
    return data;
  } catch (e: any) {
    throw Object.assign(new Error('evoCreateInstanceBasic failed'), { detail: normErr(e, 'Create failed') });
  }
}

export async function evoConnectInstance(instanceName: string) {
  try {
    const { data } = await evo.get(`/instance/connect/${encodeURIComponent(instanceName)}`);
    // esperado: { pairingCode, code, count }
    return data;
  } catch (e: any) {
    throw Object.assign(new Error('evoConnectInstance failed'), { detail: normErr(e, 'Connect failed') });
  }
}
