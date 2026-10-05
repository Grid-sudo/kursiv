import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Course from '../models/Course.js';
import Week from '../models/Week.js';
import Day from '../models/Day.js';
import Lesson from '../models/Lesson.js';
import Upload from '../models/Upload.js';
import Completion from '../models/Completion.js';
import Homework from '../models/Homework.js';
import HomeworkSubmission from '../models/HomeworkSubmission.js';
import User from '../models/User.js';
import LandingContent from '../models/LandingContent.js';
import { getCourseTree, applyStudentLessonLocks, unlockedLessonIdsForStudent, studentCanOpenLesson, deleteCourseTree, deleteWeekTree, deleteDayTree } from '../controllers/courseController.js';
import { optionalAuth, requireAuth, allowRoles } from '../middleware/auth.js';
import { requireCourse, courseForResource } from '../middleware/courseAccess.js';

const router = Router();
const defaultUploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const getUploadDir = () => path.resolve(process.env.UPLOAD_DIR || defaultUploadDir);
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed', 'text/plain']);
const extension = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif'], ['video/mp4', '.mp4'], ['video/webm', '.webm'], ['application/pdf', '.pdf'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'], ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'], ['application/zip', '.zip'], ['application/x-zip-compressed', '.zip'], ['text/plain', '.txt']]);
const uploader = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadDir()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extension.get(file.mimetype) || ''}`)
  }),
  fileFilter: (_req, file, cb) => cb(null, allowed.has(file.mimetype)),
  limits: { fileSize: 100 * 1024 * 1024 }
});

const pick = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]));
const valid = id => mongoose.isValidObjectId(id);
const badId = (res, id) => !valid(id) && (res.status(400).json({ error: 'Некорректный идентификатор' }), true);
const notFound = res => res.status(404).json({ error: 'Не найдено' });

const defaultLandingContent = {
  contacts: [],
  faqs: [
    { question: 'Как получить доступ к курсу?', answer: 'Войдите в аккаунт — назначенные вам курсы появятся в кабинете. Если курса нет, обратитесь к куратору.' },
    { question: 'Кто проверяет домашние задания?', answer: 'Отправленная работа поступает куратору. Он проверит её и оставит комментарий или вернёт на доработку.' },
    { question: 'Как отправить домашнее задание?', answer: 'Откройте задание в уроке, прикрепите файл и нажмите «Отправить куратору». Статус и комментарий проверки будут видны там же.' }
  ]
};

router.get('/landing-content', async (_req, res) => {
  const content = await LandingContent.findOne({ key: 'landing' }).lean();
  res.json(content ? { contacts: content.contacts || [], faqs: content.faqs || [] } : defaultLandingContent);
});

router.put('/admin/landing-content', requireAuth, allowRoles('admin'), async (req, res) => {
  const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts.slice(0, 12).map(item => ({
    label: String(item?.label || '').trim().slice(0, 80),
    value: String(item?.value || '').trim().slice(0, 300),
    href: String(item?.href || '').trim().slice(0, 600)
  })).filter(item => item.label && item.value) : [];
  const faqs = Array.isArray(req.body?.faqs) ? req.body.faqs.slice(0, 20).map(item => ({
    question: String(item?.question || '').trim().slice(0, 300),
    answer: String(item?.answer || '').trim().slice(0, 2000)
  })).filter(item => item.question && item.answer) : [];
  for (const contact of contacts) {
    if (contact.href && !/^(https?:\/\/|mailto:|tel:)/i.test(contact.href)) return res.status(400).json({ error: 'Ссылка должна начинаться с https://, http://, mailto: или tel:.' });
  }
  const content = await LandingContent.findOneAndUpdate({ key: 'landing' }, { $set: { contacts, faqs } }, { new: true, upsert: true, runValidators: true }).lean();
  res.json({ contacts: content.contacts, faqs: content.faqs });
});

router.get('/homeworks', requireAuth, async (req, res) => {
  let query = req.user.role === 'student' ? { courseId: { $in: req.user.assignedCourses } } : req.user.role === 'teacher' ? { createdBy: req.user._id } : {};
  let targetStudent = null;
  if (req.user.role === 'curator') {
    if (req.query.studentId) {
      if (!valid(req.query.studentId)) return res.status(400).json({ error: 'Некорректный идентификатор ученика' });
      targetStudent = await User.findOne({ _id: req.query.studentId, curatorId: req.user._id, role: 'student' }, 'assignedCourses').lean();
      if (!targetStudent) return notFound(res);
      query = { courseId: { $in: targetStudent.assignedCourses || [] } };
    } else {
      const students = await User.find({ curatorId: req.user._id, role: 'student' }, 'assignedCourses').lean();
      query = { courseId: { $in: [...new Set(students.flatMap(student => student.assignedCourses.map(String)))] } };
    }
  }
  if (req.query.lessonId && valid(req.query.lessonId)) query.lessonId = req.query.lessonId;
  let items = await Homework.find(query).sort({ dueDate: 1, createdAt: -1 }).lean();
  if (req.user.role === 'teacher' && req.query.review === '1') {
    const homeworkIds = items.map(item => item._id);
    const pendingIds = await HomeworkSubmission.distinct('homeworkId', { homeworkId: { $in: homeworkIds }, submittedAt: { $ne: null }, status: 'На проверке' });
    const pendingSet = new Set(pendingIds.map(String));
    return res.json(items.filter(item => pendingSet.has(String(item._id))));
  }
  if (req.user.role === 'student') {
    const unlocked = new Set();
    for (const courseId of new Set(items.map(item => String(item.courseId)))) {
      const tree = await getCourseTree(courseId);
      if (tree) for (const lessonId of await unlockedLessonIdsForStudent(tree, req.user._id)) unlocked.add(String(lessonId));
    }
    items = items.filter(item => !item.lessonId || unlocked.has(String(item.lessonId)));
  }
  if (targetStudent) {
    const submissions = await HomeworkSubmission.find({ studentId: targetStudent._id, homeworkId: { $in: items.map(item => item._id) }, submittedAt: { $ne: null } }).populate('studentId', 'firstName lastName email').lean();
    return res.json(items.map(item => ({ ...item, submission: submissions.find(entry => String(entry.homeworkId) === String(item._id)) || null })).filter(item => item.submission));
  }
  if (req.user.role !== 'student') return res.json(items);
  const submissions = await HomeworkSubmission.find({ studentId: req.user._id, homeworkId: { $in: items.map(item => item._id) } }).lean();
  return res.json(items.map(item => ({ ...item, submission: submissions.find(entry => String(entry.homeworkId) === String(item._id)) || null })));
});
router.get('/homeworks/unread-count', requireAuth, allowRoles('curator'), async (req, res) => {
  const students = await User.find({ curatorId: req.user._id, role: 'student' }, '_id').lean();
  const count = await HomeworkSubmission.countDocuments({ studentId: { $in: students.map(student => student._id) }, submittedAt: { $ne: null }, curatorViewedAt: null });
  res.json({ count });
});
router.post('/homeworks', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const { title, description = '', courseId, lessonId, dueDate, attachments = [] } = req.body || {};
  if (!title?.trim() || !valid(courseId) || !await Course.exists({ _id: courseId })) return res.status(400).json({ error: 'Укажите название и курс.' });
  if (req.user.role === 'teacher' && !await Course.exists({ _id: courseId, createdBy: req.user._id })) return res.status(403).json({ error: 'Недостаточно прав' });
  if (lessonId) {
    if (!valid(lessonId) || !await Lesson.exists({ _id: lessonId })) return res.status(400).json({ error: 'Урок не найден.' });
    const parent = await courseForResource('lesson', lessonId);
    if (!parent || String(parent._id) !== String(courseId)) return res.status(400).json({ error: 'Выберите урок из указанного курса.' });
    const linkedLesson = await Lesson.findById(lessonId, 'hasHomework').lean();
    if (!linkedLesson?.hasHomework) return res.status(400).json({ error: 'Сначала включите домашнее задание в настройках урока.' });
  }
  const item = await Homework.create({ title: title.trim(), description, courseId, lessonId: valid(lessonId) ? lessonId : null, dueDate: dueDate || null, attachments, createdBy: req.user._id });
  res.status(201).json(item);
});
router.put('/homeworks/:id/submission', requireAuth, allowRoles('student'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const homework = await Homework.findById(req.params.id);
  if (!homework || !req.user.assignedCourses.some(id => String(id) === String(homework.courseId))) return notFound(res);
  if (homework.lessonId && !await studentCanOpenLesson(homework.courseId, homework.lessonId, req.user._id)) return res.status(423).json({ error: 'Это домашнее задание откроется после предыдущего урока.' });
  const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  const uploadIds = attachments.map(file => file.uploadId).filter(Boolean);
  if (uploadIds.length && await Upload.countDocuments({ _id: { $in: uploadIds }, ownerId: req.user._id }) !== new Set(uploadIds.map(String)).size) return res.status(403).json({ error: 'Один из файлов недоступен. Прикрепите его ещё раз.' });
  const isDraft = req.body.mode === 'draft' || req.body.status === 'Выполняется';
  const existing = await HomeworkSubmission.findOne({ homeworkId: homework._id, studentId: req.user._id });
  if (existing && ['На проверке', 'Принято'].includes(existing.status)) return res.status(409).json({ error: 'Эта работа уже отправлена или проверена.' });
  const values = { attachments, studentComment: String(req.body.studentComment || '').slice(0, 3000), status: isDraft ? (existing?.status === 'Нужно исправить' ? 'Нужно исправить' : 'Выполняется') : 'На проверке' };
  if (isDraft) values.submittedAt = null;
  else { values.submittedAt = new Date(); values.curatorViewedAt = null; if (existing?.status === 'Нужно исправить') values.comment = ''; }
  const submission = await HomeworkSubmission.findOneAndUpdate({ homeworkId: homework._id, studentId: req.user._id }, { $set: values }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  res.json(submission);
});
router.get('/homeworks/:id/submissions', requireAuth, allowRoles('admin', 'curator', 'teacher'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const homework = await Homework.findById(req.params.id);
  if (!homework) return notFound(res);
  if (req.user.role === 'teacher' && String(homework.createdBy) !== String(req.user._id)) return res.status(403).json({ error: 'Недостаточно прав' });
  let students = {};
  if (req.user.role === 'curator') students = Object.fromEntries((await User.find({ curatorId: req.user._id, role: 'student' }, '_id')).map(s => [String(s._id), true]));
  const rows = await HomeworkSubmission.find({ homeworkId: homework._id }).populate('studentId', 'firstName lastName email').lean();
  const visibleRows = rows.filter(row => req.user.role !== 'curator' || students[String(row.studentId?._id)]);
  res.json(visibleRows);
});
router.patch('/homeworks/:id/submissions/:submissionId/read', requireAuth, allowRoles('curator'), async (req, res) => {
  if (badId(res, req.params.id) || badId(res, req.params.submissionId)) return;
  const homework = await Homework.findById(req.params.id);
  if (!homework) return notFound(res);
  const submission = await HomeworkSubmission.findOne({ _id: req.params.submissionId, homeworkId: homework._id });
  if (!submission || !await User.exists({ _id: submission.studentId, curatorId: req.user._id, role: 'student' })) return res.status(403).json({ error: 'Недостаточно прав' });
  submission.curatorViewedAt = new Date();
  await submission.save();
  res.json({ ok: true });
});
router.patch('/homeworks/:id/submissions/:submissionId', requireAuth, allowRoles('admin', 'curator', 'teacher'), async (req, res) => {
  if (badId(res, req.params.id) || badId(res, req.params.submissionId)) return;
  const homework = await Homework.findById(req.params.id);
  if (!homework || (req.user.role === 'teacher' && String(homework.createdBy) !== String(req.user._id))) return notFound(res);
  const filter = { _id: req.params.submissionId, homeworkId: homework._id };
  if (req.user.role === 'curator') {
    const submissionOwner = await HomeworkSubmission.findOne(filter, 'studentId');
    if (!submissionOwner || !await User.exists({ _id: submissionOwner.studentId, curatorId: req.user._id, role: 'student' })) return res.status(403).json({ error: 'Недостаточно прав' });
  }
  const submission = await HomeworkSubmission.findOneAndUpdate(filter, { $set: pick(req.body, ['status', 'comment']) }, { new: true, runValidators: true }).populate('studentId', 'firstName lastName email');
  return submission ? res.json(submission) : notFound(res);
});

router.get('/courses', optionalAuth, async (req, res) => {
  let filter;
  if (req.user?.role === 'admin') filter = {};
  else if (req.user?.role === 'teacher') filter = { $or: [{ createdBy: req.user._id }, { moderationStatus: 'approved' }] };
  else {
    filter = { moderationStatus: 'approved' };
    if (req.user?.role === 'student') filter._id = { $in: req.user.assignedCourses };
  }
  res.json(await Course.find(filter).sort({ updatedAt: -1 }).lean());
});
router.post('/courses', requireAuth, allowRoles('admin', 'teacher'), async (req, res) => {
  const course = await Course.create({ ...pick(req.body, ['title', 'description', 'cover']), createdBy: req.user._id, moderationStatus: req.user.role === 'admin' ? 'approved' : 'pending', moderationSubmittedAt: req.user.role === 'teacher' ? new Date() : null });
  res.status(201).json(course);
});
router.post('/courses/:id/duplicate', requireAuth, allowRoles('admin', 'teacher'), requireCourse('course', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const source = await getCourseTree(req.params.id);
  if (!source) return notFound(res);
  const duplicate = await Course.create({ title: `${source.title} — копия`, description: source.description, cover: source.cover, coverSettings: source.coverSettings, createdBy: req.user._id, moderationStatus: req.user.role === 'admin' ? 'approved' : 'pending', moderationSubmittedAt: req.user.role === 'teacher' ? new Date() : null });
  const homeworkItems = await Homework.find({ courseId: source._id }).lean();
  const lessonMap = new Map();
  try {
    for (const week of source.weeks) {
      const newWeek = await Week.create({ courseId: duplicate._id, title: week.title, description: week.description, order: week.order });
      for (const day of week.days) {
        const newDay = await Day.create({ weekId: newWeek._id, title: day.title, description: day.description, order: day.order });
        for (const lesson of day.lessons) {
          const newLesson = await Lesson.create({ dayId: newDay._id, title: lesson.title, content: lesson.content, blocks: lesson.blocks, hasHomework: lesson.hasHomework, order: lesson.order });
          lessonMap.set(String(lesson._id), newLesson._id);
        }
      }
    }
    for (const item of homeworkItems) {
      const lessonId = item.lessonId ? lessonMap.get(String(item.lessonId)) : null;
      if (item.lessonId && !lessonId) continue;
      await Homework.create({ title: item.title, description: item.description, courseId: duplicate._id, lessonId, createdBy: req.user._id, attachments: item.attachments });
    }
  } catch (error) {
    await deleteCourseTree(duplicate._id);
    throw error;
  }
  res.status(201).json(await getCourseTree(duplicate._id));
});
router.get('/admin/courses/pending', requireAuth, allowRoles('admin'), async (_req, res) => {
  res.json(await Course.find({ moderationStatus: 'pending' }).populate('createdBy', 'firstName lastName email').sort({ moderationSubmittedAt: 1, createdAt: 1 }).lean());
});
router.patch('/admin/courses/:id/approval', requireAuth, allowRoles('admin'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const { decision } = req.body || {};
  if (!['approve', 'changes_requested'].includes(decision)) return res.status(400).json({ error: 'Выберите решение по курсу.' });
  const course = await Course.findById(req.params.id);
  if (!course) return notFound(res);
  if (course.moderationStatus !== 'pending') return res.status(409).json({ error: 'Этот курс уже рассмотрен.' });
  const comment = String(req.body.comment || '').trim().slice(0, 1000);
  if (decision === 'changes_requested' && !comment) return res.status(400).json({ error: 'Добавьте комментарий с необходимыми правками.' });
  course.moderationStatus = decision === 'approve' ? 'approved' : 'changes_requested';
  course.moderationComment = decision === 'approve' ? '' : comment;
  course.moderationReviewedAt = new Date();
  course.moderationReviewedBy = req.user._id;
  await course.save();
  res.json(course);
});
router.post('/courses/:id/submit-review', requireAuth, allowRoles('teacher'), requireCourse('course', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const course = req.course;
  if (course.moderationStatus !== 'changes_requested') return res.status(409).json({ error: 'Отправить на проверку можно после внесения запрошенных правок.' });
  course.moderationStatus = 'pending';
  course.moderationComment = '';
  course.moderationSubmittedAt = new Date();
  course.moderationReviewedAt = null;
  course.moderationReviewedBy = null;
  await course.save();
  res.json(course);
});
router.get('/courses/:id', requireAuth, requireCourse('course', 'read'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const course = await getCourseTree(req.params.id);
  return course ? res.json(await applyStudentLessonLocks(course, req.user)) : notFound(res);
});
router.put('/courses/:id', requireAuth, requireCourse('course', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const course = await Course.findByIdAndUpdate(req.params.id, pick(req.body, ['title', 'description', 'cover', 'coverSettings']), { new: true, runValidators: true });
  return course ? res.json(course) : notFound(res);
});
router.delete('/courses/:id', requireAuth, requireCourse('course', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const course = await deleteCourseTree(req.params.id);
  return course ? res.json({ ok: true }) : notFound(res);
});

router.post('/weeks', requireAuth, requireCourse('course', 'edit'), async (req, res) => {
  if (badId(res, req.body.courseId)) return;
  if (!await Course.exists({ _id: req.body.courseId })) return notFound(res);
  const week = await Week.create({ ...pick(req.body, ['courseId', 'title', 'description']), order: req.body.order ?? await Week.countDocuments({ courseId: req.body.courseId }) });
  res.status(201).json(week);
});
router.put('/weeks/:id', requireAuth, requireCourse('week', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const week = await Week.findByIdAndUpdate(req.params.id, pick(req.body, ['title', 'description', 'order']), { new: true, runValidators: true });
  return week ? res.json(week) : notFound(res);
});
router.delete('/weeks/:id', requireAuth, requireCourse('week', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const week = await deleteWeekTree(req.params.id);
  return week ? res.json({ ok: true }) : notFound(res);
});

router.post('/days', requireAuth, requireCourse('week', 'edit'), async (req, res) => {
  if (badId(res, req.body.weekId)) return;
  if (!await Week.exists({ _id: req.body.weekId })) return notFound(res);
  const day = await Day.create({ ...pick(req.body, ['weekId', 'title', 'description']), order: req.body.order ?? await Day.countDocuments({ weekId: req.body.weekId }) });
  res.status(201).json(day);
});
router.put('/days/:id', requireAuth, requireCourse('day', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const day = await Day.findByIdAndUpdate(req.params.id, pick(req.body, ['title', 'description', 'order']), { new: true, runValidators: true });
  return day ? res.json(day) : notFound(res);
});
router.delete('/days/:id', requireAuth, requireCourse('day', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const day = await deleteDayTree(req.params.id);
  return day ? res.json({ ok: true }) : notFound(res);
});

router.post('/lessons', requireAuth, requireCourse('day', 'edit'), async (req, res) => {
  if (badId(res, req.body.dayId)) return;
  if (!await Day.exists({ _id: req.body.dayId })) return notFound(res);
  const lesson = await Lesson.create({ ...pick(req.body, ['dayId', 'title', 'content', 'blocks']), order: req.body.order ?? await Lesson.countDocuments({ dayId: req.body.dayId }) });
  res.status(201).json(lesson);
});
router.get('/lessons/:id', requireAuth, requireCourse('lesson', 'read'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  if (req.user.role === 'student' && !await studentCanOpenLesson(req.course._id, req.params.id, req.user._id)) return res.status(423).json({ error: 'Сначала завершите предыдущий урок курса.' });
  const lesson = await Lesson.findById(req.params.id).lean();
  return lesson ? res.json(lesson) : notFound(res);
});
router.put('/lessons/:id', requireAuth, requireCourse('lesson', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const lesson = await Lesson.findByIdAndUpdate(req.params.id, pick(req.body, ['title', 'content', 'blocks', 'order', 'hasHomework']), { new: true, runValidators: true });
  return lesson ? res.json(lesson) : notFound(res);
});
router.delete('/lessons/:id', requireAuth, requireCourse('lesson', 'edit'), async (req, res) => {
  if (badId(res, req.params.id)) return;
  const lesson = await Lesson.findByIdAndDelete(req.params.id);
  if (lesson) {
    await Completion.deleteMany({ lessonId: lesson._id });
    const homeworkItems = await Homework.find({ lessonId: lesson._id }, '_id').lean();
    await HomeworkSubmission.deleteMany({ homeworkId: { $in: homeworkItems.map(item => item._id) } });
    await Homework.deleteMany({ lessonId: lesson._id });
  }
  return lesson ? res.json({ ok: true }) : notFound(res);
});

router.post('/upload', requireAuth, uploader.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Выберите JPG, PNG, WebP, GIF, MP4, WebM, PDF или DOCX' });
  const item = await Upload.create({ filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, ownerId: req.user._id });
  res.status(201).json({ id: item.id, url: `/uploads/${item.filename}`, name: item.originalName, mimeType: item.mimeType, size: item.size });
});
router.delete('/upload/:id', requireAuth, async (req, res) => {
  if (badId(res, req.params.id)) return;
  const item = await Upload.findById(req.params.id);
  if (!item) return notFound(res);
  if (req.user.role !== 'admin' && String(item.ownerId) !== String(req.user._id)) return res.status(403).json({ error: 'Недостаточно прав' });
  await item.deleteOne();
  await fs.rm(path.join(getUploadDir(), item.filename), { force: true });
  res.json({ ok: true });
});

export default router;
