import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Week from '../models/Week.js';
import Day from '../models/Day.js';
import Lesson from '../models/Lesson.js';
import Completion from '../models/Completion.js';
import Homework from '../models/Homework.js';
import HomeworkSubmission from '../models/HomeworkSubmission.js';
import { requireAuth, allowRoles, publicUser } from '../middleware/auth.js';
import { courseForLesson, progressForUser } from '../controllers/progressController.js';
import { studentCanOpenLesson } from '../controllers/courseController.js';

const router = Router();
const roles = ['admin', 'curator', 'teacher', 'student'];
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
const invalid = id => !mongoose.isValidObjectId(id);

async function makeUser(data, defaultRole, curatorId = null) {
  const { firstName, lastName, email, password } = data || {};
  if (!firstName?.trim() || !lastName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) || !password || password.length < 10) {
    const error = new Error('Укажите имя, фамилию, email и пароль не короче 10 символов'); error.status = 400; throw error;
  }
  const role = defaultRole || data.role;
  if (!roles.includes(role)) { const error = new Error('Некорректная роль'); error.status = 400; throw error; }
  const chosenCurator = defaultRole ? curatorId : (data.curatorId || null);
  if (chosenCurator && (invalid(chosenCurator) || !await User.exists({ _id: chosenCurator, role: 'curator' }))) { const error = new Error('Куратор не найден'); error.status = 400; throw error; }
  const courseIds = data.assignedCourses || [];
  if (!Array.isArray(courseIds) || courseIds.some(invalid) || await Course.countDocuments({ _id: { $in: courseIds }, $or: [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }] }) !== new Set(courseIds).size) { const error = new Error('Назначать можно только одобренные курсы'); error.status = 400; throw error; }
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) { const error = new Error('Пользователь с таким email уже зарегистрирован.'); error.status = 409; throw error; }
  return User.create({ firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role, curatorId: chosenCurator, assignedCourses: role === 'student' ? courseIds : [] });
}

router.put('/profile', requireAuth, async (req, res) => {
  const changes = pick(req.body, ['firstName', 'lastName', 'email', 'bio', 'avatar', 'portfolioUrl', 'linkedinUrl']);
  if (changes.email) changes.email = changes.email.trim().toLowerCase();
  if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) return res.status(400).json({ error: 'Введите корректный адрес электронной почты.' });
  if (changes.email && await User.exists({ email: changes.email, _id: { $ne: req.user._id } })) return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован.' });
  for (const field of ['portfolioUrl', 'linkedinUrl']) {
    if (changes[field] === undefined) continue;
    changes[field] = String(changes[field]).trim();
    if (changes[field].length > 500) return res.status(400).json({ error: 'Ссылка не должна быть длиннее 500 символов.' });
    if (!changes[field]) continue;
    try {
      const url = new URL(changes[field]);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Недопустимая схема ссылки');
      changes[field] = url.href;
    } catch {
      return res.status(400).json({ error: 'Укажите полный адрес ссылки, начинающийся с https://.' });
    }
  }
  const user = await User.findByIdAndUpdate(req.user._id, changes, { new: true, runValidators: true });
  res.json(publicUser(user));
});

router.get('/profile/curator', requireAuth, allowRoles('student'), async (req, res) => {
  if (!req.user.curatorId) return res.json({ curator: null });
  const curator = await User.findOne({ _id: req.user.curatorId, role: 'curator' })
    .select('firstName lastName email phone avatar role bio portfolioUrl linkedinUrl')
    .lean();
  res.json({ curator: curator || null });
});

router.get('/progress/me', requireAuth, async (req, res) => res.json(await progressForUser(req.user)));
router.get('/progress/users/:id', requireAuth, async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (req.user.role !== 'admin' && !(req.user.role === 'curator' && String(user.curatorId) === String(req.user._id))) return res.status(403).json({ error: 'Недостаточно прав' });
  res.json({ user: publicUser(user), progress: await progressForUser(user) });
});
router.post('/progress/lessons/:id/complete', requireAuth, allowRoles('student'), async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const resource = await courseForLesson(req.params.id);
  if (!resource) return res.status(404).json({ error: 'Урок не найден' });
  if (!req.user.assignedCourses.some(id => String(id) === String(resource.courseId))) return res.status(403).json({ error: 'Курс не назначен' });
  if (!await studentCanOpenLesson(resource.courseId, req.params.id, req.user._id)) return res.status(423).json({ error: 'Сначала завершите предыдущий урок курса.' });
  await Completion.updateOne({ userId: req.user._id, lessonId: req.params.id }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true });
  res.json(await progressForUser(req.user));
});
router.delete('/progress/lessons/:id/complete', requireAuth, allowRoles('student'), async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const resource = await courseForLesson(req.params.id);
  if (!resource || !req.user.assignedCourses.some(id => String(id) === String(resource.courseId))) return res.status(403).json({ error: 'Нет доступа к уроку' });
  await Completion.deleteOne({ userId: req.user._id, lessonId: req.params.id });
  res.json(await progressForUser(req.user));
});

router.get('/curator/students', requireAuth, allowRoles('curator'), async (req, res) => {
  const students = await User.find({ role: 'student', curatorId: req.user._id }).sort({ createdAt: -1 });
  const courseIds = [...new Set(students.flatMap(student => (student.assignedCourses || []).map(String)))];
  const homeworks = courseIds.length ? await Homework.find({ courseId: { $in: courseIds } }, '_id courseId title dueDate').lean() : [];
  const submissions = homeworks.length && students.length ? await HomeworkSubmission.find({ studentId: { $in: students.map(student => student._id) }, homeworkId: { $in: homeworks.map(item => item._id) } }, 'studentId homeworkId status submittedAt curatorViewedAt').lean() : [];
  const progressItems = await Promise.all(students.map(progressForUser));
  res.json(students.map((student, index) => {
    const studentCourseIds = new Set((student.assignedCourses || []).map(String));
    const studentHomeworkIds = new Set(homeworks.filter(item => studentCourseIds.has(String(item.courseId))).map(item => String(item._id)));
    const studentSubmissions = submissions.filter(item => String(item.studentId) === String(student._id) && studentHomeworkIds.has(String(item.homeworkId)));
    const assignedHomeworkCount = studentHomeworkIds.size;
    return {
      ...publicUser(student),
      progress: progressItems[index],
      homeworkSummary: {
        assigned: assignedHomeworkCount,
        submitted: studentSubmissions.filter(item => item.submittedAt).length,
        pending: studentSubmissions.filter(item => item.status === 'На проверке' && item.submittedAt).length,
        unread: studentSubmissions.filter(item => item.submittedAt && !item.curatorViewedAt).length,
        revision: studentSubmissions.filter(item => item.status === 'Нужно исправить').length
      }
    };
  }));
});
router.post('/curator/students', requireAuth, allowRoles('curator'), async (req, res) => {
  const student = await makeUser(req.body, 'student', req.user._id);
  res.status(201).json(publicUser(student));
});
router.get('/curator/students/:id', requireAuth, allowRoles('curator'), async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const student = await User.findOne({ _id: req.params.id, curatorId: req.user._id, role: 'student' });
  return student ? res.json({ user: publicUser(student), progress: await progressForUser(student) }) : res.status(404).json({ error: 'Ученик не найден' });
});
router.put('/curator/students/:id/courses', requireAuth, allowRoles('curator'), async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const student = await User.findOne({ _id: req.params.id, curatorId: req.user._id, role: 'student' });
  if (!student) return res.status(404).json({ error: 'Ученик не найден' });
  if (!Array.isArray(req.body?.courseIds)) return res.status(400).json({ error: 'Некорректный список курсов' });
  const ids = [...new Set(req.body.courseIds)];
  if (ids.some(invalid) || await Course.countDocuments({ _id: { $in: ids }, $or: [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }] }) !== ids.length) return res.status(400).json({ error: 'Назначать можно только одобренные курсы' });
  student.assignedCourses = ids;
  await student.save();
  res.json({ user: publicUser(student), progress: await progressForUser(student) });
});

router.get('/admin/users', requireAuth, allowRoles('admin'), async (_req, res) => res.json((await User.find().sort({ createdAt: -1 })).map(publicUser)));
router.post('/admin/users', requireAuth, allowRoles('admin'), async (req, res) => {
  const user = await makeUser(req.body);
  res.status(201).json(publicUser(user));
});
router.put('/admin/users/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const changes = pick(req.body, ['firstName', 'lastName', 'email', 'phone', 'bio', 'avatar', 'role', 'curatorId', 'assignedCourses']);
  if (changes.role && !roles.includes(changes.role)) return res.status(400).json({ error: 'Некорректная роль' });
  if (user.role === 'admin' && changes.role && changes.role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) return res.status(400).json({ error: 'Нельзя убрать последнего администратора' });
  if (changes.curatorId === '') changes.curatorId = null;
  if (changes.curatorId && (invalid(changes.curatorId) || !await User.exists({ _id: changes.curatorId, role: 'curator' }))) return res.status(400).json({ error: 'Куратор не найден' });
  if (changes.assignedCourses && (!Array.isArray(changes.assignedCourses) || changes.assignedCourses.some(invalid) || await Course.countDocuments({ _id: { $in: changes.assignedCourses }, $or: [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }] }) !== new Set(changes.assignedCourses).size)) return res.status(400).json({ error: 'Назначать можно только одобренные курсы' });
  if (changes.email) changes.email = changes.email.trim().toLowerCase();
  if (changes.role && changes.role !== 'student') { changes.curatorId = null; changes.assignedCourses = []; }
  Object.assign(user, changes);
  if (req.body.password) {
    if (req.body.password.length < 10) return res.status(400).json({ error: 'Пароль должен быть не короче 10 символов' });
    user.passwordHash = await bcrypt.hash(req.body.password, 12);
    user.tokenVersion += 1;
  }
  await user.save();
  res.json(publicUser(user));
});
router.delete('/admin/users/:id', requireAuth, allowRoles('admin'), async (req, res) => {
  if (invalid(req.params.id)) return res.status(400).json({ error: 'Некорректный идентификатор' });
  if (String(req.user._id) === req.params.id) return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.role === 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
  await Completion.deleteMany({ userId: user._id });
  await User.updateMany({ curatorId: user._id }, { curatorId: null });
  await user.deleteOne();
  res.json({ ok: true });
});
router.get('/admin/stats', requireAuth, allowRoles('admin'), async (_req, res) => {
  const users = await User.find();
  const students = users.filter(user => user.role === 'student');
  const progress = await Promise.all(students.map(progressForUser));
  const enrolled = progress.filter(item => item.totalLessons > 0);
  res.json({ users: users.length, students: students.length, teachers: users.filter(item => item.role === 'teacher').length, curators: users.filter(item => item.role === 'curator').length, courses: await Course.countDocuments(), averageProgress: enrolled.length ? Math.round(enrolled.reduce((sum, item) => sum + item.percent, 0) / enrolled.length) : 0 });
});
router.get('/admin/progress', requireAuth, allowRoles('admin'), async (_req, res) => {
  const students = await User.find({ role: 'student' }).sort({ createdAt: -1 });
  res.json(await Promise.all(students.map(async user => ({ user: publicUser(user), progress: await progressForUser(user) }))));
});
router.get('/dashboard', requireAuth, async (req, res) => {
  if (req.user.role === 'student') return res.json({ role: 'student', progress: await progressForUser(req.user) });
  if (req.user.role === 'curator') {
    const students = await User.find({ curatorId: req.user._id, role: 'student' });
    return res.json({ role: 'curator', students: students.length, averageProgress: students.length ? Math.round((await Promise.all(students.map(progressForUser))).reduce((sum, item) => sum + item.percent, 0) / students.length) : 0 });
  }
  if (req.user.role === 'teacher') {
    const courses = await Course.find({ createdBy: req.user._id }).sort({ updatedAt: -1 }).lean();
    const courseIds = courses.map(item => item._id);
    const weeks = await Week.find({ courseId: { $in: courseIds } }).sort({ order: 1, createdAt: 1 }).lean();
    const weekIds = weeks.map(item => item._id);
    const days = await Day.find({ weekId: { $in: weekIds } }).sort({ order: 1, createdAt: 1 }).lean();
    const dayIds = days.map(item => item._id);
    const lessons = await Lesson.find({ dayId: { $in: dayIds } }, '_id dayId title order updatedAt').sort({ order: 1, createdAt: 1 }).lean();
    const courseByWeek = new Map(weeks.map(week => [String(week._id), String(week.courseId)]));
    const weekByDay = new Map(days.map(day => [String(day._id), String(day.weekId)]));
    const courseByLesson = new Map(lessons.map(lesson => [String(lesson._id), courseByWeek.get(weekByDay.get(String(lesson.dayId)))]));
    const daysByWeek = new Map(weeks.map(week => [String(week._id), days.filter(day => String(day.weekId) === String(week._id))]));
    const lessonsByDay = new Map(days.map(day => [String(day._id), lessons.filter(lesson => String(lesson.dayId) === String(day._id))]));
    const orderedLessonsByCourse = new Map(courses.map(course => [String(course._id), weeks.filter(week => String(week.courseId) === String(course._id)).flatMap(week => (daysByWeek.get(String(week._id)) || []).flatMap(day => lessonsByDay.get(String(day._id)) || []))]));
    const courseUpdatedAt = Object.fromEntries(courses.map(course => {
      const relatedWeekIds = new Set(weeks.filter(week => String(week.courseId) === String(course._id)).map(week => String(week._id)));
      const relatedDayIds = new Set(days.filter(day => relatedWeekIds.has(String(day.weekId))).map(day => String(day._id)));
      const dates = [course.updatedAt, ...weeks.filter(week => relatedWeekIds.has(String(week._id))).map(week => week.updatedAt), ...days.filter(day => relatedDayIds.has(String(day._id))).map(day => day.updatedAt), ...lessons.filter(lesson => relatedDayIds.has(String(lesson.dayId))).map(lesson => lesson.updatedAt)];
      return [String(course._id), dates.filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || course.updatedAt];
    }));
    const students = courseIds.length ? await User.find({ role: 'student', assignedCourses: { $in: courseIds } }).sort({ lastActiveAt: -1, firstName: 1, lastName: 1 }) : [];
    const progress = await Promise.all(students.map(progressForUser));
    const teacherCourseIds = new Set(courseIds.map(String));
    const enrollments = progress.flatMap(item => item.courses.filter(course => teacherCourseIds.has(String(course.courseId))));
    const homeworkIds = await Homework.find({ courseId: { $in: courseIds } }, '_id').lean();
    const pendingSubmissions = homeworkIds.length ? await HomeworkSubmission.countDocuments({ homeworkId: { $in: homeworkIds.map(item => item._id) }, submittedAt: { $ne: null }, status: 'На проверке' }) : 0;
    const completions = students.length && lessons.length ? await Completion.find({ userId: { $in: students.map(item => item._id) }, lessonId: { $in: lessons.map(item => item._id) } }).sort({ completedAt: -1 }).populate('userId', 'firstName lastName email avatar lastActiveAt').lean() : [];
    const latestByStudent = new Map();
    const completedByStudent = new Map();
    for (const completion of completions) {
      const student = completion.userId;
      if (!student) continue;
      const studentId = String(student._id);
      if (!completedByStudent.has(studentId)) completedByStudent.set(studentId, new Set());
      completedByStudent.get(studentId).add(String(completion.lessonId));
      if (latestByStudent.has(studentId)) continue;
      const lesson = lessons.find(item => String(item._id) === String(completion.lessonId));
      const courseId = courseByLesson.get(String(completion.lessonId));
      latestByStudent.set(studentId, { student, courseId, courseTitle: courses.find(item => String(item._id) === courseId)?.title || '', lessonTitle: lesson?.title || '', completedAt: completion.completedAt });
    }
    for (const [studentId, lastLesson] of latestByStudent) {
      lastLesson.nextLessonTitle = (orderedLessonsByCourse.get(lastLesson.courseId) || []).find(item => !completedByStudent.get(studentId)?.has(String(item._id)))?.title || '';
    }
    const activity = students.map((student, index) => {
      const lastLesson = latestByStudent.get(String(student._id));
      const courseProgress = progress[index].courses.filter(item => teacherCourseIds.has(String(item.courseId)));
      return { student: publicUser(student), lastLesson: lastLesson || null, lastActiveAt: student.lastActiveAt || null, courses: courseProgress };
    }).sort((a, b) => new Date(b.lastLesson?.completedAt || b.lastActiveAt || 0) - new Date(a.lastLesson?.completedAt || a.lastActiveAt || 0));
    const homeworkUpdates = await Homework.find({ courseId: { $in: courseIds } }, 'courseId updatedAt').lean();
    for (const [courseId, timestamp] of Object.entries(courseUpdatedAt)) {
      const latestHomework = homeworkUpdates.filter(item => String(item.courseId) === courseId).reduce((latest, item) => !latest || item.updatedAt > latest ? item.updatedAt : latest, timestamp);
      courseUpdatedAt[courseId] = latestHomework;
    }
    return res.json({ role: 'teacher', courses: courses.length, lessons: lessons.length, students: students.length, averageProgress: enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + item.percent, 0) / enrollments.length) : 0, pendingSubmissions, activity, courseUpdatedAt });
  }
  return res.json({ role: 'admin', users: await User.countDocuments(), courses: await Course.countDocuments() });
});

export default router;
