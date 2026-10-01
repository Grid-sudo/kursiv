import Course from '../models/Course.js';
import Week from '../models/Week.js';
import Day from '../models/Day.js';
import Lesson from '../models/Lesson.js';
import User from '../models/User.js';
import Completion from '../models/Completion.js';
import Homework from '../models/Homework.js';
import HomeworkSubmission from '../models/HomeworkSubmission.js';

async function deleteHomework(query) {
  const homework = await Homework.find(query, '_id').lean();
  const ids = homework.map(item => item._id);
  if (!ids.length) return;
  await HomeworkSubmission.deleteMany({ homeworkId: { $in: ids } });
  await Homework.deleteMany({ _id: { $in: ids } });
}

export async function getCourseTree(id) {
  const course = await Course.findById(id).lean();
  if (!course) return null;
  const weeks = await Week.find({ courseId: id }).sort({ order: 1, createdAt: 1 }).lean();
  const days = await Day.find({ weekId: { $in: weeks.map(week => week._id) } }).sort({ order: 1, createdAt: 1 }).lean();
  const lessons = await Lesson.find({ dayId: { $in: days.map(day => day._id) } }, 'dayId title order updatedAt').sort({ order: 1, createdAt: 1 }).lean();
  return {
    ...course,
    weeks: weeks.map(week => ({
      ...week,
      days: days.filter(day => String(day.weekId) === String(week._id)).map(day => ({
        ...day,
        lessons: lessons.filter(lesson => String(lesson.dayId) === String(day._id))
      }))
    }))
  };
}

export async function deleteCourseTree(id) {
  await deleteHomework({ courseId: id });
  const weeks = await Week.find({ courseId: id }, '_id').lean();
  const weekIds = weeks.map(item => item._id);
  const days = await Day.find({ weekId: { $in: weekIds } }, '_id').lean();
  const lessons = await Lesson.find({ dayId: { $in: days.map(item => item._id) } }, '_id').lean();
  await Completion.deleteMany({ lessonId: { $in: lessons.map(item => item._id) } });
  await User.updateMany({ assignedCourses: id }, { $pull: { assignedCourses: id } });
  await Lesson.deleteMany({ dayId: { $in: days.map(item => item._id) } });
  await Day.deleteMany({ weekId: { $in: weekIds } });
  await Week.deleteMany({ courseId: id });
  return Course.findByIdAndDelete(id);
}

export async function deleteWeekTree(id) {
  const days = await Day.find({ weekId: id }, '_id').lean();
  const lessons = await Lesson.find({ dayId: { $in: days.map(item => item._id) } }, '_id').lean();
  await deleteHomework({ lessonId: { $in: lessons.map(item => item._id) } });
  await Completion.deleteMany({ lessonId: { $in: lessons.map(item => item._id) } });
  await Lesson.deleteMany({ dayId: { $in: days.map(item => item._id) } });
  await Day.deleteMany({ weekId: id });
  return Week.findByIdAndDelete(id);
}

export async function deleteDayTree(id) {
  const lessons = await Lesson.find({ dayId: id }, '_id').lean();
  await deleteHomework({ lessonId: { $in: lessons.map(item => item._id) } });
  await Completion.deleteMany({ lessonId: { $in: lessons.map(item => item._id) } });
  await Lesson.deleteMany({ dayId: id });
  return Day.findByIdAndDelete(id);
}
