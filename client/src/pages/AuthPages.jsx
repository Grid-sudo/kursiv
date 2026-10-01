import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Check, ExternalLink, Link2, LockKeyhole, LogOut, Mail } from 'lucide-react';
import { put, uploadFile } from '../services/api';
import { initials, roleNames } from '../services/roles';

const safeProfileUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
};

export function LoginPage({ navigate, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="auth-page"><button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={17} /> На главную</button><div className="auth-panel"><div className="auth-icon"><LockKeyhole size={25} /></div><div className="eyebrow muted">ДОБРО ПОЖАЛОВАТЬ</div><h1>Войти в Курсив</h1><p>Введите данные аккаунта, чтобы продолжить обучение.</p><form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await onLogin(email, password); } catch (err) { setError(err.message); } finally { setBusy(false); } }}><label>Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Пароль<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Ваш пароль" /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button></form><div className="auth-footnote">Аккаунт создаёт администратор или ваш куратор.</div></div></main>;
}

export function ProfilePage({ user, onSaved, onLogout, navigate }) {
  const [form, setForm] = useState({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', bio: user.bio || '', portfolioUrl: user.portfolioUrl || '', linkedinUrl: user.linkedinUrl || '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setForm({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', bio: user.bio || '', portfolioUrl: user.portfolioUrl || '', linkedinUrl: user.linkedinUrl || '' }), [user]);
  const save = async event => { event.preventDefault(); setBusy(true); setError(''); try { const updated = await put('/profile', form); onSaved(updated); setEditing(false); setMessage('Изменения сохранены'); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const avatar = async file => { if (!file) return; setBusy(true); setError(''); try { const uploaded = await uploadFile(file); const updated = await put('/profile', { avatar: uploaded.url }); onSaved(updated); setMessage('Аватар обновлён'); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <main className="account-page profile-page"><div className="account-width profile-page-width">
    <button className="back-link" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> В кабинет</button>
    <div className="account-heading profile-page-heading"><div><div className="eyebrow muted">ЛИЧНЫЙ КАБИНЕТ</div><h1>Мой профиль</h1><p>Личные данные и настройки аккаунта</p></div><button className="outline-button" onClick={onLogout}><LogOut size={16} /> Выйти</button></div>
    <div className="profile-layout">
      <aside className="profile-summary-card"><div className="profile-summary-banner"><span>КУРСИВ · ПРОФИЛЬ</span></div><div className="profile-summary-body"><div className="profile-summary-photo-row"><div className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="Аватар" /> : initials(user)}</div><label className={`profile-photo-button ${busy ? 'is-busy' : ''}`} title="Изменить фото"><Camera size={16} /><input type="file" accept="image/*" disabled={busy} onChange={event => { const file = event.target.files[0]; event.target.value = ''; avatar(file); }} /></label></div><h2>{user.firstName} {user.lastName}</h2><span className={`role-badge role-${user.role}`}>{roleNames[user.role]}</span><div className="profile-summary-divider"/><div className="profile-summary-contact"><Mail size={17}/><div><small>Почта аккаунта</small><strong>{user.email}</strong></div></div><div className="profile-summary-links"><div className="profile-summary-links-title"><Link2 size={16}/> Ссылки</div>{safeProfileUrl(user.portfolioUrl) && <a href={safeProfileUrl(user.portfolioUrl)} target="_blank" rel="noreferrer"><span>Портфолио</span><ExternalLink size={15}/></a>}{safeProfileUrl(user.linkedinUrl) && <a href={safeProfileUrl(user.linkedinUrl)} target="_blank" rel="noreferrer"><span>LinkedIn</span><ExternalLink size={15}/></a>}{!safeProfileUrl(user.portfolioUrl) && !safeProfileUrl(user.linkedinUrl) && <p>Добавьте портфолио или LinkedIn в настройках профиля.</p>}</div></div></aside>
      <section className="profile-details-card"><div className="profile-details-heading"><div><div className="eyebrow muted">ЛИЧНАЯ ИНФОРМАЦИЯ</div><h2>Данные профиля</h2><p>Эти данные отображаются в вашем учебном пространстве.</p></div><button className="outline-button" type="button" onClick={() => { if (editing) setForm({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', bio: user.bio || '', portfolioUrl: user.portfolioUrl || '', linkedinUrl: user.linkedinUrl || '' }); setEditing(!editing); setError(''); }}>{editing ? 'Отменить' : 'Изменить'}</button></div>
        {message && <div className="form-success"><Check size={16} /> {message}</div>}{error && <div className="form-error">{error}</div>}
        <form className="profile-form profile-details-form" onSubmit={save}><div className="form-grid"><label>Имя<input disabled={!editing} value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} required /></label><label>Фамилия<input disabled={!editing} value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} required /></label><label className="profile-email-field">Email<input disabled={!editing} type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label></div><label>О себе<textarea disabled={!editing} rows={4} value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} placeholder="Коротко расскажите о себе" /></label><div className="profile-links-form"><div className="profile-links-form-title"><Link2 size={17}/> Ссылки на ваши работы и профессиональные профили</div><div className="form-grid"><label>Портфолио<input disabled={!editing} type="url" value={form.portfolioUrl} onChange={event => setForm({ ...form, portfolioUrl: event.target.value })} placeholder="https://example.com" /></label><label>LinkedIn<input disabled={!editing} type="url" value={form.linkedinUrl} onChange={event => setForm({ ...form, linkedinUrl: event.target.value })} placeholder="https://linkedin.com/in/..." /></label></div></div>{editing && <div className="profile-form-actions"><button type="button" className="outline-button" onClick={() => { setForm({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', bio: user.bio || '', portfolioUrl: user.portfolioUrl || '', linkedinUrl: user.linkedinUrl || '' }); setEditing(false); setError(''); }}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить изменения'}</button></div>}</form>
      </section>
    </div>
  </div></main>;
}
