import { pool } from '../db';
import { evoGetConnectionState } from '../services/evolution.connection.service'; // ajuste o caminho se necessário
import { n8nContactSyncStart } from '../services/n8n.service'; // ajuste o caminho se necessário

// ---------- Backoff com full jitter ----------
function nextBackoffSeconds(attempt: number): number {
  // 1:10s, 2:30s, 3:60s, 4:300s(5m), 5:900s(15m), 6+:3600s(1h cap)
  const steps = [10, 30, 60, 300, 900];
  const base = attempt <= steps.length ? steps[attempt - 1] : 3600;
  // jitter +-30% (mín 1s)
  const jitter = Math.max(1, Math.floor(base * (0.7 + Math.random() * 0.6)));
  return jitter;
}

// ---------- Enfileirar/atualizar job ----------
export async function enqueueConnectionCheckJob(org_id: string, instance_name: string) {
  await pool.query(
    `
    insert into wpp.wpp_connection_jobs (org_id, instance_name, attempts, next_attempt_at, status, created_at, updated_at)
    values ($1, $2, 0, now(), 'pending', now(), now())
    on conflict (org_id) do update
       set instance_name  = excluded.instance_name,
           status         = 'pending',
           next_attempt_at= now(),
           updated_at     = now()
    `,
    [org_id, instance_name]
  );
}

// ---------- Worker: processa até N jobs vencidos ----------/*
export async function processDueConnectionChecks(limit = 10) {
  // 1) puxa jobs prontos
  const { rows: jobs } = await pool.query(
    `
    select org_id, instance_name, attempts
      from wpp.wpp_connection_jobs
     where status = 'pending'
       and next_attempt_at <= now()
     order by next_attempt_at asc
     limit $1
    `,
    [limit]
  );

  for (const j of jobs) {
    const { org_id, instance_name, attempts } = j;

    try {
      // 2) checa state na Evolution
      const state = await evoGetConnectionState(instance_name);

      if (state === 'open') {
        // 2.1) marca conectado (idempotente)
        await pool.query(
          `
          update org_settings
             set evolution_connected = true,
                 connected_at        = coalesce(connected_at, now()),
                 updated_at          = now()
           where org_id = $1
          `,
          [org_id]
        );

        // 2.2) dispara bootstrap N8N (somente uma vez)
        const st = await pool.query(
          `select n8n_bootstrap_sent_at, evolution_connected, evolution_instance_name
             from org_settings
            where org_id = $1
            limit 1`,
          [org_id]
        );
        const alreadySent = !!st.rows[0]?.n8n_bootstrap_sent_at;

        if (!alreadySent) {
          try {
            await n8nContactSyncStart({
              kind: 'CONTACT_SYNC_START',
              org_id,
              instance_name,
              evolution: { base_url: '' }, // opcional: env.EVOLUTION_BASE_URL
              triggered_at: new Date().toISOString(),
            });
            await pool.query(
              `update org_settings
                  set n8n_bootstrap_sent_at = now(),
                      updated_at = now()
                where org_id = $1`,
              [org_id]
            );
          } catch (err: any) {
            // Falha só no POST do N8N → reagenda este mesmo job para tentar de novo
            const nextSec = nextBackoffSeconds(attempts + 1);
            await pool.query(
              `
              update wpp.wpp_connection_jobs
                 set attempts = attempts + 1,
                     next_attempt_at = now() + ($1 || ' seconds')::interval,
                     last_error = $2,
                     updated_at = now()
               where org_id = $3
              `,
              [nextSec, String(err?.response?.data ?? err?.message ?? err), org_id]
            );
            continue; // passa pro próximo job
          }
        }

        // 2.3) finaliza job
        await pool.query(
          `update wpp.wpp_connection_jobs
              set status = 'done',
                  updated_at = now()
            where org_id = $1`,
          [org_id]
        );
        continue;
      }

      // 3) não-open → reagenda com backoff
      const nextSec = nextBackoffSeconds(attempts + 1);
      await pool.query(
        `
        update wpp.wpp_connection_jobs
           set attempts = attempts + 1,
               next_attempt_at = now() + ($1 || ' seconds')::interval,
               last_error = null,
               updated_at = now()
         where org_id = $2
        `,
        [nextSec, org_id]
      );
    } catch (err: any) {
      // 4) erro na Evolution: só re-tentar se não for 4xx permanente
      const status = err?.response?.status;
      const isPermanent4xx = status && status >= 400 && status < 500 && status !== 429;

      if (isPermanent4xx) {
        await pool.query(
          `
          update wpp.wpp_connection_jobs
             set status = 'dead',
                 last_error = $2,
                 updated_at = now()
           where org_id = $1
          `,
          [org_id, String(err?.response?.data ?? err?.message ?? err)]
        );
      } else {
        const nextSec = nextBackoffSeconds(attempts + 1);
        await pool.query(
          `
          update wpp.wpp_connection_jobs
             set attempts = attempts + 1,
                 next_attempt_at = now() + ($1 || ' seconds')::interval,
                 last_error = $2,
                 updated_at = now()
           where org_id = $3
          `,
          [nextSec, String(err?.response?.data ?? err?.message ?? err), org_id]
        );
      }
    }
  }
}
