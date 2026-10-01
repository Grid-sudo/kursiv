import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import User from '../models/User.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });
const [email, password, firstName = 'Администратор', lastName = 'Платформы'] = process.argv.slice(2);
if (!email || !email.includes('@') || !password || password.length < 10) {
  console.error('Использование: npm run create-admin -- email@example.com пароль_от_10_символов [Имя] [Фамилия]');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/course_studio');
try {
  if (await User.exists({ email: email.toLowerCase() })) throw new Error('Пользователь с таким email уже существует');
  await User.create({ firstName, lastName, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
  console.log(`Администратор ${email} создан`);
} finally { await mongoose.disconnect(); }
