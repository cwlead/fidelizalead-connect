import { Pool } from 'pg';
import { env } from './env';
import { logger } from './logger';

export const pool = new Pool({
  host: env.PGHOST,
  port: env.PGPORT,
  database: env.PGDATABASE,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  ssl: env.PGSSLMODE !== 'disable' ? { rejectUnauthorized: false } : false,
});
 

const _query = pool.query.bind(pool);
pool.query = async (text: any, params?: any) => {
  if (process.env.LOG_SQL === 'true') {
    const t0 = Date.now();
    try {
      const res = await _query(text, params);
      logger.debug({
        msg: 'SQL',
        ms: Date.now() - t0,
        rowCount: (res as any)?.rowCount ?? null,
        sql: typeof text === 'string' ? text.trim().slice(0, 200) : '[prepared]',
        params: Array.isArray(params) ? params : undefined,
      });
      return res;
    } catch (err: any) {
      logger.error({
        msg: 'SQL ERROR',
        ms: Date.now() - t0,
        error: err?.message,
        sql: typeof text === 'string' ? text.trim().slice(0, 500) : '[prepared]',
        params: Array.isArray(params) ? params : undefined,
      });
      throw err;
    }
  }
  return _query(text, params);
};