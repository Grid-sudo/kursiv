import { useEffect, useState } from 'react';
import { Paperclip, Upload, X, Check } from 'lucide-react';
import { api, post, put, remove, uploadFile } from '../services/api';

export default function LessonHomework({ lesson, course, user, author }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ title: '', description: '', dueDate: '' });
  const [creating, setCreating] = useState(false);
  const [filesByHomework, setFilesByHomework] = useState({});
  const [submissionsByHomework, setSubmissionsByHomework] = useState({});
  const [openedSubmissions, setOpenedSubmissions] = useState({});
  const [uploading, setUploading] = useState(null);
  const load = () => api(`/homeworks?lessonId=${lesson._id}`).then(setItems).catch(e => setError(e.message));
  useEffect(() => { if (lesson.hasHomework) load(); }, [lesson._id, lesson.hasHomework]);
  if (!lesson.hasHomework && !author) return null;
  const attach = async file => { const f = await uploadFile(file); return { uploadId: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size }; };
  const saveStudentDraft = async (item, attachments, studentComment = item.submission?.studentComment || '', mode = 'draft') => {
    const saved = await put(`/homeworks/${item._id}/submission`, { attachments, studentComment, mode });
    setItems(current => current.map(entry => entry._id === item._id ? { ...entry, submission: saved } : entry));
    setFilesByHomework(current => ({ ...current, [item._id]: saved.attachments || [] }));
    window.dispatchEvent(new Event('homework-notifications-updated'));
    return saved;
  };
  const openSubmissions = async item => {
    if (openedSubmissions[item._id]) { setOpenedSubmissions(current => ({ ...current, [item._id]: false })); return; }
    setError('');
    try {
      const rows = await api(`/homeworks/${item._id}/submissions`);
      const unread = rows.filter(row => row.submittedAt && !row.curatorViewedAt);
      await Promise.all(unread.map(row => api(`/homeworks/${item._id}/submissions/${row._id}/read`, { method: 'PATCH', body: JSON.stringify({}) })));
      setSubmissionsByHomework(current => ({ ...current, [item._id]: rows.map(row => unread.some(entry => entry._id === row._id) ? { ...row, curatorViewedAt: new Date().toISOString() } : row) }));
      setOpenedSubmissions(current => ({ ...current, [item._id]: true }));
      window.dispatchEvent(new Event('homework-notifications-updated'));
    } catch (err) { setError(err.message); }
  };
  const create = async event => {
    event.preventDefault(); setError('');
    try {
      const attachments = await Promise.all([...event.currentTarget.elements.attachments.files].map(attach));
      await post('/homeworks', { ...draft, courseId: course._id, lessonId: lesson._id, attachments });
      setCreating(false); setDraft({ title: '', description: '', dueDate: '' }); load();
    } catch (e) { setError(e.message); }
  };
  return <section className="lesson-homework"><div className="lesson-homework-head"><div><span className="eyebrow muted">ПРАКТИКА</span><h2>Домашнее задание</h2></div>{author && !items.length && <button className="outline-button" onClick={() => setCreating(v => !v)}>{creating ? 'Закрыть' : '+ Добавить задание'}</button>}</div>
    {error && <div className="form-error">{error}</div>}
    {author && creating && <form className="lesson-homework-form" onSubmit={create}><label>Название<input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/></label><label>Описание<textarea rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label><label>Срок сдачи<input type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })}/></label><label>Файлы задания<input name="attachments" type="file" multiple /></label><button className="primary-button">Добавить задание</button></form>}
    {!items.length && author && !creating && <p className="homework-hint">Для этого урока пока нет задания.</p>}
    {items.map(item => <article className="lesson-homework-item" key={item._id}><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.dueDate && <small>Срок сдачи: {new Date(item.dueDate).toLocaleDateString('ru-RU')}</small>}{item.attachments?.map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer"><Paperclip size={16}/>{file.name}</a>)}
      {user.role === 'student' && <><label className="outline-button lesson-attach"><Upload size={16}/>{uploading === item._id ? 'Загружаем…' : 'Прикрепить файл'}<input type="file" multiple disabled={uploading === item._id || ['На проверке', 'Принято'].includes(item.submission?.status)} onChange={async e => { const selected = [...e.target.files]; e.target.value = ''; if (!selected.length) return; setUploading(item._id); setError(''); try { const more = await Promise.all(selected.map(attach)); const pending = [...(filesByHomework[item._id] || item.submission?.attachments || []), ...more]; setFilesByHomework(current => ({ ...current, [item._id]: pending })); await saveStudentDraft(item, pending); } catch (err) { setError(`Не удалось сохранить файлы. ${err.message} Попробуйте прикрепить их ещё раз.`); } finally { setUploading(null); }}}/></label>{(filesByHomework[item._id] || item.submission?.attachments || []).map(file => <div className="student-attachment" key={file.uploadId || file.url}><a href={file.url} target="_blank" rel="noreferrer"><Paperclip size={16}/>{file.name}</a><button aria-label={`Удалить ${file.name}`} title="Убрать файл" disabled={['На проверке', 'Принято'].includes(item.submission?.status)} onClick={async () => { try { await saveStudentDraft(item, (filesByHomework[item._id] || item.submission?.attachments || []).filter(entry => entry.url !== file.url)); if (file.uploadId) await remove(`/upload/${file.uploadId}`); } catch (err) { setError(err.message); } }}><X size={17}/></button></div>)}<label className="student-comment-field">Комментарий к работе<textarea rows={3} readOnly={['На проверке', 'Принято'].includes(item.submission?.status)} defaultValue={item.submission?.studentComment || ''} placeholder="Добавьте пояснение для куратора" onBlur={async e => { const comment = e.target.value; if (comment !== (item.submission?.studentComment || '')) try { await saveStudentDraft(item, filesByHomework[item._id] || item.submission?.attachments || [], comment); } catch (err) { setError(err.message); } }}/></label>{item.submission?.status === 'Нужно исправить' && <p className="revision-comment">Комментарий куратора: {item.submission.comment || 'Пожалуйста, внесите исправления.'}</p>}{item.submission?.submittedAt && <p>Отправлено: {new Date(item.submission.submittedAt).toLocaleString('ru-RU')}</p>}<p className="homework-status">Статус: {({ 'Выполняется': 'Не отправлено', 'На проверке': item.submission?.curatorViewedAt ? 'Проверяется' : 'Отправлено', 'Принято': 'Проверено', 'Нужно исправить': 'Нужна доработка' })[item.submission?.status] || 'Не отправлено'}</p><button className="primary-button" disabled={uploading === item._id || ['На проверке', 'Принято'].includes(item.submission?.status)} onClick={async () => { try { await saveStudentDraft(item, filesByHomework[item._id] || item.submission?.attachments || [], item.submission?.studentComment || '', 'submit'); } catch (err) { setError(`Не удалось отправить работу. ${err.message} Попробуйте ещё раз.`); } }}>{item.submission?.status === 'Нужно исправить' ? 'Отправить исправленную работу' : item.submission?.status === 'На проверке' ? <><Check size={17}/> Отправлено на проверку</> : item.submission?.status === 'Принято' ? 'Работа проверена' : 'Отправить куратору'}</button>{item.submission?.comment && item.submission?.status !== 'Нужно исправить' && <p>Комментарий куратора: {item.submission.comment}</p>}</>}
      {user.role === 'curator' && <><button className="outline-button" onClick={() => openSubmissions(item)}>{openedSubmissions[item._id] ? 'Скрыть работы учеников' : 'Посмотреть работы учеников'}</button>{openedSubmissions[item._id] && <div className="curator-submissions">{(submissionsByHomework[item._id] || []).map(submission => <div className="curator-submission" key={submission._id}><strong>{submission.studentId?.firstName} {submission.studentId?.lastName}</strong><span>{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('ru-RU') : 'Черновик сохранён'} · {({ 'Выполняется': 'Не отправлено', 'На проверке': submission.curatorViewedAt ? 'Проверяется' : 'Отправлено', 'Принято': 'Проверено', 'Нужно исправить': 'Нужна доработка' })[submission.status] || submission.status}</span>{submission.studentComment && <p>Комментарий ученика: {submission.studentComment}</p>}{submission.attachments?.map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer"><Paperclip size={16}/>{file.name} · открыть</a>)}<select aria-label="Статус работы" value={submission.status} onChange={async e => { try { await api(`/homeworks/${item._id}/submissions/${submission._id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); setSubmissionsByHomework(prev => ({ ...prev, [item._id]: prev[item._id].map(row => row._id === submission._id ? { ...row, status: e.target.value } : row) })); } catch (err) { setError(err.message); } }}><option>Не начато</option><option>Выполняется</option><option>На проверке</option><option>Принято</option><option>Нужно исправить</option></select><textarea aria-label="Комментарий куратору ученику" placeholder="Комментарий ученику" defaultValue={submission.comment} onBlur={async e => { if (e.target.value !== submission.comment) try { await api(`/homeworks/${item._id}/submissions/${submission._id}`, { method: 'PATCH', body: JSON.stringify({ comment: e.target.value }) }); } catch (err) { setError(err.message); } }}/></div>)}{!submissionsByHomework[item._id]?.length && <p className="homework-hint">Пока никто не отправил работу.</p>}</div>}</>}
      {author && <button className="outline-button" onClick={() => setCreating(true)}>＋ Добавить ещё задание</button>}
    </article>)}
  </section>;
}
