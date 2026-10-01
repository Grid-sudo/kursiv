import { useState } from 'react';
import { ArrowLeft, CircleHelp, FileText, Folder, FolderOpen } from 'lucide-react';
import { route } from '../services/navigation';

const toggleItem = (setOpen, id) => setOpen(current => {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
});

export default function LessonSidebar({ course, week, day, lesson, navigate }) {
  const [openWeeks, setOpenWeeks] = useState(() => new Set([week._id]));
  const [openDays, setOpenDays] = useState(() => new Set([day._id]));

  return <aside className="lesson-sidebar">
    <div className="sidebar-course">
      <button onClick={() => navigate(route(course._id))}><ArrowLeft size={17} /> К курсу</button>
      <strong>{course.title}</strong>
    </div>
    <div className="sidebar-label">СОДЕРЖАНИЕ КУРСА</div>
    <div className="sidebar-tree">
      {course.weeks.map((item, wi) => {
        const weekOpen = openWeeks.has(item._id);
        return <div className="sidebar-tree-folder" key={item._id}>
          <div className="sidebar-tree-folder-row">
            <button className={`sidebar-week ${item._id === week._id ? 'selected' : ''}`} aria-expanded={weekOpen} onClick={() => toggleItem(setOpenWeeks, item._id)}>
              <span>{String(wi + 1).padStart(2, '0')}</span>
              {weekOpen ? <FolderOpen size={18} /> : <Folder size={18} />}
              <span className="sidebar-tree-title">{item.title}</span>
            </button>
          </div>
          {weekOpen && <div className="sidebar-tree-children">
            {item.days.map((entry, di) => {
              const dayOpen = openDays.has(entry._id);
              return <div className="sidebar-tree-folder" key={entry._id}>
                <div className="sidebar-tree-folder-row">
                  <button className={`sidebar-day ${entry._id === day._id ? 'selected' : ''}`} aria-expanded={dayOpen} onClick={() => toggleItem(setOpenDays, entry._id)}>
                    <span>{String(di + 1).padStart(2, '0')}</span>
                    {dayOpen ? <FolderOpen size={17} /> : <Folder size={17} />}
                    <span className="sidebar-tree-title">{entry.title}</span>
                  </button>
                </div>
                {dayOpen && <div className="sidebar-tree-lessons">
                  {entry.lessons.map((lessonItem, li) => <button key={lessonItem._id} className={`sidebar-lesson ${lessonItem._id === lesson._id ? 'active' : ''}`} onClick={() => navigate(route(course._id, item._id, entry._id, lessonItem._id))}>
                    <FileText size={15} /><span className="sidebar-lesson-number">{li + 1}.</span><span className="sidebar-tree-title">{lessonItem.title}</span>
                  </button>)}
                </div>}
              </div>;
            })}
          </div>}
        </div>;
      })}
    </div>
    <div className="sidebar-help"><CircleHelp size={19} /><span>Учитесь в своём темпе. Ваш прогресс всегда под рукой.</span></div>
  </aside>;
}
