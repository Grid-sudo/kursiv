import Course from '../models/Course.js';
import Week from '../models/Week.js';
import Day from '../models/Day.js';
import Lesson from '../models/Lesson.js';

export async function courseForResource(kind, id) {
  if (kind === 'course') return Course.findById(id);
  const week = kind === 'week' ? await Week.findById(id) : null;
  if (week) return Course.findById(week.courseId);
  const day = kind === 'day' ? await Day.findById(id) : kind === 'lesson' ? await Lesson.findById(id).then(lesson => lesson && Day.findById(lesson.dayId)) : null;
  if (!day) return null;
  const parentWeek = await Week.findById(day.weekId);
  return parentWeek ? Course.findById(parentWeek.courseId) : null;
}

export function canReadCourse(user, course) {
  if (!user || !course) return false;
  return user.role !== 'student' || user.assignedCourses.some(id => String(id) === String(course._id));
}

export function canEditCourse(user, course) {
  if (!user || !course) return false;
  return user.role === 'admin' || (user.role === 'teacher' && String(course.createdBy) === String(user._id));
}

export const requireCourse = (kind, action) => async (req, res, next) => {
  const id = kind === 'course' ? (req.params.id || req.body?.courseId) : kind === 'week' && req.body?.weekId ? req.body.weekId : kind === 'day' && req.body?.dayId ? req.body.dayId : req.params.id;
  try {
    const course = await courseForResource(kind, id);
    if (!course) return res.status(404).json({ error: 'Курс не найден' });
    const allowed = action === 'edit' ? canEditCourse(req.user, course) : canReadCourse(req.user, course);
    if (!allowed) return res.status(403).json({ error: 'Нет доступа к курсу' });
    req.course = course;
    next();
  } catch { res.status(400).json({ error: 'Некорректный идентификатор' }); }
};
