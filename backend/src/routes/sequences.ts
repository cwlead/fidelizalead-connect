import { Router } from 'express';
import { pool } from '../db';
import { authRequired, type JwtPayload } from '../middlewares/auth';
import { logger } from '../logger';
import axios from 'axios';

export const sequencesRouter = Router();

/**
 * GET /api/sequences
 * Lista sequências com filtros
 */
sequencesRouter.get('/sequences', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.query.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const status = req.query.status as string | undefined;
    const channel = req.query.channel as string | undefined;
    const q = req.query.q as string | undefined;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;

    const countQ = await pool.query<{ total: number }>(
      `select count(*)::int as total
       from public.comms_sequences
       where org_id = $1
         and ($2::text is null or status = $2)
         and ($3::text is null or channel = $3)
         and ($4::text is null or unaccent(lower(name)) like unaccent(lower('%'||$4||'%')))`,
      [orgId, status || null, channel || null, q || null]
    );

    const itemsQ = await pool.query(
      `select
         s.*,
         (select count(*) from public.comms_sequence_steps st where st.sequence_id = s.id) as steps_count
       from public.comms_sequences s
       where s.org_id = $1
         and ($2::text is null or s.status = $2)
         and ($3::text is null or s.channel = $3)
         and ($4::text is null or unaccent(lower(s.name)) like unaccent(lower('%'||$4||'%')))
       order by s.updated_at desc, s.created_at desc
       limit $5 offset $6`,
      [orgId, status || null, channel || null, q || null, limit, offset]
    );

    return res.json({
      items: itemsQ.rows,
      total: countQ.rows[0].total,
      page,
      limit,
    });
  } catch (e: any) {
    logger.error({ msg: 'GET /sequences failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'list_failed' });
  }
});

/**
 * POST /api/sequences
 * Cria nova sequência (draft)
 */
sequencesRouter.post('/sequences', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const name = req.body?.name || 'Nova Sequência';
    const channel = req.body?.channel || 'whatsapp';

    const result = await pool.query(
      `insert into public.comms_sequences (org_id, name, channel, status, version, active)
       values ($1, $2, $3, 'draft', 1, true)
       returning *`,
      [orgId, name, channel]
    );

    logger.info({ msg: 'Sequence created', id: result.rows[0].id, orgId });
    return res.status(201).json({ sequence: result.rows[0] });
  } catch (e: any) {
    logger.error({ msg: 'POST /sequences failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'create_failed' });
  }
});

/**
 * GET /api/sequences/:id
 * Lê sequência + passos
 */
sequencesRouter.get('/sequences/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.query.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const seqQ = await pool.query(
      `select * from public.comms_sequences where id = $1 and org_id = $2`,
      [id, orgId]
    );
    if (seqQ.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'sequence_not_found' });
    }

    const stepsQ = await pool.query(
      `select id, sequence_id, idx, kind, cfg
       from public.comms_sequence_steps
       where sequence_id = $1
       order by idx asc`,
      [id]
    );

    return res.json({
      sequence: seqQ.rows[0],
      steps: stepsQ.rows,
    });
  } catch (e: any) {
    logger.error({ msg: 'GET /sequences/:id failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'read_failed' });
  }
});

/**
 * PUT /api/sequences/:id
 * Atualiza metadados (apenas draft)
 */
sequencesRouter.put('/sequences/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const { name, active } = req.body;

    const result = await pool.query(
      `update public.comms_sequences
       set name = coalesce($3, name),
           active = coalesce($4, active),
           updated_at = now()
       where id = $1 and org_id = $2 and status = 'draft'
       returning *`,
      [id, orgId, name || null, active ?? null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'sequence_not_found_or_not_draft' });
    }

    return res.json({ sequence: result.rows[0] });
  } catch (e: any) {
    logger.error({ msg: 'PUT /sequences/:id failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'update_failed' });
  }
});

/**
 * PUT /api/sequences/:id/steps
 * Salva passos (substitui lista completa; apenas draft)
 */
sequencesRouter.put('/sequences/:id/steps', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const steps = req.body?.steps || [];

    // Verificar se é draft
    const seqQ = await pool.query(
      `select status from public.comms_sequences where id = $1 and org_id = $2`,
      [id, orgId]
    );
    if (seqQ.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'sequence_not_found' });
    }
    if (seqQ.rows[0].status !== 'draft') {
      return res.status(400).json({ ok: false, error: 'sequence_not_draft' });
    }

    // Validar passos
    for (const step of steps) {
      if (!step.kind || !['text', 'image', 'audio', 'video', 'document'].includes(step.kind)) {
        return res.status(400).json({ ok: false, error: 'invalid_step_kind' });
      }
      if (step.kind === 'text' && !step.cfg?.text) {
        return res.status(400).json({ ok: false, error: 'text_step_requires_text' });
      }
      if (['image', 'audio', 'video', 'document'].includes(step.kind) && !step.cfg?.fileId) {
        return res.status(400).json({ ok: false, error: 'media_step_requires_fileId' });
      }
    }

    // Deletar passos antigos e inserir novos
    await pool.query('delete from public.comms_sequence_steps where sequence_id = $1', [id]);

    const insertedSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const result = await pool.query(
        `insert into public.comms_sequence_steps (sequence_id, idx, kind, cfg)
         values ($1, $2, $3, $4)
         returning *`,
        [id, i + 1, step.kind, JSON.stringify(step.cfg)]
      );
      insertedSteps.push(result.rows[0]);
    }

    // Atualizar updated_at da sequência
    await pool.query('update public.comms_sequences set updated_at = now() where id = $1', [id]);

    return res.json({ steps: insertedSteps });
  } catch (e: any) {
    logger.error({ msg: 'PUT /sequences/:id/steps failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'steps_update_failed' });
  }
});

/**
 * POST /api/sequences/:id/publish
 * Publica sequência (incrementa versão, trava edição)
 */
sequencesRouter.post('/sequences/:id/publish', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    // Verificar se tem pelo menos 1 passo
    const stepsQ = await pool.query(
      `select count(*) as n from public.comms_sequence_steps where sequence_id = $1`,
      [id]
    );
    if (Number(stepsQ.rows[0].n) === 0) {
      return res.status(400).json({ ok: false, error: 'sequence_requires_at_least_one_step' });
    }

    const result = await pool.query(
      `update public.comms_sequences
       set status = 'published',
           version = version + 1,
           updated_at = now()
       where id = $1 and org_id = $2 and status = 'draft'
       returning *`,
      [id, orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'sequence_not_found_or_not_draft' });
    }

    logger.info({ msg: 'Sequence published', id, orgId, version: result.rows[0].version });
    return res.json({ sequence: result.rows[0] });
  } catch (e: any) {
    logger.error({ msg: 'POST /sequences/:id/publish failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'publish_failed' });
  }
});

/**
 * POST /api/sequences/:id/duplicate
 * Duplica sequência (cria novo draft)
 */
sequencesRouter.post('/sequences/:id/duplicate', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const result = await pool.query(
      `with src as (
         select * from public.comms_sequences where id = $1 and org_id = $2
       ),
       new_seq as (
         insert into public.comms_sequences (org_id, name, channel, status, version, active)
         select org_id, name || ' (cópia)', channel, 'draft', 1, true
         from src
         returning *
       )
       insert into public.comms_sequence_steps (sequence_id, idx, kind, cfg)
       select n.id, st.idx, st.kind, st.cfg
       from new_seq n
       join public.comms_sequence_steps st on st.sequence_id = $1
       returning sequence_id`,
      [id, orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'sequence_not_found' });
    }

    const newSeqId = result.rows[0].sequence_id;
    const seqQ = await pool.query(
      `select * from public.comms_sequences where id = $1`,
      [newSeqId]
    );
    const stepsQ = await pool.query(
      `select * from public.comms_sequence_steps where sequence_id = $1 order by idx`,
      [newSeqId]
    );

    logger.info({ msg: 'Sequence duplicated', original: id, new: newSeqId, orgId });
    return res.status(201).json({
      sequence: seqQ.rows[0],
      steps: stepsQ.rows,
    });
  } catch (e: any) {
    logger.error({ msg: 'POST /sequences/:id/duplicate failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'duplicate_failed' });
  }
});

/**
 * POST /api/sequences/:id/test-send
 * Envia teste para um número (chama Runner N8N)
 */
sequencesRouter.post('/sequences/:id/test-send', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const { wa_number, vars } = req.body;
    if (!wa_number) {
      return res.status(400).json({ ok: false, error: 'wa_number_required' });
    }

    const N8N = process.env.N8N_SEQUENCE_TEST_URL;
    if (!N8N) {
      logger.warn({ msg: 'N8N_SEQUENCE_TEST_URL not set' });
      return res.json({ ok: true, test_run_id: 'mock-test-' + Date.now() });
    }

    const payload = {
      org_id: orgId,
      sequence_id: id,
      wa_number,
      vars: vars || {},
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.INTERNAL_TOKEN) headers['X-Internal-Token'] = process.env.INTERNAL_TOKEN;

    const resp = await axios.post(N8N, payload, { timeout: 30000, headers });
    logger.info({ msg: 'Sequence test-send dispatched', id, wa_number });

    return res.status(202).json({
      ok: true,
      test_run_id: resp.data?.test_run_id || 'test-' + Date.now(),
    });
  } catch (e: any) {
    logger.error({ msg: 'POST /sequences/:id/test-send failed', error: e?.response?.data || e?.message || e });
    return res.status(502).json({ ok: false, error: 'test_send_failed' });
  }
});

/**
 * POST /api/sequences/:id/archive
 * Arquiva sequência publicada
 */
sequencesRouter.post('/sequences/:id/archive', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as JwtPayload | undefined;
    const orgId = user?.org_id || (req.body?.org_id as string);
    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const result = await pool.query(
      `update public.comms_sequences
       set status = 'archived',
           updated_at = now()
       where id = $1 and org_id = $2 and status = 'published'
       returning *`,
      [id, orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'sequence_not_found_or_not_published' });
    }

    return res.json({ sequence: result.rows[0] });
  } catch (e: any) {
    logger.error({ msg: 'POST /sequences/:id/archive failed', error: e?.message || e });
    return res.status(502).json({ ok: false, error: 'archive_failed' });
  }
});
