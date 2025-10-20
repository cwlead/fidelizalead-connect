// src/routes/evolution.ts
import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode'; // opcional (npm i qrcode)
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { pool } from '../db';
import { env } from '../env';
import {
  evoCreateInstanceBasic,
  evoConnectInstance,
} from '../services/evolution.service';

export const evolution = Router();

/** 
 * POST /evolution/connect
 * - Gera/garante instanceName UUID por org
 * - Cria a instância na Evolution se necessário
 * - Conecta a instância e retorna { pairingCode, code, count } e, se possível, qrDataUrl (PNG base64)
 */
evolution.post('/connect', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user?.org_id) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    // 1) Carrega nome salvo ou cria um novo com UUID
    const row = await pool.query(
      `select evolution_instance_name
         from org_settings
        where org_id = $1`,
      [user.org_id]
    );

    let instanceName: string | null = row.rows[0]?.evolution_instance_name ?? null;
    if (!instanceName) {
      // prefixo + UUID evita colisão na Evolution (que não aceita nomes repetidos)
      const uuid = crypto.randomUUID();
      instanceName = `${env.EVOLUTION_INSTANCE_PREFIX || 'inst'}-${uuid}`;
      await pool.query(
        `insert into org_settings (org_id, evolution_instance_name, created_at, updated_at)
         values ($1, $2, now(), now())
         on conflict (org_id) do update
           set evolution_instance_name = excluded.evolution_instance_name,
               updated_at = now()`,
        [user.org_id, instanceName]
      );
    }

    // 2) Tenta criar instância (se já existir, a Evolution pode responder 4xx/409; tratamos no catch)
    try {
      await evoCreateInstanceBasic(instanceName);
    } catch (e: any) {
      // se for "already exists" segue o jogo; senão repassa o erro
      const msg = JSON.stringify(e?.detail || {});
      if (!/exist|already/i.test(msg)) throw e;
    }

    // 3) Conecta e obtém code/pairingCode
    const connect = await evoConnectInstance(instanceName);
    const { pairingCode, code, count } = connect ?? {};

    // 4) (opcional) Gera QR PNG base64 no backend — facilita o front
    let qrDataUrl: string | null = null;
    if (typeof code === 'string' && code.length) {
      try {
        qrDataUrl = await QRCode.toDataURL(code); // data:image/png;base64,....
      } catch {
        qrDataUrl = null;
      }
    }

    return res.json({
      ok: true,
      instance: instanceName,
      connect: { pairingCode, code, count },
      qrDataUrl, // se null, o front pode gerar sozinho a partir de `code`
    });
  } catch (e: any) {
    return res.status(502).json({
      ok: false,
      step: 'evolution_connect',
      error: e?.detail || { message: String(e?.message || e) },
    });
  }
});
