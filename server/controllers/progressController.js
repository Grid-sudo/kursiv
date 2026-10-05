import Course from '../models/Course.js';
import Week from '../models/Week.js';
import Day from '../models/Day.js';
import Lesson from '../models/Lesson.js';
import Completion from '../models/Completion.js';

export async function courseForLesson(lessonId) {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) return null;
  const day = await Day.findById(lesson.dayId).lean();
  const week = day && await Week.findById(day.weekId).lean();
  return week ? { lesson, courseId: week.courseId } : null;
}

export async function progressForUser(user) {
  const courseIds = user.assignedCourses || [];
  const courses = await Course.find({ _id: { $in: courseIds }, $or: [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }] }).lean();
  const publishedCourseIds = courses.map(course => course._id);
  const weeks = await Week.find({ courseId: { $in: publishedCourseIds } }).sort({ order: 1, createdAt: 1 }).lean();
  const days = await Day.find({ weekId: { $in: weeks.map(item => item._id) } }).sort({ order: 1, createdAt: 1 }).lean();
  const lessons = await Lesson.find({ dayId: { $in: days.map(item => item._id) } }, '_id dayId title order').sort({ order: 1, createdAt: 1 }).lean();
  const completed = await Completion.find({ userId: user._id, lessonId: { $in: lessons.map(item => item._id) } }).lean();
  const completedIds = new Set(completed.map(item => String(item.lessonId)));
  const lessonsByDay = new Map(days.map(day => [String(day._id), lessons.filter(lesson => String(lesson.dayId) === String(day._id))]));
  const daysByWeek = new Map(weeks.map(week => [String(week._id), days.filter(day => String(day.weekId) === String(week._id))]));
  const result = courses.map(course => {
    const courseLessons = weeks.filter(week => String(week.courseId) === String(course._id)).flatMap(week => (daysByWeek.get(String(week._id)) || []).flatMap(day => lessonsByDay.get(String(day._id)) || []));
    const done = courseLessons.filter(lesson => completedIds.has(String(lesson._id))).length;
    const currentLessonId = courseLessons.find(lesson => !completedIds.has(String(lesson._id)))?._id;
    return { courseId: course._id, title: course.title, cover: course.cover, totalLessons: courseLessons.length, completedLessons: done, percent: courseLessons.length ? Math.round(done / courseLessons.length * 100) : 0, lessons: courseLessons.map(lesson => ({ _id: lesson._id, title: lesson.title, completed: completedIds.has(String(lesson._id)), unlocked: completedIds.has(String(lesson._id)) || String(lesson._id) === String(currentLessonId) })) };
  });
  const totalLessons = result.reduce((sum, item) => sum + item.totalLessons, 0);
  const completedLessons = result.reduce((sum, item) => sum + item.completedLessons, 0);
  const latestCompletion = completed.reduce((latest, item) => !latest || item.completedAt > latest ? item.completedAt : latest, null);
  return { courses: result, totalLessons, completedLessons, percent: totalLessons ? Math.round(completedLessons / totalLessons * 100) : 0, lastLessonCompletedAt: latestCompletion, lastActivity: latestCompletion || user.lastActiveAt || null };
}
