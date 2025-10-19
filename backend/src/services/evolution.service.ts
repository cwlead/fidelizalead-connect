import axios from 'axios';
import { env } from '../env';

function evoBase() {
  return `http://${env.EVOLUTION_HOST}:${env.EVOLUTION_PORT}`;
}

export async function evoSendText(instanceName: string, to: string, text: string) {
  // Exemplo de endpoint comum na Evolution API (ajustamos se tua rota for diferente)
  const url = `${evoBase()}/${instanceName}/messages/sendText`;
  const res = await axios.post(url, { to, text }, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.EVOLUTION_AUTH_KEY // algumas builds usam 'Authorization', outras 'apikey'
    },
    timeout: 15000
  });
  return res.data;
}
