import { useCallback, useEffect, useRef, useState } from 'react';
import { put } from '../services/api';

export function useAutosave(initial) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState('saved');
  const latest = useRef(initial);
  const saved = useRef(JSON.stringify(initial));
  const timer = useRef(null);
  const busy = useRef(false);
  const flushRef = useRef(null);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (busy.current || !latest.current) return;
    const snapshot = latest.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === saved.current) { setStatus('saved'); return; }
    busy.current = true;
    setStatus('saving');
    try {
      await put(`/lessons/${snapshot._id}`, { title: snapshot.title, content: snapshot.content, blocks: snapshot.blocks, hasHomework: snapshot.hasHomework });
      saved.current = serialized;
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      busy.current = false;
      if (saved.current !== JSON.stringify(latest.current) && navigator.onLine && serialized === saved.current) {
        timer.current = setTimeout(() => flushRef.current?.(), 750);
      }
    }
  }, []);
  flushRef.current = flush;

  useEffect(() => {
    latest.current = draft;
    if (JSON.stringify(draft) === saved.current) return;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
    return () => clearTimeout(timer.current);
  }, [draft, flush]);

  useEffect(() => {
    const online = () => flushRef.current?.();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);

  return { draft, setDraft, status, retry: flush };
}
