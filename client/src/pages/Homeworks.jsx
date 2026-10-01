import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, FileText, Paperclip, Plus, Send, Upload, Users, X } from 'lucide-react';
import { api, post, put, remove, uploadFile } from '../services/api';

const statusMeta = {
  'Не начато': { label: 'Не отправлено', tone: 'todo' },
  Выполняется: { label: 'Не отправлено', tone: 'todo' },
  'На проверке': { label: 'Отправлено', tone: 'sent' },
  Принято: { label: 'Проверено', tone: 'done' },
  'Нужно исправить': { label: 'Нужна доработка', tone: 'revision' }
};
const displayStatus = (status, viewed) => status === 'На проверке' && viewed ? { label: 'Проверяется', tone: 'reviewing' } : statusMeta[status] || statusMeta['Не начато'];
const dateLabel = date => date ? new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const dueTone = date => date && new Date(date).setHours(23, 59, 59, 999) < Date.now() ? 'is-overdue' : '';

export default function Homeworks({ user, navigate }) {
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', courseId: '', dueDate: '' });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const load = async () => { try { setItems(await api('/homeworks')); setError(''); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); api('/courses').then(setCourses).catch(() => {}); }, []);
  const courseNames = useMemo(() => Object.fromEntries(courses.map(course => [String(course._id), course.title])), [courses]);
  const counts = useMemo(() => items.reduce((result, item) => { const key = displayStatus(item.submission?.status, item.submission?.curatorViewedAt).tone; result.all++; result[key]++; return result; }, { all: 0, todo: 0, sent: 0, reviewing: 0, done: 0, revision: 0 }), [items]);
  const visibleItems = useMemo(() => items.filter(item => {
    const status = displayStatus(item.submission?.status, item.submission?.curatorViewedAt);
    const matchesFilter = filter === 'all' || status.tone === filter;
    const text = `${item.title} ${item.description} ${courseNames[String(item.courseId)] || ''}`.toLowerCase();
    return matchesFilter && text.includes(query.trim().toLowerCase());
  }), [items, filter, query, courseNames]);
  const attach = async file => { if (!file) return null; const result = await uploadFile(file); return { uploadId: result.id, name: result.name, url: result.url, mimeType: result.mimeType, size: result.size }; };
  const create = async event => {
    event.preventDefault(); setCreating(true); setError('');
    try {
      const attachments = await Promise.all([...event.currentTarget.elements.homeworkFiles.files].map(attach));
      await post('/homeworks', { ...draft, attachments });
      setDraft({ title: '', description: '', courseId: '', dueDate: '' }); setForm(false); await load();
    } catch (err) { setError(err.message); } finally { setCreating(false); }
  };
  const isStudent = user.role === 'student';
  const isCurator = user.role === 'curator';
  const canCreate = ['admin', 'teacher'].includes(user.role);

  return <main className="account-page homework-hub"><div className="account-width homework-hub-width">
    <button className="back-link" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> В кабинет</button>
    <div className="homework-page-heading"><div><div className="eyebrow muted">ОБУЧЕНИЕ</div><h1>Домашние работы</h1><p>{isStudent ? 'Все задания, сроки и ваши отправленные работы — в одном месте.' : isCurator ? 'Работы учеников, которым вы помогаете.' : 'Управляйте заданиями и проверяйте отправленные работы.'}</p></div>{canCreate && <button className="primary-button" onClick={() => setForm(value => !value)}><Plus size={17} />{form ? 'Скрыть форму' : 'Новое задание'}</button>}</div>
    {error && <div className="form-error homework-page-error">{error}</div>}
    {form && <form className="homework-create-form" onSubmit={create}><div className="homework-create-heading"><div><span className="homework-section-kicker">НОВОЕ ЗАДАНИЕ</span><h2>Добавить домашнюю работу</h2></div><button type="button" className="homework-close-form" onClick={() => setForm(false)} aria-label="Закрыть форму"><X size={18}/></button></div><div className="homework-create-grid"><label>Название задания<input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Например, практика по теме урока" /></label><label>Курс<select required value={draft.courseId} onChange={e => setDraft({ ...draft, courseId: e.target.value })}><option value="">Выберите курс</option>{courses.map(course => <option key={course._id} value={course._id}>{course.title}</option>)}</select></label><label>Срок сдачи<input type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></label><label className="homework-create-description">Описание<textarea rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Опишите, что нужно сделать" /></label><label className="homework-create-files"><span>Материалы к заданию</span><span className="homework-file-picker"><Upload size={16}/>Выбрать файлы<input name="homeworkFiles" type="file" multiple /></span></label></div><button className="primary-button" disabled={creating}>{creating ? 'Создаём…' : 'Создать задание'}</button></form>}

    {isStudent && items.length > 0 && <section className="homework-overview"><div className="homework-overview-copy"><span className="homework-overview-icon"><FileText size={20}/></span><div><strong>{counts.all} {counts.all === 1 ? 'задание' : 'заданий'}</strong><span>{counts.revision ? `${counts.revision} требуют доработки` : counts.todo ? `${counts.todo} ждут вашей работы` : 'Вы в курсе своих заданий'}</span></div></div><div className="homework-overview-stats"><span><b>{counts.todo + counts.revision}</b>В работе</span><span><b>{counts.sent + counts.reviewing}</b>На проверке</span><span><b>{counts.done}</b>Проверено</span></div></section>}

    {isStudent && items.length > 0 && <div className="homework-toolbar"><div className="homework-filters">{[['all', 'Все'], ['todo', 'Не отправлено'], ['sent', 'Отправлено'], ['reviewing', 'Проверяется'], ['done', 'Проверено'], ['revision', 'Доработка']].map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div><input className="homework-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти задание" aria-label="Найти задание" /></div>}

    {visibleItems.length > 0 ? <div className="homework-list">{visibleItems.map(item => <HomeworkCard key={item._id} item={item} user={user} courseTitle={courseNames[String(item.courseId)]} onChange={load} attach={attach} />)}</div> : <section className="homework-empty"><span className="homework-empty-icon"><CheckCircle2 size={24}/></span><h2>{items.length ? 'Заданий не найдено' : isStudent ? 'Домашних заданий пока нет' : 'Пока нет домашних работ'}</h2><p>{items.length ? 'Измените фильтр или поисковый запрос.' : isStudent ? 'Когда учитель добавит задание к курсу, оно появится здесь.' : canCreate ? 'Создайте первое задание для своих учеников.' : 'Задания учеников появятся здесь, когда они будут назначены.'}</p>{canCreate && !form && <button className="outline-button" onClick={() => setForm(true)}><Plus size={16}/>Создать задание</button>}</section>}
  </div></main>;
}

function HomeworkCard({ item, user, courseTitle, onChange, attach }) {
  const [files, setFiles] = useState(item.submission?.attachments || []);
  const [studentComment, setStudentComment] = useState(item.submission?.studentComment || '');
  const [rows, setRows] = useState([]);
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  const isStudent = user.role === 'student';
  const submitted = ['На проверке', 'Принято'].includes(item.submission?.status);
  const canEdit = isStudent && !submitted;
  const status = displayStatus(item.submission?.status, item.submission?.curatorViewedAt);
  const save = async (attachments, comment = studentComment, mode = 'draft') => {
    const result = await put(`/homeworks/${item._id}/submission`, { attachments, studentComment: comment, mode });
    setFiles(result.attachments || []); setStudentComment(result.studentComment || '');
  };
  const openSubmissions = async () => {
    if (viewing) { setViewing(false); return; }
    setBusy(true); setCardError('');
    try {
      const submissions = await api(`/homeworks/${item._id}/submissions`);
      if (user.role === 'curator') {
        const unread = submissions.filter(row => row.submittedAt && !row.curatorViewedAt);
        await Promise.all(unread.map(row => api(`/homeworks/${item._id}/submissions/${row._id}/read`, { method: 'PATCH', body: JSON.stringify({}) })));
        submissions.forEach(row => { if (unread.some(entry => entry._id === row._id)) row.curatorViewedAt = new Date().toISOString(); });
        window.dispatchEvent(new Event('homework-notifications-updated'));
      }
      setRows(submissions); setViewing(true);
    } catch (err) { setCardError(err.message); } finally { setBusy(false); }
  };
  const updateReview = async (row, changes) => {
    try {
      const updated = await api(`/homeworks/${item._id}/submissions/${row._id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      setRows(current => current.map(entry => entry._id === row._id ? { ...entry, ...updated } : entry));
    } catch (err) { setCardError(err.message); }
  };

  return <article className={`homework-task-card ${isStudent ? 'is-student-task' : ''}`}>
    <div className="homework-task-topline"><div className="homework-course-tag">{courseTitle || 'Домашнее задание'}{item.lessonId && <span>· урок</span>}</div>{isStudent ? <span className={`homework-status-pill status-${status.tone}`}>{status.label}</span> : item.dueDate && <span className={`homework-due ${dueTone(item.dueDate)}`}><CalendarDays size={14}/>{dateLabel(item.dueDate)}</span>}</div>
    <div className="homework-task-heading"><div><h2>{item.title}</h2>{item.description && <p>{item.description}</p>}</div>{isStudent && item.dueDate && <span className={`homework-due ${dueTone(item.dueDate)}`}><CalendarDays size={14}/><span>Срок сдачи</span><b>{dateLabel(item.dueDate)}</b></span>}</div>
    {item.attachments?.length > 0 && <div className="homework-resource-list"><span className="homework-block-label">Материалы задания</span>{item.attachments.map(file => <a key={file.uploadId || file.url} href={file.url} target="_blank" rel="noreferrer"><Paperclip size={16}/><span>{file.name}</span><small>Открыть</small></a>)}</div>}
    {isStudent ? <div className="homework-student-work">
      {item.submission?.status === 'Нужно исправить' && <div className="homework-review-note"><span>Комментарий куратора</span><p>{item.submission.comment || 'Куратор попросил внести исправления.'}</p></div>}
      {item.submission?.status === 'Принято' && item.submission.comment && <div className="homework-review-note is-approved"><span>Комментарий куратора</span><p>{item.submission.comment}</p></div>}
      {files.length > 0 && <div className="homework-submission-files"><span className="homework-block-label">Ваши файлы</span>{files.map(file => <div className="homework-submission-file" key={file.uploadId || file.url}><a href={file.url} target="_blank" rel="noreferrer"><Paperclip size={15}/>{file.name}</a>{canEdit && <button type="button" aria-label={`Удалить ${file.name}`} onClick={async () => { try { await save(files.filter(entry => entry.url !== file.url)); if (file.uploadId) await remove(`/upload/${file.uploadId}`); } catch (err) { setCardError(err.message); } }}><X size={15}/></button>}</div>)}</div>}
      {canEdit && <><label className="homework-upload-button"><Upload size={17}/><span>{files.length ? 'Добавить ещё файлы' : 'Прикрепить работу'}</span><small>Можно выбрать несколько файлов</small><input type="file" multiple onChange={async event => { const selected = [...event.target.files]; event.target.value = ''; setBusy(true); setCardError(''); try { const added = await Promise.all(selected.map(attach)); await save([...files, ...added]); } catch (err) { setCardError(`Не удалось сохранить файлы: ${err.message}`); } finally { setBusy(false); } }} /></label><label className="homework-comment-box"><span>Комментарий к работе <small>необязательно</small></span><textarea rows={3} value={studentComment} onChange={event => setStudentComment(event.target.value)} onBlur={() => save(files, studentComment).catch(err => setCardError(err.message))} placeholder="Напишите комментарий для куратора" /></label></>}
      {!canEdit && item.submission?.submittedAt && <p className="homework-submitted-at"><Clock3 size={15}/>Отправлено {new Date(item.submission.submittedAt).toLocaleString('ru-RU')}</p>}
      {cardError && <p className="homework-inline-error">{cardError}</p>}
      {canEdit ? <div className="homework-submit-row"><span>{files.length ? `${files.length} ${files.length === 1 ? 'файл готов' : 'файла готовы'} к отправке` : 'Добавьте файл перед отправкой'}</span><button className="primary-button" disabled={busy || files.length === 0} onClick={async () => { setBusy(true); setCardError(''); try { await save(files, studentComment, 'submit'); await onChange(); } catch (err) { setCardError(err.message); } finally { setBusy(false); } }}>{busy ? 'Сохраняем…' : item.submission?.status === 'Нужно исправить' ? <><Send size={16}/>Отправить исправленную работу</> : <><Send size={16}/>Отправить куратору</>}</button></div> : <div className="homework-submitted-banner"><CheckCircle2 size={18}/><span>{status.label}{item.submission?.submittedAt && ` · ${new Date(item.submission.submittedAt).toLocaleDateString('ru-RU')}`}</span></div>}
    </div> : <div className="homework-review-section"><button className="homework-review-toggle" onClick={openSubmissions} disabled={busy}><span className="homework-review-toggle-icon"><Users size={17}/></span><span>{busy ? 'Загружаем отправки…' : viewing ? 'Скрыть отправки учеников' : 'Посмотреть отправки учеников'}</span><b>{rows.length || ''}</b></button>{cardError && <p className="homework-inline-error">{cardError}</p>}{viewing && <div className="homework-review-list">{rows.map(row => <div className="homework-review-card" key={row._id}><div className="homework-review-card-head"><div><strong>{row.studentId?.firstName} {row.studentId?.lastName}</strong><small>{row.studentId?.email}</small></div><span className={`homework-status-pill status-${displayStatus(row.status, row.curatorViewedAt).tone}`}>{displayStatus(row.status, row.curatorViewedAt).label}</span></div><div className="homework-review-card-meta">{row.submittedAt ? `Отправлено ${new Date(row.submittedAt).toLocaleString('ru-RU')}` : 'Черновик'}</div>{row.studentComment && <p className="homework-student-note">Комментарий ученика: {row.studentComment}</p>}{row.attachments?.length > 0 && <div className="homework-review-files">{row.attachments.map(file => <a key={file.uploadId || file.url} href={file.url} target="_blank" rel="noreferrer"><Paperclip size={15}/>{file.name}<small>Скачать</small></a>)}</div>}<div className="homework-review-controls"><label>Решение<select value={row.status} onChange={event => updateReview(row, { status: event.target.value })}><option>Не начато</option><option>Выполняется</option><option>На проверке</option><option>Принято</option><option>Нужно исправить</option></select></label><label>Комментарий ученику<input defaultValue={row.comment} placeholder="Напишите комментарий" onBlur={event => { if (event.target.value !== row.comment) updateReview(row, { comment: event.target.value }); }} /></label></div></div>)}{!rows.length && <div className="homework-no-submissions">Отправок пока нет.</div>}</div>}</div>}
  </article>;
}
