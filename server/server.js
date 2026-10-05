import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import api from './routes/api.js';
import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import Course from './models/Course.js';
import Week from './models/Week.js';
import Day from './models/Day.js';
import Lesson from './models/Lesson.js';
import Upload from './models/Upload.js';
import User from './models/User.js';
import Homework from './models/Homework.js';
import HomeworkSubmission from './models/HomeworkSubmission.js';
import { studentCanOpenLesson } from './controllers/courseController.js';
import { courseForLesson } from './controllers/progressController.js';
import { canReadCourse } from './middleware/courseAccess.js';
import { optionalAuth } from './middleware/auth.js';

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);
dotenv.config({ path: path.resolve(root, '../.env') });
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(root, 'uploads'));
const clientDist = path.resolve(root, '../client/dist');
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
app.get('/uploads/:filename', optionalAuth, async (req, res) => {
  const filename = req.params.filename;
  if (filename !== path.basename(filename)) return res.status(404).end();
  const url = `/uploads/${filename}`;
  const coverCourse = await Course.findOne({ cover: url }, '_id moderationStatus createdBy').lean();
  let allowed = Boolean(coverCourse && ((!coverCourse.moderationStatus || coverCourse.moderationStatus === 'approved') || req.user?.role === 'admin' || (req.user?.role === 'teacher' && String(coverCourse.createdBy) === String(req.user._id))));
  if (!allowed && req.user) {
    allowed = !!await User.exists({ avatar: url });
    if (!allowed) allowed = !!await Upload.exists({ filename, ownerId: req.user._id });
    if (!allowed) {
      const upload = await Upload.findOne({ filename }, '_id').lean();
      if (upload) {
        const assignment = await Homework.findOne({ $or: [{ 'attachments.uploadId': upload._id }, { 'attachments.url': url }] }, 'courseId lessonId').lean();
        if (assignment) {
          const course = await Course.findById(assignment.courseId);
          if (course && req.user.role === 'curator') {
            const assignedStudents = await User.find({ curatorId: req.user._id, role: 'student', assignedCourses: course._id }, '_id').lean();
            allowed = assignedStudents.length > 0;
          } else if (course) {
            allowed = canReadCourse(req.user, course);
            if (allowed && req.user.role === 'student' && assignment.lessonId) allowed = await studentCanOpenLesson(course._id, assignment.lessonId, req.user._id);
          }
        }
        if (!allowed) {
          const submission = await HomeworkSubmission.findOne({ $or: [{ 'attachments.uploadId': upload._id }, { 'attachments.url': url }] }, 'studentId').lean();
          if (submission && req.user.role === 'curator') allowed = !!await User.exists({ _id: submission.studentId, curatorId: req.user._id, role: 'student' });
          else if (submission && req.user.role === 'admin') allowed = true;
        }
      }
    }
    if (!allowed) {
      const lessons = await Lesson.find({ 'blocks.content': url }, '_id').lean();
      for (const lesson of lessons) {
        const resource = await courseForLesson(lesson._id);
        const course = resource && await Course.findById(resource.courseId);
        if (course && canReadCourse(req.user, course)) {
          allowed = req.user.role !== 'student' || await studentCanOpenLesson(course._id, lesson._id, req.user._id);
          if (allowed) break;
        }
      }
    }
  }
  if (!allowed) return res.status(404).end();
  res.sendFile(path.join(uploadDir, filename));
});
app.use('/api/auth', authRoutes);
app.use('/api', api);
app.use('/api', peopleRoutes);
app.get('/healthz', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ ok: mongoose.connection.readyState === 1 }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'API-маршрут не найден' }));
app.use(express.static(clientDist, { index: false }));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/uploads/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), error => { if (error) next(error); });
});
app.use((error, _req, res, _next) => {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) return res.status(400).json({ error: error.message });
  if (error.code === 11000) return res.status(409).json({ error: 'Такой email уже зарегистрирован' });
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл слишком большой (максимум 100 МБ)' });
  console.error(error);
  res.status(500).json({ error: 'Ошибка сервера' });
});

async function seed() {
  if (await Course.exists({})) return;
  const course = await Course.create({ title: 'Основы ИИ для учителей', description: 'Научитесь использовать ИИ в повседневной работе.', cover: '' });
  const week = await Week.create({ courseId: course.id, title: 'Неделя 1', description: 'Первые шаги в мире ИИ', order: 0 });
  const day1 = await Day.create({ weekId: week.id, title: 'День 1', description: 'Введение в ИИ', order: 0 });
  await Day.create({ weekId: week.id, title: 'День 2', description: 'ИИ в работе учителя', order: 1 });
  await Lesson.create({ dayId: day1.id, title: 'Что такое ИИ', content: 'Разберёмся, как искусственный интеллект помогает учителю каждый день.', order: 0, blocks: [
    { id: 'demo-text', type: 'text', content: 'Искусственный интеллект — это помощник, который умеет работать с текстом, изображениями и идеями. Он может предложить план урока, объяснить сложную тему или помочь придумать задания.', order: 0, metadata: {} },
    { id: 'demo-heading', type: 'heading', content: 'Что вы узнаете', order: 1, metadata: {} },
    { id: 'demo-list', type: 'list', content: 'Как использовать ИИ при подготовке к уроку\nКакие задачи удобно поручить ИИ\nПочему ответ всегда стоит проверять', order: 2, metadata: {} },
    { id: 'demo-image', type: 'image', content: '/uploads/demo-lesson.png', order: 3, metadata: { alt: 'ИИ — ваш помощник', name: 'Изображение урока' } }
  ] });
  console.log('Демонстрационный курс создан');
}

await fs.mkdir(uploadDir, { recursive: true });
const demoImage = path.join(root, 'uploads', 'demo-lesson.png');
try { await fs.access(path.join(uploadDir, 'demo-lesson.png')); }
catch { try { await fs.copyFile(demoImage, path.join(uploadDir, 'demo-lesson.png')); } catch { /* demo image is optional */ } }
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace-with')) throw new Error('Укажите случайный JWT_SECRET длиной не менее 32 символов в .env');
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/course_studio');
await Course.updateMany({ moderationStatus: { $exists: false } }, { $set: { moderationStatus: 'approved' } });
await seed();
app.listen(Number(process.env.PORT) || 4000, () => console.log(`API: http://localhost:${Number(process.env.PORT) || 4000}`));
