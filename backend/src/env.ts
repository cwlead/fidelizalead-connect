import 'dotenv/config';

function req(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),

  PGHOST: req('PGHOST'),
  PGPORT: Number(req('PGPORT')),
  PGDATABASE: req('PGDATABASE'),
  PGUSER: req('PGUSER'),
  PGPASSWORD: req('PGPASSWORD'),
  PGSSLMODE: process.env.PGSSLMODE ?? 'disable',

  get DATABASE_URL() {
    // sem SSL:
    return `postgresql://${env.PGUSER}:${encodeURIComponent(env.PGPASSWORD)}@${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}?sslmode=${env.PGSSLMODE}`;
  },

  JWT_SECRET: req('JWT_SECRET'),

  EVOLUTION_BASE_URL: process.env.EVOLUTION_BASE_URL ?? '',
  EVOLUTION_AUTH_KEY: req('EVOLUTION_AUTH_KEY'),
  EVOLUTION_DEFAULT_WEBHOOK_URL: process.env.EVOLUTION_DEFAULT_WEBHOOK_URL ?? '',
  EVOLUTION_INSTANCE_PREFIX: process.env.EVOLUTION_INSTANCE_PREFIX ?? 'fidelizaglow',

  BOTCONVERSA_BASE_URL: req('BOTCONVERSA_BASE_URL'),
  APP_PUBLIC_BASE_URL: process.env.APP_PUBLIC_BASE_URL ?? '',
  N8N_CONTACT_SYNC_WEBHOOK_URL: process.env.N8N_CONTACT_SYNC_WEBHOOK_URL ?? '',

  // Recebe requisicao da evo
  EVOLUTION_WEBHOOK_TOKEN: req('EVOLUTION_WEBHOOK_TOKEN'),           
  EVOLUTION_WEBHOOK_SECRET: process.env.EVOLUTION_WEBHOOK_SECRET ?? '' 
};
