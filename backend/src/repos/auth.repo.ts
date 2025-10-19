import { pool } from '../db';
import bcrypt from 'bcrypt';

export type CoreUser = {
  id: string;
  org_id: string;
  email: string;
  name: string | null;
  role: string;              // << add
  password_hash: string;
  created_at: string;
};

export type CoreOrg = {
  id: string;
  name: string;
  segmento: string | null;
  features: any | null;
  created_at: string;
};

// busca usuário por email
export async function findUserByEmail(email: string): Promise<CoreUser | null> {
  const sql = `
    SELECT id, org_id, email, name, role, password_hash,         -- << role aqui
           to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM core_users
    WHERE email = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [email]);
  return rows[0] ?? null;
}

// valida senha
export async function checkPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// carrega org do usuário
export async function getOrg(orgId: string): Promise<CoreOrg | null> {
  const sql = `
    SELECT id, name, segmento, features,
           to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM core_orgs
     WHERE id = $1
     LIMIT 1
  `;
  const { rows } = await pool.query(sql, [orgId]);
  return rows[0] ?? null;
}
