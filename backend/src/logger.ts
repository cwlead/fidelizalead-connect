import pino from 'pino';

const pretty = process.env.LOG_PRETTY === 'true';
const level  = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  redact: process.env.REDACT_TOKENS === 'true' ? {
    paths: [
      'req.headers.authorization',
      'req.headers.apikey',
      'config.headers.authorization',
      'config.headers.apikey',
      'headers.authorization',
      'headers.apikey'
    ],
    remove: true
  } : undefined,
  transport: pretty ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined,
});
