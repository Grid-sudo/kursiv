import { useEffect, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';

export function EditableTitle({ value, onSave, readOnly, className = '', placeholder = 'Название' }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (readOnly) return <h1 className={className}>{value}</h1>;
  return <input className={`editable-title ${className}`} aria-label={placeholder} value={text} placeholder={placeholder} onChange={event => setText(event.target.value)} onBlur={() => { if (text.trim() && text !== value) onSave(text.trim()); else setText(value); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

export function InlineCreator({ placeholder, onSubmit, label, onCancel, description = false }) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="inline-creator" onSubmit={async event => { event.preventDefault(); if (!title.trim()) return; setBusy(true); setError(''); try { await onSubmit(title.trim(), detail.trim()); setTitle(''); setDetail(''); onCancel?.(); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>
    <input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
    {description && <input value={detail} onChange={event => setDetail(event.target.value)} placeholder="Короткое описание (необязательно)" aria-label="Описание" />}
    <div className="creator-actions"><button className="primary-button" type="submit" disabled={!title.trim() || busy}>{busy ? 'Создаём…' : label}</button><button className="text-button" type="button" onClick={onCancel}>Отмена</button></div>
    {error && <p className="inline-error">{error}</p>}
  </form>;
}
export function BreadCrumbs({ items, navigate }) { return <div className="breadcrumbs">{items.map((item, index) => <span key={index}>{index > 0 && <ChevronRight size={15} />}{item.href ? <button onClick={() => navigate(item.href)}>{item.label}</button> : <span className="current-crumb">{item.label}</span>}</span>)}</div>; }

export function AddTile({ label, onClick }) { return <button className="add-tile" onClick={onClick}><span><Plus size={22} /></span><strong>{label}</strong></button>; }
