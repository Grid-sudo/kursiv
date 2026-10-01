import { ArrowLeft, ArrowRight, Check, ClipboardList, RotateCcw, Sparkles, WifiOff } from 'lucide-react';
import BlockEditor from '../editor/BlockEditor';
import { useAutosave } from '../hooks/useAutosave';
import { homeworkRoute, route } from '../services/navigation';
import { remove } from '../services/api';
import LessonSidebar from './LessonSidebar';

export default function LessonPage({ initial, course, week, day, user, author, student, completed, onCompletion, navigate }) {
  const { draft, setDraft, status, retry } = useAutosave(initial);
  const update = patch => setDraft(previous => ({ ...previous, ...patch }));
  const deleteLesson = async () => {
    if (!window.confirm(`Удалить урок «${initial.title}»? Это действие нельзя отменить.`)) return;
    try { await remove(`/lessons/${initial._id}`); navigate(route(course._id, week._id, day._id)); }
    catch (error) { window.alert(error.message || 'Не удалось удалить урок. Попробуйте ещё раз.'); }
  };
  const lessonIndex = day.lessons.findIndex(item => item._id === initial._id);
  const next = day.lessons[lessonIndex + 1];
  return <div className="lesson-layout"><LessonSidebar course={course} week={week} day={day} lesson={initial} navigate={navigate} />
    <main className="lesson-main"><div className="lesson-topline"><button className="back-link" onClick={() => navigate(route(course._id, week._id, day._id))}><ArrowLeft size={18} /> {day.title}</button><div className="lesson-top-actions">{author && <button className="delete-content-button lesson-delete-button" onClick={deleteLesson}>Удалить урок</button>}{author && <div className={`save-indicator status-${status}`}>{status === 'saved' ? <><Check size={17} /> Сохранено</> : status === 'saving' ? <><span className="saving-spinner" /> Сохраняем…</> : <><WifiOff size={17} /> Не удалось сохранить <button onClick={retry}><RotateCcw size={15} /> Повторить</button></>}</div>}</div></div><div className="lesson-paper"><div className="lesson-kicker">{week.title.toUpperCase()} <span>·</span> {day.title.toUpperCase()} <span>·</span> УРОК {lessonIndex + 1}</div>{author ? <input className="lesson-title-input" aria-label="Название урока" value={draft.title} placeholder="Название урока" onChange={event => update({ title: event.target.value })} /> : <h1 className="lesson-title">{draft.title}</h1>}{author ? <textarea className="lesson-lead-input" aria-label="Введение в урок" placeholder="Расскажите, чему посвящён этот урок…" value={draft.content} onChange={event => update({ content: event.target.value })} rows={2} /> : draft.content && <p className="lesson-lead">{draft.content}</p>}{author && <label className="homework-toggle"><input type="checkbox" checked={!!draft.hasHomework} onChange={e => update({ hasHomework: e.target.checked })}/> Для этого урока нужно домашнее задание</label>}<div className="lesson-rule" /><BlockEditor blocks={draft.blocks} onChange={blocks => update({ blocks })} readOnly={!author} />{draft.hasHomework && <button className="lesson-homework-link" onClick={async () => { await retry(); navigate(homeworkRoute(course._id, week._id, day._id, initial._id)); }}><span><ClipboardList size={20}/><strong>Домашнее задание</strong><small>Открыть условие, прикрепить файлы или проверить сдачи</small></span><ArrowRight size={20}/></button>}{student && <button className={`complete-button ${completed ? 'completed' : ''}`} onClick={onCompletion}><Check size={18} /> {completed ? 'Урок пройден · отменить отметку' : 'Отметить урок пройденным'}</button>}<div className="lesson-end"><span><Sparkles size={17} /> Вы дошли до конца урока</span>{next && <button onClick={() => navigate(route(course._id, week._id, day._id, next._id))}>Следующий урок <ArrowRight size={18} /></button>}</div></div></main></div>;
}
