import { Router } from 'express';
import axios from 'axios';
import { pool } from '../db';
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { logger } from '../logger';

export const campaignsRouter = Router();

/**
 * GET /api/campaigns/presets
 * Públicos prontos (o front só exibe e manda como audience)
 */
campaignsRouter.get('/campaigns/presets', authRequired, async (req, res) => {
  return res.json([
    {
      key: 'left_group_recent',
      label: 'Saíram do grupo (últimos N dias)',
      params: { group_id: '<WA_GROUP_ID>', days: 7 }
    },
    {
      key: 'joined_group_recent',
      label: 'Entraram no grupo (últimos N dias)',
      params: { group_id: '<WA_GROUP_ID>', days: 3 }
    },
    {
      key: 'inactive_since_months',
      label: 'Inativos há X meses',
      params: { months: 3 }
    },
    {
      key: 'top_buyers',
      label: 'Top 20 compradores',
      params: { limit: 20 }
    }
  ]);
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
    const N8N = process.env.N8N_AUDIENCE_ESTIMATE_URL;
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);

    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    // Lê campaign.segment
    const { rows } = await pool.query<{ segment: any }>(
      `select segment from comms_campaigns where id = $1 and org_id = $2 limit 1`,
      [id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ ok:false, error:'campaign_not_found' });

    const audience = rows[0].segment;

    if (N8N) {
      const resp = await axios.post(N8N, { org_id: orgId, campaign_id: id, audience }, { timeout: 20000 });
      logger.info({ msg: 'Audience estimated via N8N', id, count: resp.data?.estimated_count });
      return res.json({ ok:true, estimated_count: resp.data?.estimated_count ?? 0 });
    }

    // MOCK rápido (ajuste com SQL real quando quiser):
    logger.info({ msg: 'Audience estimated (mock)', id, count: 42 });
    return res.json({ ok:true, estimated_count: 42 });
  } catch (e:any) {
    logger.error({ msg: 'Estimate failed', error: e?.message || e });
    return res.status(502).json({ ok:false, error:'estimate_failed' });
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
campaignsRouter.post('/campaigns/:id/run', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok:false, error:'missing_org_id' });

    const N8N = process.env.N8N_CAMPAIGN_DISPATCH_URL;
    if (!N8N) return res.status(500).json({ ok:false, error:'missing_env_N8N_CAMPAIGN_DISPATCH_URL' });

    const cQ = await pool.query(`select name, channel, segment, status from comms_campaigns where id=$1 and org_id=$2 limit 1`, [id, orgId]);
    if (cQ.rowCount===0) return res.status(404).json({ ok:false, error:'campaign_not_found' });

    const campaign = cQ.rows[0];

    const payload = {
      org_id: orgId,
      campaign_id: id,
      name: campaign.name,
      channel: campaign.channel || 'whatsapp.evolution',
      audience: campaign.segment,
      options: (typeof campaign.status === 'string' && campaign.status.startsWith('{'))
        ? JSON.parse(campaign.status) : { phase:'scheduled'}
    };

    logger.info({ msg: 'Dispatching campaign to N8N', id, payload });
    const resp = await axios.post(N8N, payload, { timeout: 30000 });
    logger.info({ msg: 'Campaign dispatched', id, response: resp.data });
    return res.json({ ok:true, run: resp.data || { accepted:true } });
  } catch (e:any) {
    logger.error({ msg: 'Run failed', error: e?.response?.data || e?.message || e });
    return res.status(502).json({ ok:false, error:'run_failed' });
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
