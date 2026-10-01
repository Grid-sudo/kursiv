import { Check, Circle } from 'lucide-react';

export function ProgressBar({ percent = 0, completed = 0, total = 0 }) {
  return <div className="progress-widget"><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div><div className="progress-labels"><strong>{percent}%</strong><span>{completed} из {total} уроков</span></div></div>;
}

export function LessonChecklist({ lessons = [] }) {
  return <div className="checklist">{lessons.map((lesson, index) => <div className="checklist-row" key={lesson._id}><span className={lesson.completed ? 'is-done' : ''}>{lesson.completed ? <Check size={16} /> : <Circle size={16} />}</span><strong>{index + 1}. {lesson.title}</strong><small>{lesson.completed ? 'Пройден' : 'Ожидает'}</small></div>)}</div>;
}
