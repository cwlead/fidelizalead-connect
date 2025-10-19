import { pool } from '../db';
import { randomUUID } from 'crypto';

export type CoreOrg = {
  id: string;
  name: string;
  segmento: string | null;
  features: any | null;
  created_at: string;
};

export async function createOrg(name: string, segmento?: string | null): Promise<CoreOrg> {
  const id = randomUUID();
  const sql = `
    INSERT INTO core_orgs (id, name, segmento, features, created_at)
    VALUES ($1, $2, $3, '{}'::jsonb, now())
    RETURNING id, name, segmento, features,
      to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at;
  `;
  const { rows } = await pool.query(sql, [id, name, segmento ?? null]);
  return rows[0];
}

export async function upsertFeature(orgId: string, key: string, value: unknown) {
  const sql = `
    UPDATE core_orgs
       SET features = COALESCE(features, '{}'::jsonb) || jsonb_build_object($2, to_jsonb($3::text))
     WHERE id = $1
  `;
  await pool.query(sql, [orgId, key, String(value)]);
  return { ok: true };
}

export async function getOrgById(orgId: string): Promise<CoreOrg | null> {
  const { rows } = await pool.query(
    `SELECT id, name, segmento, features,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
       FROM core_orgs
      WHERE id = $1`,
    [orgId]
  );
  return rows[0] ?? null;
}
