import { Router } from 'express';
import { pool } from '../db';
import { authRequired } from '../middlewares/auth';

type PgClient = import('pg').PoolClient;

export const campaignMaterialize = Router();

const jsonObject = (entries: Record<string, any>) => entries; // apenas semântica
/**
 * POST /api/campaigns/:id/materialize_and_run
 * - Cria um run (cfg “congelado” do segment/throttle)
 * - Materializa os targets conforme audience
 * - Coloca o run em 'running'
 * - Retorna { ok, run_id, inserted }
 */
campaignMaterialize.post('/:id/materialize_and_run', authRequired, async (req, res) => {
  const campaignId = (req.params.id || '').trim();
  if (!campaignId) return res.status(400).json({ error: 'missing_campaign_id' });

  const client = await pool.connect();
  try {
    // 1) Carrega campanha (usa segment JSON como fonte da audiência/cfg)
    const campQ = await client.query<{
      id: string;
      org_id: string;
      segment: any;
      channel: string | null;
      name: string;
    }>(
      `
      select id, org_id, segment, channel, name
        from public.comms_campaigns
       where id = $1
       limit 1
      `,
      [campaignId]
    );
    if (campQ.rowCount === 0) {
      return res.status(404).json({ error: 'campaign_not_found' });
    }
    const campaign = campQ.rows[0];

    // Aceita estruturas:
    // A) segment = { audience: {type, params}, throttle: {...} }
    // B) segment = { type, params, throttle? }
    const seg = campaign.segment || {};
    const audience = seg.audience ?? { type: seg.type, params: seg.params };
    const cfg =
      seg.throttle ??
      seg.options ?? {
        text_delay: [0, 30],
        media_delay: [30, 60],
        per_minute: 6,
        quiet_hours: ['22:00', '08:00'],
        dry_run: true,
        safeguards: { frequency_cap_hours: 72 },
      };

    // 2) Inicia transação e cria o RUN
    await client.query('begin');
    const runInsert = await client.query<{ id: string }>(
      `
      insert into public.comms_campaign_runs (org_id, campaign_id, status, cfg)
      values ($1, $2, 'scheduled', $3)
      returning id
      `,
      [campaign.org_id, campaign.id, cfg]
    );
    const runId = runInsert.rows[0].id;

    // 3) Materializa conforme audience
    let inserted = 0;
    const type = (audience?.type || '').trim();

    if (type === 'joined_group_recent') {
      const p = audience?.params || {};
      const days: number = Number(p.days ?? 3);
      const groupIdOrWa: string = String(p.group_id ?? '').trim();
      const resMat = await materializeJoinedGroupRecent({
        client,
        runId,
        orgId: campaign.org_id,
        campaignId: campaign.id,
        days,
        groupIdOrWa,
      });
      inserted = resMat.rowCount || 0;
    } else if (type === 'all_contacts') {
      const resMat = await materializeAllContacts({
        client,
        runId,
        orgId: campaign.org_id,
        campaignId: campaign.id,
      });
      inserted = resMat.rowCount || 0;
    } else {
      await client.query('rollback');
      return res.status(400).json({ error: `audience_not_supported:${type}` });
    }

    // 4) Liga o run
    await client.query(
      `update public.comms_campaign_runs set status='running', started_at=now() where id=$1`,
      [runId]
    );
    await client.query('commit');

    return res.json({ ok: true, run_id: runId, inserted });
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('[materialize_and_run] error', err);
    return res.status(500).json({ ok: false, error: 'materialize_and_run_failed' });
  } finally {
    client.release();
  }
});

/** Materializa: entrou no grupo recentemente (days, group_id/id/wa_group_id) */
export async function materializeJoinedGroupRecent(args: {
  client: PgClient;
  runId: string;
  orgId: string;
  campaignId: string;
  days: number;
  groupIdOrWa: string;
}) {
  const { client, runId, orgId, campaignId, days, groupIdOrWa } = args;

  const sql = `
    with g as (
      select id, subject, name, wa_group_id
        from public.wpp_groups
       where org_id = $1
         and (id::text = $2 or wa_group_id = $2)
       limit 1
    )
    insert into public.comms_campaign_targets
      (run_id, org_id, campaign_id, contact_id, wa_user_id, phone_e164, variables)
    select
      $3 as run_id,
      m.org_id,
      $4 as campaign_id,
      m.contact_id,
      m.wa_user_id,
      case when m.wa_user_id ~ '^[0-9]{10,15}$' then '+' || m.wa_user_id else null end as phone_e164,
      jsonb_build_object(
        'first_name', split_part(coalesce(c.name, ''), ' ', 1),
        'group_name', coalesce(gx.subject, gx.name),
        'wa_group_id', gx.wa_group_id
      )::jsonb as variables
      from public.wpp_group_members m
      join g              on m.group_id = g.id
      join public.wpp_groups gx on gx.id = m.group_id
 left  join public.crm_contacts c on c.id = m.contact_id
     where m.is_member = true
       and coalesce(m.last_join_at, m.first_join_at) >= (now() - ($5::int || ' days')::interval)
       and (m.wa_user_id ~ '^[0-9]{10,15}$' or m.contact_id is not null)
    on conflict do nothing
  `;
  return client.query(sql, [orgId, groupIdOrWa, runId, campaignId, days]);
}

/** Materializa: todos os contatos habilitados (optout_at IS NULL), com telefone/whatsapp válidos */
export async function materializeAllContacts(args: {
  client: PgClient;
  runId: string;
  orgId: string;
  campaignId: string;
}) {
  const { client, runId, orgId, campaignId } = args;

  const sql = `
    with src as (
      select
        c.id,
        c.org_id,
        c.name,
        c.phone_e164 as phone_raw,
        ck.value     as wa_key
      from public.crm_contacts c
 left join public.crm_contact_keys ck
        on ck.org_id = c.org_id
       and ck.contact_id = c.id
       and ck.kind = 'whatsapp_digits'
     where c.org_id = $3
       and c.optout_at is null
    ),
    norm as (
      select
        id, org_id, name,
        -- computa wa_user_id e phone_e164 padrões
        case
          when wa_key    ~ '^[0-9]{10,15}$' then wa_key
          when phone_raw ~ '^\\+?[0-9]{10,15}$' then regexp_replace(phone_raw, '\\D', '', 'g')
          else null
        end as wa_user_id,
        case
          when phone_raw ~ '^\\+?[0-9]{10,15}$'
            then case when left(phone_raw,1)='+' then phone_raw else '+'||regexp_replace(phone_raw,'\\D','','g') end
          when wa_key    ~ '^[0-9]{10,15}$'
            then '+'||wa_key
          else null
        end as phone_e164
      from src
    )
    insert into public.comms_campaign_targets
      (run_id, org_id, campaign_id, contact_id, wa_user_id, phone_e164, variables)
    select
      $1 as run_id,
      n.org_id,
      $2 as campaign_id,
      n.id       as contact_id,
      n.wa_user_id,
      n.phone_e164,
      jsonb_build_object(
        'first_name', split_part(coalesce(n.name,''), ' ', 1)
      )::jsonb as variables
    from norm n
    where n.wa_user_id is not null
    on conflict do nothing
  `;
  return client.query(sql, [runId, campaignId, orgId]);
}


// GET /api/campaigns/runs/active?org_id=... - 
campaignMaterialize.get('/runs/active', authRequired, async (req, res) => {
  const orgId = String((req.query.org_id as string) || '').trim() || (req as any).user?.org_id;
  if (!orgId) return res.status(400).json({ error: 'missing_org_id' });

  const client = await pool.connect();
  try {
    const sql = `
      with runs as (
        select r.id as run_id, r.campaign_id, r.status as last_run_status, r.created_at as last_run_created_at
        from public.comms_campaign_runs r
        where r.org_id = $1 and r.status in ('scheduled','running','paused')
      ),
      counts as (
        select
          t.campaign_id,
          jsonb_build_object(
            'queued',  count(*) filter (where t.status = 'queued'),
            'sending', count(*) filter (where t.status = 'sending'),
            'sent',    count(*) filter (where t.status = 'sent'),
            'failed',  count(*) filter (where t.status = 'failed'),
            'skipped', count(*) filter (where t.status = 'skipped')
          ) as counts
        from public.comms_campaign_targets t
        where t.org_id = $1
        group by 1
      )
      select
        c.id,
        c.name,
        c.channel,
        r.run_id,
        r.last_run_status,
        public.status_label('run', r.last_run_status, 'pt') as last_run_status_label,
        coalesce((cnt.counts->>'sent')::int, 0) as sent,
        cnt.counts
      from public.comms_campaigns c
      join runs r on r.campaign_id = c.id
      left join counts cnt on cnt.campaign_id = c.id
      where c.org_id = $1
      order by c.name asc
    `;

    const q = await client.query(sql, [orgId]);

    const rows = q.rows.map(r => ({
      ...r,
      delivered: r.sent,
      last_run_status_raw: r.last_run_status,
      last_run_status: r.last_run_status_label || r.last_run_status,
      status: r.last_run_status_label || r.last_run_status,
    }));

    return res.status(200).json(rows);
  } catch (e) {
    console.error('[GET /runs/active] error', e);
    return res.status(500).json({ error: 'active_runs_failed' });
  } finally {
    client.release();
  }
});


// GET /api/campaigns/runs/active_v2 - TRÁS DADOS DE CAMPANHA PARA FRONT ABA CAMPANHAS
campaignMaterialize.get('/runs/active_v2', authRequired, async (req, res) => {
  const orgId = String((req.query.org_id as string) || '').trim() || (req as any).user?.org_id;
  if (!orgId) return res.status(400).json({ error: 'missing_org_id' });

  const client = await pool.connect();
  try {
    const sql = `
      WITH runs AS (
        SELECT r.id AS run_id, r.campaign_id, r.status AS run_status
        FROM public.comms_campaign_runs r
        WHERE r.org_id = $1
          AND r.status IN ('scheduled','running','paused')
      ),
      t AS (
        SELECT t.*
        FROM public.comms_campaign_targets t
        JOIN runs r ON r.run_id = t.run_id
        WHERE t.org_id = $1
      ),
      cnt AS (
        SELECT
          t.run_id,
          COUNT(*) FILTER (WHERE t.status = 'queued')                                    AS queued,
          COUNT(*) FILTER (WHERE t.status = 'sending')                                   AS sending,
          COUNT(*) FILTER (WHERE t.status IN ('sent','delivered','read'))                AS sent_or_better,
          COUNT(*) FILTER (WHERE t.status = 'failed')                                    AS failed
        FROM t
        GROUP BY 1
      ),
      last_evt AS (
        SELECT t.run_id, MAX(e.created_at) AS last_event_at
        FROM t
        LEFT JOIN public.comms_campaign_events e
               ON e.run_id = t.run_id AND e.target_id = t.id
        GROUP BY t.run_id
      )
      SELECT
        c.id              AS campaign_id,
        c.org_id,
        c.name,
        c.channel,
        r.run_id,
        r.run_status,
        COALESCE(cnt.queued,0)         AS queued,
        COALESCE(cnt.sending,0)        AS sending,
        COALESCE(cnt.sent_or_better,0) AS sent_or_better,
        COALESCE(cnt.failed,0)         AS failed,
        le.last_event_at,
        now() AS updated_at
      FROM public.comms_campaigns c
      JOIN runs r      ON r.campaign_id = c.id
      LEFT JOIN cnt    ON cnt.run_id     = r.run_id
      LEFT JOIN last_evt le ON le.run_id = r.run_id
      WHERE c.org_id = $1
      ORDER BY le.last_event_at DESC NULLS LAST, c.name ASC
    `;

    const { rows } = await client.query(sql, [orgId]);

    const mapped = rows.map((r: any) => {
      const queued        = Number(r.queued || 0);
      const progress      = Number(r.sending || 0) + Number(r.sent_or_better || 0);
      const deliveredCnt  = Number(r.sent_or_better || 0);

      // code para lógica (EN) + label PT para exibição
      const status_code  = progress > 0 ? 'running' : (queued > 0 ? 'scheduled' : r.run_status);
      const status_label = progress > 0 ? 'Rodando'   : (queued > 0 ? 'Na fila'   : 'Agendada');

      return {
        run_id: r.run_id,
        campaign_id: r.campaign_id,
        org_id: r.org_id,
        name: r.name,
        channel: r.channel,

        // o front usa estes:
        status: status_code,          // EN: running/scheduled/paused...
        status_label,                 // PT: Ativo / Na fila / Agendada

        // contadores (badge "Enviados" = PENDENTES/queued)
        sent: queued,
        delivered: deliveredCnt,
        failed: Number(r.failed || 0),

        last_event_at: r.last_event_at,
        updated_at: r.updated_at,
      };
    });

    res.status(200).json(mapped);
  } catch (e) {
    console.error('[GET /runs/active_v2] error', e);
    res.status(500).json({ error: 'active_runs_failed' });
  } finally {
    client.release();
  }
});



// GET /api/campaigns/runs/:runId/recent_recipients?org_id=... -- Listar os 10 primeiros da campos
// GET /runs/:runId/recent_recipients
campaignMaterialize.get('/runs/:runId/recent_recipients', authRequired, async (req, res) => {
  const runId = String(req.params.runId || '').trim();
  const orgId = String((req.query.org_id as string) || '').trim() || (req as any).user?.org_id;

  if (!runId || !orgId) {
    return res.status(400).json({ error: 'missing_params', detail: { runId, orgId } });
  }

  // Sem cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const client = await pool.connect();
  try {
    const sql = `
            WITH params AS (
      SELECT $1::uuid AS run_id, $2::uuid AS org_id
    ),
    sent_rows AS (
      SELECT
        t.id  AS target_id,
        t.contact_id,
        t.wa_user_id,
        t.phone_e164,
        COALESCE(NULLIF(c.name,''), t.variables->>'first_name', t.variables->>'name') AS display_name,
        'event'::text AS status_domain,
        e.kind        AS status_code,
        public.status_label('event', e.kind, 'pt') AS status_label_pt,
        COALESCE(NULLIF(e.meta->>'ts','')::timestamptz, e.created_at) AS event_at
      FROM public.comms_campaign_events e
      JOIN public.comms_campaign_targets t
        ON t.id = e.target_id
      AND t.run_id = e.run_id
      JOIN params p
        ON p.run_id = e.run_id
      AND p.org_id = t.org_id
      LEFT JOIN public.crm_contacts c
        ON c.id = t.contact_id
      AND c.org_id = t.org_id
      WHERE e.kind = 'sent'
      ORDER BY event_at DESC
      LIMIT 10
    ),
    queued_rows AS (
      SELECT
        t.id  AS target_id,
        t.contact_id,
        t.wa_user_id,
        t.phone_e164,
        COALESCE(NULLIF(c.name,''), t.variables->>'first_name', t.variables->>'name') AS display_name,
        'target'::text AS status_domain,
        t.status      AS status_code,
        public.status_label('target', t.status, 'pt') AS status_label_pt,
        NULL::timestamptz AS event_at
      FROM public.comms_campaign_targets t
      JOIN params p
        ON p.run_id = t.run_id
      AND p.org_id = t.org_id
      LEFT JOIN public.crm_contacts c
        ON c.id = t.contact_id
      AND c.org_id = t.org_id
      WHERE t.status = 'queued'
      ORDER BY t.id DESC
      LIMIT 10
    )
    SELECT * FROM sent_rows
    UNION ALL
    SELECT * FROM queued_rows
    ORDER BY event_at DESC NULLS LAST, target_id DESC;`;
    const q = await client.query(sql, [runId, orgId]);

    const rows = q.rows.map(r => ({
      target_id:    r.target_id,
      contact_id:   r.contact_id,
      name:         r.display_name || null,
      phone_e164:   r.phone_e164,
      wa_user_id:   r.wa_user_id,
      status_code:  r.status_code,   // ex.: 'sent'
      status_label: r.status_label,  // ex.: 'Enviado'
      status:       r.status_label,  // <<< LEGACY para UI antiga não quebrar
      event_at:     r.event_at,
    }));

    return res.status(200).json(rows);
  } catch (e) {
    console.error('[GET /runs/:runId/recent_recipients] error', e);
    return res.status(500).json({ error: 'recent_recipients_failed' });
  } finally {
    client.release();
  }
});


export default campaignMaterialize;
