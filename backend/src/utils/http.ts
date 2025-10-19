import axios from 'axios';
import { logger } from '../logger';

const http = axios.create();

http.interceptors.request.use((config) => {
  if (process.env.LOG_EXTERNAL === 'true') {
    (config as any).__t0 = Date.now();
    logger.debug({
      msg: 'HTTP EXT →',
      method: config.method,
      url: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
    });
  }
  return config;
}, (error) => {
  logger.error({ msg: 'HTTP EXT REQ ERROR', error: error?.message });
  return Promise.reject(error);
});

http.interceptors.response.use((response) => {
  if (process.env.LOG_EXTERNAL === 'true') {
    const ms = Date.now() - ((response.config as any).__t0 ?? Date.now());
    logger.debug({
      msg: 'HTTP EXT ←',
      method: response.config?.method,
      url: response.config?.baseURL ? `${response.config.baseURL}${response.config.url}` : response.config?.url,
      status: response.status,
      ms,
    });
  }
  return response;
}, (error) => {
  const cfg: any = error?.config || {};
  const ms = Date.now() - (cfg.__t0 ?? Date.now());
  logger.error({
    msg: 'HTTP EXT ERROR',
    method: cfg.method,
    url: cfg.baseURL ? `${cfg.baseURL}${cfg.url}` : cfg.url,
    status: error?.response?.status,
    ms,
    error: error?.message,
    data: error?.response?.data,
  });
  return Promise.reject(error);
});

export default http;
