import { ArrowLeft, ClipboardList } from 'lucide-react';
import LessonHomework from './LessonHomework';
import { route } from '../services/navigation';

export default function LessonHomeworkPage({ lesson, course, week, day, user, author, navigate }) {
  return <main className="lesson-homework-page"><div className="lesson-homework-page-inner">
    <button className="back-link" onClick={() => navigate(route(course._id, week._id, day._id, lesson._id))}><ArrowLeft size={18}/> Вернуться к уроку</button>
    <div className="lesson-homework-page-heading"><span className="eyebrow muted"><ClipboardList size={16}/> {course.title} · {week.title} · {day.title}</span><h1>Домашнее задание</h1><p>{lesson.title}</p></div>
    {lesson.hasHomework ? <LessonHomework lesson={lesson} course={course} user={user} author={author}/> : <section className="lesson-homework"><h2>Для этого урока домашнее задание не задано</h2><p>Вернитесь к уроку, чтобы продолжить обучение.</p></section>}
  </div></main>;
}
