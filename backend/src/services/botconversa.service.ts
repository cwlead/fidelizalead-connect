import axios from 'axios';
import { env } from '../env';

export async function getSubscriberByPhone(apiKey: string, phoneWithCountry: string) {
  const url = `${env.BOTCONVERSA_BASE_URL}/webhook/subscriber/get_by_phone/${phoneWithCountry}`;
  const res = await axios.get(url, {
    headers: {
      accept: 'application/json',
      'API-KEY': apiKey
    },
    timeout: 15000
  });
  return res.data;
}
