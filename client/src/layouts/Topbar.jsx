import { useEffect, useState } from 'react';
import { BookOpen, LayoutGrid, LogIn, Menu } from 'lucide-react';
import { initials } from '../services/roles';
import { api } from '../services/api';

export default function Topbar({ user, navigate, mobileOpen, setMobileOpen }) {
  const [unreadHomeworks, setUnreadHomeworks] = useState(0);
  useEffect(() => {
    if (user?.role !== 'curator') { setUnreadHomeworks(0); return; }
    let active = true;
    const refresh = () => api('/homeworks/unread-count').then(result => { if (active) setUnreadHomeworks(result.count || 0); }).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 12000);
    window.addEventListener('homework-notifications-updated', refresh);
    return () => { active = false; clearInterval(interval); window.removeEventListener('homework-notifications-updated', refresh); };
  }, [user?._id, user?.role]);
  const goSection = id => { navigate('/'); let attempts = 0; const scrollWhenReady = () => { const section = document.getElementById(id); if (section) section.scrollIntoView({ behavior: 'smooth' }); else if (attempts++ < 20) setTimeout(scrollWhenReady, 60); }; scrollWhenReady(); };
  return <header className="topbar">
    <button className="brand" onClick={() => navigate('/')} aria-label="На главную"><span className="brand-symbol"><BookOpen size={19} strokeWidth={2.4} /></span><span>курсив<span className="brand-dot">.</span></span></button>
    <nav className="desktop-nav">{user ? <><button onClick={() => navigate('/dashboard')}>Кабинет</button><button className="homework-nav-link" onClick={() => navigate('/homeworks')}>Домашние работы{unreadHomeworks > 0 && <span className="homework-unread-dot" aria-label={`${unreadHomeworks} новых отправок`} title={`${unreadHomeworks} новых отправок`}/>}</button></> : <><button onClick={() => goSection('features')}>Возможности</button><button onClick={() => goSection('about')}>О нас</button></>}</nav>
    <div className="topbar-right"><button className="header-auth" onClick={() => navigate(user ? '/profile' : '/login')}>{user ? <><span className="mini-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : initials(user)}</span> Профиль</> : <><LogIn size={17} /> Войти</>}</button><button className="mobile-menu" aria-label="Открыть меню" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={22} /></button></div>
    {mobileOpen && <div className="mobile-dropdown">{!user && <><button onClick={() => { goSection('features'); setMobileOpen(false); }}>Возможности</button><button onClick={() => { goSection('about'); setMobileOpen(false); }}>О нас</button></>}{user && <><button onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}>Кабинет</button><button className="homework-nav-link" onClick={() => { navigate('/homeworks'); setMobileOpen(false); }}>Домашние работы{unreadHomeworks > 0 && <span className="homework-unread-dot" aria-label="Есть новые отправки"/>}</button></>}<button onClick={() => { navigate(user ? '/profile' : '/login'); setMobileOpen(false); }}>{user ? 'Профиль' : 'Войти'}</button></div>}
  </header>;
}
