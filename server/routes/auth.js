import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { publicUser, requireAuth } from '../middleware/auth.js';

const router = Router();
const attempts = new Map();

router.post('/login', async (req, res) => {
  const key = req.ip || 'unknown';
  const entry = attempts.get(key) || { count: 0, until: Date.now() + 15 * 60_000 };
  if (Date.now() > entry.until) { entry.count = 0; entry.until = Date.now() + 15 * 60_000; }
  if (entry.count >= 8) return res.status(429).json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    entry.count += 1; attempts.set(key, entry);
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  attempts.delete(key);
  user.lastActiveAt = new Date();
  await user.save();
  const token = jwt.sign({ sub: user.id, ver: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('course_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 12 * 60 * 60_000 });
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => res.json(publicUser(req.user)));
router.post('/logout', requireAuth, async (req, res) => { await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } }); res.clearCookie('course_session'); res.json({ ok: true }); });

export default router;
