import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { MarqueeTopic } from '../../api';
import { card, btn, btnGhost, input } from './shared';

/** Marquee admin tab: edit the two scrolling topic strips on the landing page. */
export function MarqueeSection({ adminKey }: { adminKey: string }) {
  const [a, setA] = useState<MarqueeTopic[]>([]);
  const [b, setB] = useState<MarqueeTopic[]>([]);

  useEffect(() => {
    api.getSiteContent().then(c => { setA(c.marqueeTopicsA); setB(c.marqueeTopicsB); }).catch(() => {});
  }, []);

  return (
    <>
      <TopicListEditor title="Бегущая строка А" adminKey={adminKey} group="A" topics={a} onChange={setA} />
      <TopicListEditor title="Бегущая строка Б" adminKey={adminKey} group="B" topics={b} onChange={setB} />
    </>
  );
}

function TopicListEditor({ title, adminKey, group, topics, onChange }: {
  title: string; adminKey: string; group: 'A' | 'B'; topics: MarqueeTopic[]; onChange: (t: MarqueeTopic[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<MarqueeTopic>) => {
    onChange(topics.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  };
  const remove = (i: number) => onChange(topics.filter((_, idx) => idx !== i));
  const add = () => onChange([...topics, { label: '', href: '#' }]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= topics.length) return;
    const next = [...topics];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.adminSetMarquee(adminKey, group, topics.filter(t => t.label.trim() && t.href.trim()));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>{title}</h2>
      {topics.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <input style={{ ...input, flex: 2 }} placeholder="Текст" value={t.label} onChange={e => update(i, { label: e.target.value })} />
          <input style={{ ...input, flex: 1 }} placeholder="Ссылка (#booking, /reviews...)" value={t.href} onChange={e => update(i, { href: e.target.value })} />
          <button aria-label="Переместить выше" style={{ ...btnGhost, padding: '4px 8px', fontSize: 12 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button aria-label="Переместить ниже" style={{ ...btnGhost, padding: '4px 8px', fontSize: 12 }} onClick={() => move(i, 1)} disabled={i === topics.length - 1}>↓</button>
          <button aria-label="Удалить" style={{ ...btnGhost, padding: '4px 8px', fontSize: 12, color: 'var(--accent-red)' }} onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button style={btnGhost} onClick={add}>+ Добавить пункт</button>
        <button style={btn} onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
      </div>
      {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
      {saved && <p style={{ color: '#4a6335', fontSize: 13, margin: '10px 0 0' }}>Сохранено ✓</p>}
    </section>
  );
}
