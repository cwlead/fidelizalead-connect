import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { findUserByEmail, checkPassword, getOrg } from '../repos/auth.repo';
import { authRequired } from '../middlewares/auth';

export const auth = Router();

auth.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(3)
    }).parse(req.body);

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await checkPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { sub: user.id, org_id: user.org_id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (e) { next(e); }
});

auth.post('/auth/logout', (_req, res) => {
  // stateless: o front só apaga o token
  res.json({ ok: true });
});

auth.get('/auth/me', authRequired, async (req, res, next) => {
  try {
    const u = (req as any).user as { sub: string; org_id: string; email: string };
    const org = await getOrg(u.org_id);
    const user = { id: u.sub, email: u.email, org_id: u.org_id };
    res.json({ user, organization: org });
  } catch (e) { next(e); }
});
