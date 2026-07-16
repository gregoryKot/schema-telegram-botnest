import { useState, useEffect } from 'react';
import { api } from '../api';
import { BookingSection } from './admin/BookingSection';
import { ArticlesSection } from './admin/ArticlesSection';
import { PhotoSection } from './admin/PhotoSection';
import { MarqueeSection } from './admin/MarqueeSection';
import { HealthyAdultSection } from './admin/HealthyAdultSection';
import { btn, input } from './admin/shared';

const KEY_STORE = 'booking_admin_key';

type Tab = 'booking' | 'articles' | 'photo' | 'marquee' | 'healthyAdult';
const TABS: { id: Tab; label: string }[] = [
  { id: 'booking', label: 'Запись' },
  { id: 'articles', label: 'Статьи' },
  { id: 'photo', label: 'Фото' },
  { id: 'marquee', label: 'Бегущая строка' },
  { id: 'healthyAdult', label: 'Канал ЗВ' },
];

/** Single admin panel for the whole site — one key, tabbed sections. */
export function AdminPage() {
  const [key, setKey] = useState<string>(() => localStorage.getItem(KEY_STORE) ?? '');
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [tab, setTab] = useState<Tab>('booking');

  useEffect(() => {
    if (!key) return;
    api.adminStatus(key).then(() => setAuthed(true)).catch(() => { setAuthed(false); localStorage.removeItem(KEY_STORE); setKey(''); });
  }, [key]);

  const tryKey = async () => {
    setKeyError(false);
    try {
      await api.adminStatus(keyInput);
      localStorage.setItem(KEY_STORE, keyInput);
      setKey(keyInput);
    } catch { setKeyError(true); }
  };

  if (!authed) return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'var(--sans)' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)' }}>Админка</h1>
      <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>Введите ключ доступа (ADMIN_BOOKING_KEY).</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...input, flex: 1 }} type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryKey()} placeholder="Ключ" />
        <button style={btn} onClick={tryKey}>Войти</button>
      </div>
      {keyError && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 8 }}>Неверный ключ</p>}
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px 80px', fontFamily: 'var(--sans)' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', marginBottom: 20 }}>Админка</h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 100,
            background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-sub)',
            border: `1.5px solid ${tab === t.id ? 'var(--accent)' : 'var(--line-strong)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'booking' && <BookingSection adminKey={key} />}
      {tab === 'articles' && <ArticlesSection adminKey={key} />}
      {tab === 'photo' && <PhotoSection adminKey={key} />}
      {tab === 'marquee' && <MarqueeSection adminKey={key} />}
      {tab === 'healthyAdult' && <HealthyAdultSection adminKey={key} />}
    </div>
  );
}
