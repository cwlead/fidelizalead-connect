import { Router } from 'express';
import { z } from 'zod';
import { evoSendText } from '../services/evolution.service';

export const evolution = Router();

const SendTextSchema = z.object({
  instance: z.string().min(1), // nome da instância na Evolution
  to: z.string().min(8),       // telefone destino no formato aceito pela Evolution
  text: z.string().min(1)
});

evolution.post('/send-text', async (req, res, next) => {
  try {
    const { instance, to, text } = SendTextSchema.parse(req.body);
    const data = await evoSendText(instance, to, text);
    res.json(data);
  } catch (e) { next(e); }
});
