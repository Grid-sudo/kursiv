import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowDown, ArrowUp, Check, ChevronDown, ExternalLink, FileText, GripVertical, Image as ImageIcon, Link2, ListChecks, MoreHorizontal, Plus, Trash2, Type, Video, X } from 'lucide-react';
import { remove, uploadFile } from '../services/api';

const options = [
  { type: 'text', label: 'Текст', icon: Type },
  { type: 'heading', label: 'Заголовок', icon: Type },
  { type: 'image', label: 'Изображение', icon: ImageIcon },
  { type: 'video', label: 'Видео', icon: Video },
  { type: 'document', label: 'Документ', icon: FileText },
  { type: 'link', label: 'Ссылка', icon: Link2 },
  { type: 'list', label: 'Список', icon: ListChecks },
  { type: 'divider', label: 'Разделитель', icon: MoreHorizontal }
];

const youtubeEmbed = value => {
  try {
    const url = new URL(value);
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) id = url.searchParams.get('v') || (url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : '') || (url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : '');
    return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
};
const safeUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const createBlockId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map((byte, index) => `${[4, 6, 8, 10].includes(index) ? '-' : ''}${byte.toString(16).padStart(2, '0')}`).join('');
  }
  return `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

function FilePicker({ accept, label, icon: Icon, onFile, hint }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const handle = file => { if (file) onFile(file); };
  return <div className={`file-picker ${dragging ? 'is-dragging' : ''}`} tabIndex={0}
    onClick={() => input.current?.click()}
    onKeyDown={event => { if (event.key === 'Enter') input.current?.click(); }}
    onDragOver={event => { event.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={event => { event.preventDefault(); setDragging(false); handle(event.dataTransfer.files[0]); }}
    onPaste={event => { const file = [...event.clipboardData.files][0]; if (file) { event.preventDefault(); handle(file); } }}>
    <input ref={input} type="file" accept={accept} hidden onChange={event => { handle(event.target.files[0]); event.target.value = ''; }} />
    <span className="file-picker-icon"><Icon size={25} /></span>
    <strong>{label}</strong><small>{hint}</small>
  </div>;
}

function MediaBlock({ block, onChange, readOnly }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async file => {
    const desired = block.type === 'image' ? 'image/' : block.type === 'video' ? 'video/' : null;
    if ((desired && !file.type.startsWith(desired)) || (block.type === 'document' && !['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type))) {
      setError('Этот тип файла не подходит для блока'); return;
    }
    setError(''); setBusy(true);
    const preview = block.type === 'image' ? URL.createObjectURL(file) : '';
    if (preview) onChange({ content: preview, metadata: { ...block.metadata, name: file.name } });
    try {
      const result = await uploadFile(file);
      if (preview) URL.revokeObjectURL(preview);
      onChange({ content: result.url, metadata: { ...block.metadata, name: result.name, uploadId: result.id, alt: block.metadata?.alt || '' } });
    } catch (uploadError) {
      if (preview) { URL.revokeObjectURL(preview); onChange({ content: '' }); }
      setError(uploadError.message);
    } finally { setBusy(false); }
  };

  if (block.type === 'image') return <div className="media-content">
    {block.content ? <figure className="lesson-image"><img src={block.content} alt={block.metadata?.alt || 'Изображение урока'} />{!readOnly && <button className="image-change" onClick={() => document.getElementById(`replace-${block.id}`)?.click()}>Заменить изображение</button>}</figure> : !readOnly && <FilePicker accept="image/*" icon={ImageIcon} label="Добавить изображение" hint="Нажмите или перетащите файл сюда · можно вставить из буфера" onFile={upload} />}
    {!readOnly && <input id={`replace-${block.id}`} type="file" accept="image/*" hidden onChange={event => upload(event.target.files[0])} />}
    {!readOnly && block.content && <input className="caption-input" aria-label="Описание изображения" placeholder="Описание изображения (необязательно)" value={block.metadata?.alt || ''} onChange={event => onChange({ metadata: { ...block.metadata, alt: event.target.value } })} />}
    {busy && <div className="inline-note">Загружаем файл…</div>}{error && <div className="inline-error">{error}</div>}
  </div>;

  if (block.type === 'document') return <div className="media-content">
    {block.content ? <a className="document-card" href={block.content} target="_blank" rel="noreferrer"><span className="document-icon"><FileText size={27} /></span><span><strong>{block.metadata?.name || 'Документ'}</strong><small>Открыть документ</small></span><ExternalLink size={19} /></a> : !readOnly && <FilePicker accept=".pdf,.docx" icon={FileText} label="Добавить документ" hint="PDF или DOCX · до 100 МБ" onFile={upload} />}
    {busy && <div className="inline-note">Загружаем файл…</div>}{error && <div className="inline-error">{error}</div>}
  </div>;

  const embed = youtubeEmbed(block.content);
  const videoUrl = block.content.startsWith('/uploads/') || block.content.startsWith('blob:') ? block.content : safeUrl(block.content);
  return <div className="media-content">
    {block.content && (embed ? <div className="video-frame"><iframe src={embed} title="Видео урока" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : /\.(mp4|webm)(\?|$)/i.test(videoUrl) ? <video className="video-native" src={videoUrl} controls /> : <a className="video-link" href={videoUrl} target="_blank" rel="noreferrer"><Video size={24} /> Открыть видео <ExternalLink size={17} /></a>)}
    {!readOnly && <div className="video-controls"><label htmlFor={`video-url-${block.id}`}>Ссылка на YouTube или видео</label><input id={`video-url-${block.id}`} value={block.content.startsWith('/uploads/') ? '' : block.content} placeholder="https://youtube.com/watch?v=..." onChange={event => onChange({ content: event.target.value })} /><span>или</span><FilePicker accept="video/mp4,video/webm" icon={Video} label="Загрузить видео" hint="MP4 или WebM · до 100 МБ" onFile={upload} /></div>}
    {busy && <div className="inline-note">Загружаем видео…</div>}{error && <div className="inline-error">{error}</div>}
  </div>;
}

function Block({ block, readOnly, onChange, onRemove, onMove, first, last }) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const renderText = () => {
    if (!readOnly && (editing || !block.content)) return <textarea autoFocus className={`block-input block-input-${block.type}`} rows={block.type === 'heading' ? 2 : 4} value={block.content} placeholder={block.type === 'heading' ? 'Напишите заголовок…' : block.type === 'list' ? 'Каждый пункт с новой строки…' : 'Начните писать…'} onChange={event => onChange({ content: event.target.value })} onBlur={() => setEditing(false)} />;
    if (block.type === 'heading') return <h2 onClick={() => !readOnly && setEditing(true)}>{block.content || 'Заголовок'}</h2>;
    if (block.type === 'list') return <ul className="lesson-list" onClick={() => !readOnly && setEditing(true)}>{block.content.split('\n').filter(Boolean).map((line, index) => <li key={index}>{line}</li>)}</ul>;
    return <div className="markdown-content" onClick={() => !readOnly && setEditing(true)}><ReactMarkdown>{block.content}</ReactMarkdown></div>;
  };
  return <div className={`lesson-block block-${block.type}`}>
    {!readOnly && <div className="block-tools"><span className="drag-hint"><GripVertical size={18} /></span><button className="tool-menu-button" title="Действия с блоком" aria-label="Действия с блоком" onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>{menu && <div className="block-menu"><button disabled={first} onClick={() => { onMove(-1); setMenu(false); }}><ArrowUp size={16} /> Поднять</button><button disabled={last} onClick={() => { onMove(1); setMenu(false); }}><ArrowDown size={16} /> Опустить</button><button className="danger" onClick={() => { onRemove(); setMenu(false); }}><Trash2 size={16} /> Удалить</button></div>}</div>}
    {['text', 'heading', 'list'].includes(block.type) ? renderText() : block.type === 'divider' ? <hr className="lesson-divider" /> : ['image', 'video', 'document'].includes(block.type) ? <MediaBlock block={block} onChange={onChange} readOnly={readOnly} /> : <div className="link-block">{!readOnly && <div className="link-fields"><input aria-label="Название ссылки" placeholder="Название ссылки" value={block.metadata?.label || ''} onChange={event => onChange({ metadata: { ...block.metadata, label: event.target.value } })} /><input aria-label="Адрес ссылки" placeholder="https://..." value={block.content} onChange={event => onChange({ content: event.target.value })} /></div>}{safeUrl(block.content) && <a href={safeUrl(block.content)} target="_blank" rel="noreferrer" className="resource-link"><span className="resource-link-icon"><Link2 size={20} /></span><strong>{block.metadata?.label || 'Полезная ссылка'}</strong><ExternalLink size={18} /></a>}</div>}
  </div>;
}

export default function BlockEditor({ blocks, onChange, readOnly }) {
  const [adding, setAdding] = useState(false);
  const add = type => {
    const block = { id: createBlockId(), type, content: '', order: blocks.length, metadata: {} };
    onChange([...blocks, block]); setAdding(false);
  };
  const change = (id, patch) => onChange(blocks.map(item => item.id === id ? { ...item, ...patch } : item));
  const discard = async block => {
    onChange(blocks.filter(item => item.id !== block.id).map((item, index) => ({ ...item, order: index })));
    if (block.metadata?.uploadId) remove(`/upload/${block.metadata.uploadId}`).catch(() => {});
  };
  const move = (index, direction) => {
    const next = [...blocks];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next.map((item, order) => ({ ...item, order })));
  };
  return <div className="blocks-area">
    {blocks.map((block, index) => <Block key={block.id} block={block} readOnly={readOnly} onChange={patch => change(block.id, patch)} onRemove={() => discard(block)} onMove={direction => move(index, direction)} first={index === 0} last={index === blocks.length - 1} />)}
    {!readOnly && <div className="add-block-wrap"><button className="add-block-button" onClick={() => setAdding(!adding)}><Plus size={20} /> Добавить блок <ChevronDown size={17} className={adding ? 'rotated' : ''} /></button>{adding && <div className="block-picker"><div className="block-picker-head"><span>Выберите блок</span><button aria-label="Закрыть" onClick={() => setAdding(false)}><X size={18} /></button></div><div className="block-picker-grid">{options.map(({ type, label, icon: Icon }) => <button key={type} onClick={() => add(type)}><Icon size={21} /><span>{label}</span></button>)}</div></div>}</div>}
  </div>;
}
