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
  const courses = await Course.find({ _id: { $in: courseIds } }).lean();
  const weeks = await Week.find({ courseId: { $in: courseIds } }).lean();
  const days = await Day.find({ weekId: { $in: weeks.map(item => item._id) } }).lean();
  const lessons = await Lesson.find({ dayId: { $in: days.map(item => item._id) } }, '_id dayId title order').sort({ order: 1 }).lean();
  const completed = await Completion.find({ userId: user._id, lessonId: { $in: lessons.map(item => item._id) } }).lean();
  const completedIds = new Set(completed.map(item => String(item.lessonId)));
  const dayToCourse = new Map(days.map(day => [String(day._id), String(weeks.find(week => String(week._id) === String(day.weekId))?.courseId)]));
  const result = courses.map(course => {
    const courseLessons = lessons.filter(lesson => dayToCourse.get(String(lesson.dayId)) === String(course._id));
    const done = courseLessons.filter(lesson => completedIds.has(String(lesson._id))).length;
    return { courseId: course._id, title: course.title, cover: course.cover, totalLessons: courseLessons.length, completedLessons: done, percent: courseLessons.length ? Math.round(done / courseLessons.length * 100) : 0, lessons: courseLessons.map(lesson => ({ _id: lesson._id, title: lesson.title, completed: completedIds.has(String(lesson._id)) })) };
  });
  const totalLessons = result.reduce((sum, item) => sum + item.totalLessons, 0);
  const completedLessons = result.reduce((sum, item) => sum + item.completedLessons, 0);
  return { courses: result, totalLessons, completedLessons, percent: totalLessons ? Math.round(completedLessons / totalLessons * 100) : 0, lastActivity: completed.sort((a, b) => b.completedAt - a.completedAt)[0]?.completedAt || user.lastActiveAt || null };
}
