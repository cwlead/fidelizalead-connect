// Backend/src/routes/campaigns
import { Router } from 'express';
import axios from 'axios';
import { pool } from '../db';
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { logger } from '../logger';
export const campaignsRouter = Router();

// Carrega audience real
type Audience = { type: string; params?: Record<string, any> };

export function audienceToSQL(orgId: string, audience: Audience) {
  const t = audience?.type;
  const p = audience?.params || {};

  switch (t) {
    case 'joined_group_recent': {
      // params: { group_id: wpp_groups.id OU wa_group_id, days?: number }
      const groupId = String(p.group_id || '').trim();
      const days = Number.isFinite(Number(p.days)) ? Number(p.days) : 3;

      // se não vier group_id, devolve um SELECT vazio seguro
      if (!groupId) {
        return { sql: `select null::uuid as contact_id where false`, values: [] as any[] };
      }

      const sql = `
        with grp as (
          select id
          from public.wpp_groups
          where org_id = $1
            and (id::text = $2 or wa_group_id = $2)
          limit 1
        )
        select distinct m.contact_id
        from public.wpp_group_members m
        join grp on grp.id = m.group_id
        where m.contact_id is not null
          and coalesce(m.last_join_at, m.first_join_at)
              >= now() - make_interval(days => $3::int)
      `;
      const values = [orgId, groupId, days];
      return { sql, values };
    }

    case 'all_contacts': {
      // Remova o LEFT JOIN se não existir crm_optouts
      const sql = `
        select c.id as contact_id
        from public.crm_contacts c
        left join public.crm_optouts o
          on o.contact_id = c.id and o.channel = 'whatsapp'
        where c.org_id = $1
          and o.contact_id is null
      `;
      const values = [orgId];
      return { sql, values };
    }

    default:
      throw new Error(`Unknown audience.type: ${t}`);
  }
}

/**
 * Enfileira todos os targets resolvidos pelo audience em public.comms_messages
 * - evita duplicar (não insere se já existir linha para {campaign_id, contact_id})
 * - grava payload básico com a mensagem escolhida e flags (ex.: dry_run)
 * Retorna: { inserted: number }
 */
async function enqueueCampaignTargets(opts: {
  orgId: string;
  campaignId: string;
  audience: Audience;
  message: any;          // {type, template_id?, body?, media_url?, variables?}
  options?: any;         // { phase, cfg? { dry_run, ... } }
}) {
  const { orgId, campaignId, audience, message, options } = opts;
  const { sql, values } = audienceToSQL(orgId, audience);

  // payload base (leve). Evite objetos gigantes aqui.
  const payload = {
    type: message?.type || 'text',
    template_id: message?.template_id ?? null,
    body: message?.body ?? null,
    media_url: message?.media_url ?? null,
    variables: message?.variables ?? null,
    dry_run: !!options?.cfg?.dry_run,
  };

  // INSERT … SELECT com de-duplicação por campanha/contato
  const insertSql = `
    with targets as (${sql})
    insert into public.comms_messages
      (id, org_id, contact_id, campaign_id, template, direction, status, payload, ts)
    select
      gen_random_uuid(),
      $1::uuid as org_id,
      t.contact_id,
      $2::uuid as campaign_id,
      $3::text as template,
      'out'::text as direction,
      'queued'::text as status,
      $4::jsonb as payload,
      now() as ts
    from targets t
    left join public.comms_messages cm
      on cm.campaign_id = $2::uuid
     and cm.contact_id = t.contact_id
    where t.contact_id is not null
      and cm.id is null
    returning 1;
  `;

  const params = [
    orgId,
    campaignId,
    message?.template_id ?? null,
    JSON.stringify(payload),
    ...values, // NÃO precisa espalhar aqui; o CTE já tem seus próprios $1..$n
  ];

  // ⚠️ IMPORTANTE:
  // Os $1..$4 do INSERT vêm antes; o CTE 'targets' usa a numeração do audienceToSQL.
  // Para não conflitar, rodamos em duas etapas: primeiro resolvemos o CTE com bind nativo.
  // A forma simples é interpolar o CTE num WITH e usar os binds do público como estão.

  // Para garantir a ordenação correta dos parâmetros:
  // - Os binds do CTE (audienceToSQL) ficam DENTRO dele, numerados a partir de $1.
  // - Os binds do INSERT (orgId, campaignId, template, payload) precisam estar *após* os do CTE.
  // A abordagem mais segura é "remapear" os binds do CTE para vir depois. Vamos fazer isso.

  // Remapeador de binds: troca $1,$2,... do CTE por $5,$6,... (após os 4 do INSERT)
  const remapped = sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 4}`);

  const finalSql = `
    with targets as (${remapped})
    insert into public.comms_messages
      (id, org_id, contact_id, campaign_id, template, direction, status, payload, ts)
    select
      gen_random_uuid(),
      $1::uuid as org_id,
      t.contact_id,
      $2::uuid as campaign_id,
      $3::text as template,
      'out'::text as direction,
      'queued'::text as status,
      $4::jsonb as payload,
      now() as ts
    from targets t
    left join public.comms_messages cm
      on cm.campaign_id = $2::uuid
     and cm.contact_id = t.contact_id
    where t.contact_id is not null
      and cm.id is null
    returning 1;
  `;

  const finalParams = [orgId, campaignId, message?.template_id ?? null, JSON.stringify(payload), ...values];

  const r = await pool.query(finalSql, finalParams);
  return { inserted: r.rowCount || 0 };
}


/**
 * GET /api/campaigns/presets
 * Públicos prontos (o front só exibe e manda como audience)
 */
const HARDCODED_FALLBACK = [
  { key: 'joined_group_recent', label: 'Entraram no grupo nos últimos 3 dias', params: { group_id: '<WA_GROUP_ID>', days: 3 } },
];

campaignsRouter.get('/campaigns/presets', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.query.org_id as string) || null;

    // 1) Lê presets da org + globais
    const q = await pool.query<{ key: string; label: string; params: any; org_id: string | null }>(`
      select distinct on (key) key, label, params, org_id
      from marketing.segment_presets
      where is_active = true and (org_id = $1 or org_id is null)
      order by key, org_id desc nulls last, updated_at desc
    `, [orgId]);

    let rows = q.rows;
    if (rows.length === 0) rows = HARDCODED_FALLBACK as any;

    // 2) Resolve group_id (placeholder, query param ou último grupo)
    const reqGroupId = (req.query.group_id as string | undefined)?.trim() || null;
    let defaultGroup: { id: string; wa_group_id: string; subject: string | null } | null = null;

    if (orgId && !reqGroupId) {
      const g = await pool.query<{ id: string; wa_group_id: string; subject: string | null }>(
        `select id, wa_group_id, subject
           from public.wpp_groups
          where org_id = $1
          order by created_at desc
          limit 1`,
        [orgId]
      );
      defaultGroup = g.rows[0] || null;
    }

    // 3) Se veio group_id na query, buscar subject correspondente
    let queryGroup: { id: string; wa_group_id: string; subject: string | null } | null = null;
    if (orgId && reqGroupId) {
      const g = await pool.query<{ id: string; wa_group_id: string; subject: string | null }>(
        `select id, wa_group_id, subject
           from public.wpp_groups
          where org_id = $1
            and (id::text = $2 or wa_group_id = $2)
          limit 1`,
        [orgId, reqGroupId]
      );
      queryGroup = g.rows[0] || null;
    }

    // 4) Monta presets enriquecendo params: group_id + group_subject
    const presets = await Promise.all(rows.map(async (r: any) => {
      const params = { ...(r.params || {}) };

      // Decide qual group aplicar
      let chosen: { id: string; wa_group_id: string; subject: string | null } | null = null;

      if (params.group_id && params.group_id !== '<WA_GROUP_ID>') {
        // já veio um valor concreto no preset → buscar subject desse grupo
        const g = await pool.query<{ id: string; wa_group_id: string; subject: string | null }>(
          `select id, wa_group_id, subject
             from public.wpp_groups
            where org_id = $1
              and (id::text = $2 or wa_group_id = $2)
            limit 1`,
          [orgId, String(params.group_id)]
        );
        chosen = g.rows[0] || null;
      } else {
        // placeholder → usar ?group_id= ou último grupo da org
        chosen = queryGroup || defaultGroup;
      }

      if (chosen) {
        // Mantemos group_id como wa_group_id (útil pro Evolution) e adicionamos o subject
        params.group_id = chosen.wa_group_id;
        params.group_subject = chosen.subject || '(sem nome)';
      } else {
        // Nenhum grupo resolvido — mantém placeholder e subject genérico
        if (params.group_id === '<WA_GROUP_ID>') {
          params.group_subject = '(selecione um grupo)';
        }
      }

      return { key: r.key, label: r.label, params };
    }));

    return res.json(presets);
  } catch (err:any) {
    console.error('[GET /campaigns/presets] error', err?.message || err);
    // mantém fallback pra não quebrar o front
    return res.json(HARDCODED_FALLBACK);
  }
});



/**
 * GET /api/campaigns/templates
 * Modelos de mensagem prontos (texto/áudio/vídeo) com variáveis
 */
campaignsRouter.get('/campaigns/templates', authRequired, async (_req, res) => {
  return res.json({
    text: [
      {
        id: 'recuperacao_padrao_v1',
        name: 'Recuperação padrão',
        body: 'Oi {first_name}, sentimos sua falta no grupo! Use o cupom {coupon} e volte a aproveitar.',
        variables: ['first_name','coupon']
      },
      {
        id: 'boas_vindas_v1',
        name: 'Boas-vindas',
        body: 'Oi {first_name}, bem-vindo ao grupo {group_name}! Qualquer dúvida, chama por aqui 😊',
        variables: ['first_name','group_name']
      }
    ],
    audio: [
      { id: 'audio_oferta_v1', name: 'Áudio de oferta', url: 'https://cdn.exemplo.com/audios/oferta_v1.mp3' }
    ],
    video: [
      { id: 'video_novidade_v1', name: 'Vídeo novidade', url: 'https://cdn.exemplo.com/videos/novidade_v1.mp4' }
    ]
  });
});

/**
 * POST /api/campaigns
 * Cria campanha (draft) com dados defaults
 * body: { name?, channel?, audience?, message? }
 */
campaignsRouter.post('/campaigns', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    const idQ = await pool.query<{ id: string }>('select gen_random_uuid() as id');
    const id = idQ.rows[0].id;

    const name = req.body?.name || 'Campanha (draft)';
    const channel = req.body?.channel || 'whatsapp.evolution';
    const segment = req.body?.audience || { type: 'left_group_recent', params: { group_id: '<WA_GROUP_ID>', days: 7 } };
    const createdBy = user?.sub || null;

    await pool.query(
      `
      insert into comms_campaigns (id, org_id, name, segment, status, channel, created_by, created_at)
      values ($1,$2,$3,$4,'draft',$5,$6,now())
      `,
      [id, orgId, name, segment, channel, createdBy]
    );

    logger.info({ msg: 'Campaign created', id, orgId, name });
    return res.json({ ok:true, id, status:'draft' });
  } catch (e:any) {
    logger.error({ msg: 'Campaign create failed', error: e?.message || e });
    return res.status(502).json({ ok:false, error:'campaign_create_failed' });
  }
});

/**
 * POST /api/campaigns/:id/estimate
 * Retorna estimated_count baseado no audience. Se tiver N8N_AUDIENCE_ESTIMATE_URL usa; senão mock/SQL.
 */
campaignsRouter.post('/campaigns/:id/estimate', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    // 1) Lê o audience salvo na campanha
    const cQ = await pool.query<{ segment: any }>(
      `select segment from comms_campaigns where id = $1 and org_id = $2 limit 1`,
      [id, orgId]
    );
    if (cQ.rowCount === 0) {
      return res.status(404).json({ ok:false, error:'campaign_not_found' });
    }
    const audience = cQ.rows[0].segment as Audience;

    // 2) Converte audience -> SQL + values e roda COUNT
    const { sql, values } = audienceToSQL(orgId, audience);
    const countQ = await pool.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`, values);
    const estimated_count = Number(countQ.rows[0]?.n || 0);

    return res.json({ ok:true, estimated_count });
  } catch (e:any) {
    console.error('[POST /campaigns/:id/estimate] err', e?.message || e);
    return res.status(502).json({ ok:false, error:'estimate_failed' });
  }
});

// PATCH /api/campaigns/:id/message
campaignsRouter.patch('/campaigns/:id/message', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || req.body?.org_id;
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    const msg = req.body?.message ?? {};
    const okType = ['text','audio','video'].includes(msg.type);
    if (!okType) return res.status(400).json({ ok:false, error:'invalid_message_type' });
    if (msg.type === 'text' && !msg.template_id && !(msg.body && String(msg.body).trim().length >= 5)) {
      return res.status(400).json({ ok:false, error:'text_body_or_template_required' });
    }
    if ((msg.type === 'audio' || msg.type === 'video') && !msg.template_id && !msg.media_url) {
      return res.status(400).json({ ok:false, error:'media_url_or_template_required' });
    }

    await pool.query(
      `update public.comms_campaigns set message=$3 where id=$1 and org_id=$2`,
      [id, orgId, JSON.stringify(msg)]
    );
    return res.json({ ok:true });
  } catch (e:any) {
    return res.status(502).json({ ok:false, error:'message_update_failed' });
  }
});


/**
 * POST /api/campaigns/:id/schedule
 * Salva throttle/delays/quiet_hours/dry_run como JSON dentro de comms_campaigns.status
 */
campaignsRouter.post('/campaigns/:id/schedule', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);

    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    const defaults = {
      text_delay: [Number(process.env.DEFAULT_TEXT_MIN_DELAY_SEC||0), Number(process.env.DEFAULT_TEXT_MAX_DELAY_SEC||30)],
      media_delay: [Number(process.env.DEFAULT_MEDIA_MIN_DELAY_SEC||30), Number(process.env.DEFAULT_MEDIA_MAX_DELAY_SEC||60)],
      per_minute: Number(process.env.DEFAULT_THROTTLE_PER_MINUTE||6),
      quiet_hours: [process.env.QUIET_HOURS_START||'22:00', process.env.QUIET_HOURS_END||'08:00'],
      dry_run: true
    };

    const cfg = {
      ...defaults,
      ...(req.body?.throttle||{}),
      safeguards: req.body?.safeguards || { frequency_cap_hours: 72 }
    };

    // guardamos no campo status como JSON textual para simplificar "pronto-para-rodar"
    await pool.query(
      `update comms_campaigns set status = $3 where id = $1 and org_id = $2`,
      [id, orgId, JSON.stringify({ phase:'scheduled', cfg })]
    );

    logger.info({ msg: 'Campaign scheduled', id, cfg });
    return res.json({ ok:true, phase:'scheduled', cfg });
  } catch (e:any) {
    logger.error({ msg: 'Schedule failed', error: e?.message || e });
    return res.status(502).json({ ok:false, error:'schedule_failed' });
  }
});

/**
 * POST /api/campaigns/:id/run
 * Dispara job no N8N com DRY-RUN obrigatório se cfg sinalizar.
 */
// POST /api/campaigns/:id/run  (DISPATCH N8N)
campaignsRouter.post('/campaigns/:id/run', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    const cQ = await pool.query(
      `select name, channel, segment, status, message
         from public.comms_campaigns
        where id=$1 and org_id=$2
        limit 1`,
      [id, orgId]
    );
    if (cQ.rowCount===0) return res.status(404).json({ ok:false, error:'campaign_not_found' });

    const c = cQ.rows[0];
    if (!c.message) {
      return res.status(400).json({ ok:false, error:'message_not_configured' });
    }

    // options/schedule guardados em status como JSON { phase, cfg }
    const options = (typeof c.status === 'string' && c.status.startsWith('{'))
      ? JSON.parse(c.status)
      : { phase:'scheduled', cfg:{} };

    const N8N = process.env.N8N_CAMPAIGN_DISPATCH_URL;
    if (!N8N) {
      logger.warn({ msg: 'N8N_CAMPAIGN_DISPATCH_URL not set — skipping external dispatch' });
      return res.json({ ok:true, run: { accepted:false, error:'n8n_missing' } });
    }

    const payload = {
      org_id: orgId,
      campaign_id: id,
      name: c.name,
      channel: c.channel || 'whatsapp.evolution',
      audience: c.segment,     // público escolhido
      message: c.message,      // mensagem escolhida no Step 3
      options                  // schedule/throttle/quiet_hours/dry_run
    };

    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (process.env.INTERNAL_TOKEN) headers['X-Internal-Token'] = process.env.INTERNAL_TOKEN;

    const resp = await axios.post(N8N, payload, { timeout: 30000, headers });
    logger.info({ msg: 'Campaign dispatched to N8N', id, accepted: !!resp.data });

    return res.json({ ok:true, run: resp.data || { accepted:true } });
  } catch (e:any) {
    logger.error({ msg: 'Run dispatch failed', error: e?.response?.data || e?.message || e });
    return res.json({ ok:false, error:'n8n_dispatch_failed' });
  }
});



// POST/PATCH /api/campaigns/:id/message
campaignsRouter.patch('/campaigns/:id/message', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    const msg = req.body?.message;
    if (!msg || !msg.type) {
      return res.status(400).json({ ok:false, error:'invalid_message' });
    }

    await pool.query(
      `update public.comms_campaigns
          set message = $3
        where id = $1 and org_id = $2`,
      [id, orgId, msg]
    );

    return res.json({ ok:true });
  } catch (e:any) {
    logger.error({ msg: 'save_message_failed', error: e?.message || e });
    return res.status(502).json({ ok:false, error:'save_message_failed' });
  }
});




/**
 * GET /api/campaigns/runs/active
 * Lista campanhas em execução ou recentes (KPIs simples)
 */
campaignsRouter.get('/campaigns/runs/active', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.query?.org_id as string);
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    // KPIs rápidos por campanha (últimas 24h)
    const kpis = await pool.query(`
      select
        cm.campaign_id,
        c.name as campaign_name,
        count(*) filter (where cm.status in ('queued','sending','sent')) as total_processed,
        count(*) filter (where cm.status = 'sent') as sent,
        count(*) filter (where cm.status = 'delivered') as delivered,
        count(*) filter (where cm.status = 'failed') as failed,
        min(cm.ts) as started_at,
        max(cm.ts) as last_event_at
      from comms_messages cm
      join comms_campaigns c on c.id = cm.campaign_id
      where c.org_id = $1
        and cm.ts >= now() - interval '24 hours'
      group by cm.campaign_id, c.name
      order by last_event_at desc nulls last
      limit 20
    `, [orgId]);

    return res.json({ ok:true, data: kpis.rows });
  } catch (e:any) {
    logger.error({ msg: 'Runs list failed', error: e?.message || e });
    return res.status(502).json({ ok:false, error:'runs_list_failed' });
  }
});

/**
 * GET /api/campaigns/runs/:run_id/progress (SSE)
 * Front conecta e recebe progresso em tempo real via N8N callbacks → aqui apenas simulamos "bridge".
 */
campaignsRouter.get('/campaigns/runs/:run_id/progress', authRequired, async (req, res) => {
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();

  // Dica: integrar com Redis pub/sub ou webhook do n8n armazenado em tabela progress.
  // Aqui, enviamos ping a cada 10s para manter a conexão aberta.
  const timer = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
  }, 10000);

  req.on('close', () => clearInterval(timer));
});
