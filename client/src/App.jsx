import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, RotateCcw, X } from 'lucide-react';
import { api, hasToken, post, remove, setToken } from './services/api';
import { canAuthor, roleHome } from './services/roles';
import Topbar from './layouts/Topbar';
import Home from './pages/Home';
import { CoursePage, WeekPage, DayPage } from './pages/CoursePages';
import LessonPage from './pages/LessonPage';
import Homeworks from './pages/Homeworks';
import LessonHomeworkPage from './pages/LessonHomeworkPage';
import { LoginPage, ProfilePage } from './pages/AuthPages';
import { Dashboard, StudentDetail } from './pages/Dashboard';
import './extra.css';

const parsePath = () => {
  const parts = location.pathname.split('/').filter(Boolean);
  const page = parts[0] === 'course' ? 'course' : ['login', 'profile', 'dashboard', 'students', 'homeworks'].includes(parts[0]) ? parts[0] : 'home';
  return { page, courseId: page === 'course' ? parts[1] : null, weekId: page === 'course' ? parts[3] : null, dayId: page === 'course' ? parts[5] : null, lessonId: page === 'course' ? parts[7] : null, homework: page === 'course' && parts[8] === 'homework', studentId: page === 'students' ? parts[1] : null };
};

export default function App() {
  const [path, setPath] = useState(parsePath);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useCallback(url => { history.pushState({}, '', url); setPath(parsePath()); window.scrollTo(0, 0); }, []);
  const refresh = useCallback(async () => { const list = await api('/courses'); setCourses(list); if (path.courseId) setCourse(await api(`/courses/${path.courseId}`)); }, [path.courseId]);
  const refreshProgress = useCallback(async () => { if (user) setProgress(await api('/progress/me')); }, [user?._id]);
  const onLogin = async (email, password) => { const result = await post('/auth/login', { email, password }); setToken(result.token); setUser(result.user); navigate(roleHome(result.user.role)); };
  const onLogout = () => { post('/auth/logout', {}).catch(() => {}); setToken(null); setUser(null); setProgress(null); navigate('/'); };
  const onCompletion = async (lessonId, completed) => { const updated = completed ? await remove(`/progress/lessons/${lessonId}/complete`) : await post(`/progress/lessons/${lessonId}/complete`, {}); setProgress(updated); };

  useEffect(() => { const pop = () => setPath(parsePath()); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  useEffect(() => { let active = true; (async () => { if (hasToken()) { try { const current = await api('/auth/me'); if (active) setUser(current); } catch { setToken(null); } } if (active) setAuthLoading(false); })(); return () => { active = false; }; }, []);
  useEffect(() => { const expired = () => { setToken(null); setUser(null); setProgress(null); navigate('/login'); }; window.addEventListener('course-auth-expired', expired); return () => window.removeEventListener('course-auth-expired', expired); }, [navigate]);
  useEffect(() => { if (authLoading) return; if (['profile', 'dashboard', 'students', 'course', 'homeworks'].includes(path.page) && !user) navigate('/login'); }, [authLoading, user, path.page, navigate]);
  useEffect(() => { if (authLoading) return; let active = true; setLoading(true); setError(''); (async () => { try { const list = await api('/courses'); const selected = path.courseId && user ? await api(`/courses/${path.courseId}`) : null; const selectedLesson = path.lessonId && user ? await api(`/lessons/${path.lessonId}`) : null; if (active) { setCourses(list); setCourse(selected); setLesson(selectedLesson); } } catch (err) { if (active) setError(err.message); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, [authLoading, user?._id, path.courseId, path.lessonId, path.homework]);
  useEffect(() => { if (!user) { setProgress(null); return; } refreshProgress().catch(() => {}); }, [user?._id, refreshProgress]);

  const week = course?.weeks.find(item => item._id === path.weekId);
  const day = week?.days.find(item => item._id === path.dayId);
  const author = canAuthor(user, course);
  const isProtected = ['dashboard', 'profile', 'students', 'course'].includes(path.page);
  let content;
  if (authLoading || loading) content = <div className="loading-page"><div className="loading-mark"><BookOpen size={27} /></div><span>Открываем ваше пространство…</span></div>;
  else if (isProtected && !user) content = <LoginPage navigate={navigate} onLogin={onLogin} />;
  else if (path.page === 'login') content = user ? <Dashboard user={user} courses={courses} navigate={navigate} /> : <LoginPage navigate={navigate} onLogin={onLogin} />;
  else if (path.page === 'profile') content = <ProfilePage user={user} onSaved={setUser} onLogout={onLogout} navigate={navigate} />;
  else if (path.page === 'dashboard') content = <Dashboard user={user} courses={courses} navigate={navigate} />;
  else if (path.page === 'homeworks' && user) content = <Homeworks user={user} navigate={navigate} />;
  else if (path.page === 'students' && path.studentId && ['admin', 'curator'].includes(user?.role)) content = <StudentDetail studentId={path.studentId} currentUser={user} courses={courses} navigate={navigate} />;
  else if (path.page === 'students') content = <main className="account-page"><div className="account-width"><button className="back-link" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> В кабинет</button><div className="dashboard-panel"><h2>Нет доступа к разделу</h2><p>Профили учеников доступны куратору и администратору.</p></div></div></main>;
  else if (path.page === 'course' && error) content = <main className="account-page"><div className="account-width"><button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={17} /> К курсам</button><div className="dashboard-panel"><h2>Не удалось открыть курс</h2><p>{error}</p></div></div></main>;
  else if (path.homework && lesson && course && week && day) content = <LessonHomeworkPage lesson={lesson} course={course} week={week} day={day} user={user} author={author} navigate={navigate} />;
  else if (path.lessonId && course && week && day && lesson) content = <LessonPage key={lesson._id} initial={lesson} course={course} week={week} day={day} user={user} author={author} student={user.role === 'student'} completed={!!progress?.courses.find(item => String(item.courseId) === String(course._id))?.lessons.find(item => String(item._id) === String(lesson._id))?.completed} onCompletion={() => onCompletion(lesson._id, !!progress?.courses.find(item => String(item.courseId) === String(course._id))?.lessons.find(item => String(item._id) === String(lesson._id))?.completed)} navigate={navigate} />;
  else if (path.dayId && course && week && day) content = <DayPage course={course} week={week} day={day} author={author} navigate={navigate} refresh={refresh} showError={setError} />;
  else if (path.weekId && course && week) content = <WeekPage course={course} week={week} author={author} navigate={navigate} refresh={refresh} showError={setError} />;
  else if (path.courseId && course) content = <CoursePage course={course} author={author} navigate={navigate} refresh={refresh} showError={setError} />;
  else content = <Home courses={courses} user={user} progress={progress} navigate={navigate} refresh={refresh} />;

  return <div className="app-shell"><Topbar user={user} navigate={navigate} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />{error && path.page !== 'course' && <div className="global-error"><span>{error}</span><button onClick={() => location.reload()}><RotateCcw size={15} /> Повторить</button><button aria-label="Закрыть" onClick={() => setError('')}><X size={16} /></button></div>}{content}</div>;
}
