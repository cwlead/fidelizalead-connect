import axios from 'axios';
import { env } from '../env';

export async function evoGetConnectionState(instanceName: string) {
  const { data } = await axios.get(
    `${env.EVOLUTION_BASE_URL}/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { headers: { apikey: env.EVOLUTION_AUTH_KEY } }
  );
  return data?.instance?.state ?? null; // esperado: "open" | "connecting" | "close" | "closed" | ...
}
