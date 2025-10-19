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

  EVOLUTION_HOST: req('EVOLUTION_HOST'),
  EVOLUTION_PORT: Number(req('EVOLUTION_PORT')),
  EVOLUTION_AUTH_KEY: req('EVOLUTION_AUTHENTICATION_API_KEY'),
  PROJECT_NAME: req('PROJECT_NAME'),

  BOTCONVERSA_BASE_URL: req('BOTCONVERSA_BASE_URL')
};
