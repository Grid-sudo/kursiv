import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const publicUser = user => {
  const object = user.toObject ? user.toObject() : { ...user };
  delete object.passwordHash;
  delete object.tokenVersion;
  delete object.__v;
  return object;
};

export async function optionalAuth(req, _res, next) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  const cookie = ['GET', 'HEAD'].includes(req.method) ? req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('course_session='))?.slice('course_session='.length) : null;
  const token = bearer || cookie;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('+tokenVersion');
      req.user = user && payload.ver === user.tokenVersion ? user : null;
    } catch { req.user = null; }
  }
  next();
}

export async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ error: 'Войдите в аккаунт' });
  if (!req.user.lastActiveAt || Date.now() - new Date(req.user.lastActiveAt).getTime() > 5 * 60_000) {
    req.user.lastActiveAt = new Date();
    await User.updateOne({ _id: req.user._id }, { lastActiveAt: req.user.lastActiveAt });
  }
  next();
}

export const allowRoles = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Недостаточно прав' });
