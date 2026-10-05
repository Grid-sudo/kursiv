import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Bot, Gamepad2, GraduationCap, Image as ImageIcon, Link2, Mail, MessageCircle, Plus, Send, Sparkles, X } from 'lucide-react';
import { InlineCreator } from '../components/Ui';
import { api, post } from '../services/api';
import { route } from '../services/navigation';

const features = [
  { icon: Bot, title: 'Работа с ИИ', text: 'Осваивайте инструменты, которые экономят время и помогают находить идеи.', color: 'blue' },
  { icon: ImageIcon, title: 'Генерация изображений', text: 'Создавайте понятные иллюстрации и наглядные материалы для уроков.', color: 'mint' },
  { icon: BookOpen, title: 'Учебные материалы', text: 'Собирайте уроки, документы и полезные ссылки в одном месте.', color: 'peach' },
  { icon: Gamepad2, title: 'Образовательные игры', text: 'Превращайте сложные темы в увлекательные задания.', color: 'purple' }
];

export default function Home({ courses, user, progress, navigate, refresh }) {
  const [creating, setCreating] = useState(false);
  const [landingContent, setLandingContent] = useState({ contacts: [], faqs: [] });
  const canCreate = ['admin', 'teacher'].includes(user?.role);
  const firstProgress = progress?.courses?.[0];
  const percent = user ? (firstProgress?.percent ?? 0) : 75;
  const completed = user ? (firstProgress?.completedLessons ?? 0) : 15;
  const total = user ? (firstProgress?.totalLessons ?? 0) : 20;
  useEffect(() => { let active = true; api('/landing-content').then(content => { if (active) setLandingContent(content); }).catch(() => {}); return () => { active = false; }; }, []);
  const contactHref = value => {
    const href = String(value || '').trim();
    return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : '';
  };
  const resolveContact = contact => {
    const label = String(contact.label || '').toLocaleLowerCase();
    const value = String(contact.value || '').trim();
    const explicit = contactHref(contact.href) || contactHref(value);
    if (explicit) return explicit;
    if (label.includes('telegram')) {
      const username = value.replace(/^@/, '').trim();
      return username && /^[\w.]+$/.test(username) ? `https://t.me/${username}` : '';
    }
    if (label.includes('whatsapp') || label === 'wa') {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 8 ? `https://wa.me/${digits}` : '';
    }
    if (value.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
    if (/^[+\d\s().-]{8,}$/.test(value)) return `tel:${value.replace(/[^+\d]/g, '')}`;
    return '';
  };
  return <main className="home-page">
    <section className="home-hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> ПЛАТФОРМА ДЛЯ ОБУЧЕНИЯ</div><h1>Учитесь использовать ИИ<br /><em>в образовании.</em></h1><p>Практическая платформа для учителей и учеников: осваивайте нейросети, создавайте учебные материалы и применяйте ИИ в реальной работе.</p><div className="hero-actions"><button className="hero-button" onClick={() => user ? navigate('/dashboard') : navigate('/login')}>Начать обучение <ArrowRight size={20} /></button><button className="hero-secondary" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>Узнать больше</button></div></div><div className="hero-art" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="art-card art-card-back"><span /><span /><span /></div><div className="art-card art-card-front"><div className="art-mini-icon"><BookOpen size={20} /></div><div className="art-lines"><span /><span /><span /></div><div className="art-progress"><i /></div></div><div className="art-sparkle">✦</div></div></section>
    {user && <section className="home-content" id="courses"><div className="section-heading"><div><div className="eyebrow muted">НАЧНИТЕ ЗДЕСЬ</div><h2>Моё обучение</h2><p>Выберите, что хотите сделать сегодня</p></div><span className="course-count">{courses.length} {courses.length === 1 ? 'курс' : 'курсов'}</span></div>
      <div className="action-grid"><button className="action-card action-card-primary" onClick={() => document.getElementById('all-courses')?.scrollIntoView({ behavior: 'smooth' })}><span className="action-icon"><BookOpen size={28} /></span><span className="action-text"><strong>Мои курсы</strong><small>Продолжить обучение</small></span><span className="action-arrow"><ArrowRight size={23} /></span></button><button className="action-card" onClick={() => canCreate ? setCreating(true) : navigate(user ? '/dashboard' : '/login')}><span className="action-icon action-icon-plus">{canCreate ? <Plus size={28} /> : <Sparkles size={26} />}</span><span className="action-text"><strong>{canCreate ? 'Создать курс' : 'Начать обучение'}</strong><small>{canCreate ? 'Создать собственный курс' : 'Открыть личный кабинет'}</small></span><span className="action-arrow"><ArrowRight size={23} /></span></button></div>
      {creating && canCreate && <div className="create-course-panel"><div className="panel-heading"><div><h3>Новый курс</h3><p>Начните с названия. Всё остальное можно добавить позже.</p></div><button aria-label="Закрыть" onClick={() => setCreating(false)}><X size={21} /></button></div><InlineCreator placeholder="Например, Основы ИИ для учителей" label="Создать курс" description onCancel={() => setCreating(false)} onSubmit={async (title, description) => { const course = await post('/courses', { title, description }); await refresh(); navigate(route(course._id)); }} /></div>}
      <div className="list-heading" id="all-courses"><h3>Все курсы</h3><span>Откройте курс, чтобы продолжить</span></div><div className="course-grid">{courses.map((course, index) => <button className="course-card" key={course._id} onClick={() => navigate(user ? route(course._id) : '/login')}><span className={`course-cover cover-${index % 3}`} style={course.cover ? { backgroundImage: `url(${course.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span className="cover-small">КУРС · ОБУЧЕНИЕ</span>{!course.cover && <span className="cover-decoration"><Sparkles size={38} /></span>}</span><span className="course-card-body"><span className="card-kicker"><span className="status-dot" /> УЧЕБНЫЙ КУРС</span><strong>{course.title}</strong><small>{course.description || 'Откройте курс и начните обучение'}</small><span className="course-card-footer">Открыть курс <ArrowRight size={17} /></span></span></button>)}{!courses.length && <div className="empty-state"><BookOpen size={29} /><strong>Пока нет курсов</strong><span>Скоро здесь появятся материалы для обучения.</span></div>}</div>
    </section>}
    <section className="landing-features" id="features"><div className="landing-section-inner"><div className="eyebrow muted">ВОЗМОЖНОСТИ</div><h2>Всё нужное для современного урока</h2><p className="feature-intro">От первых шагов с нейросетями до собственных материалов и занятий.</p><div className="feature-grid">{features.map(({ icon: Icon, title, text, color }) => <article className="feature-card" key={title}><span className={`feature-icon ${color}`}><Icon size={25} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <section className="landing-about" id="about"><div className="landing-section-inner about-compact-layout">
      <div className="about-compact-copy"><div className="eyebrow muted">О НАС</div><h2>Курсив помогает применять ИИ в образовании</h2><p>Учителя изучают инструменты и создают материалы для уроков. Ученики проходят курсы, выполняют задания и получают обратную связь куратора.</p><button className="hero-button" onClick={() => navigate(user ? '/dashboard' : '/login')}>Начать обучение <ArrowRight size={18} /></button></div>
      <div className="sample-progress-card"><div className="sample-progress-top"><span className="feature-icon blue"><GraduationCap size={23} /></span><span>{user ? 'Ваш прогресс' : 'Пример прогресса'}</span></div><h3>{firstProgress?.title || (user ? 'Курсы пока не назначены' : 'Основы искусственного интеллекта')}</h3><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-labels"><strong>{percent}%</strong><span>{completed} из {total} уроков</span></div></div>
    </div></section>
    <section id="contacts" className="landing-contact-section"><div className="landing-section-inner landing-contact-layout">
      <div className="landing-contact-heading"><div className="eyebrow muted">МЫ НА СВЯЗИ</div><h2>Контакты и ссылки</h2><p>Остались вопросы? Напишите нам удобным способом.</p></div>
      <div className="landing-contact-list">{landingContent.contacts.map((contact, index) => { const href = resolveContact(contact); const label = String(contact.label || '').toLocaleLowerCase(); const Icon = label.includes('telegram') ? Send : label.includes('whatsapp') || label === 'wa' ? MessageCircle : label.includes('почт') || label.includes('email') ? Mail : Link2; const action = href?.startsWith('mailto:') || href?.startsWith('tel:') || label.includes('telegram') || label.includes('whatsapp') || label === 'wa' ? 'Написать' : 'Открыть'; return <article className="landing-contact-item" key={`${contact.label}-${index}`}><span className="landing-contact-icon"><Icon size={19}/></span><div className="landing-contact-copy"><small>{contact.label}</small><strong>{contact.value}</strong></div>{href ? <a className="landing-contact-action" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{action}<ArrowRight size={14}/></a> : <span className="landing-contact-no-link">Ссылка не указана</span>}</article>; })}{!landingContent.contacts.length && <div className="landing-help-empty">Контакты пока не добавлены.</div>}</div>
    </div></section>
    <section id="faq" className="landing-faq-section"><div className="landing-section-inner"><div className="eyebrow muted">ПОМОЩЬ</div><h2>Частые вопросы</h2><div className="landing-faq-list">{landingContent.faqs.map((item, index) => <details className="landing-faq-item" key={`${item.question}-${index}`}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}{!landingContent.faqs.length && <div className="landing-help-empty">Ответы скоро появятся.</div>}</div></div></section>
    <footer className="landing-footer"><span className="brand-foot">курсив<span>.</span></span><span>Учиться и создавать. Легко.</span></footer>
  </main>;
}
