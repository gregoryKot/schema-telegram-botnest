import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Article } from '../api';
import { ArticleEditor } from './ArticleEditor';

const KEY_STORE = 'booking_admin_key';

const card: React.CSSProperties = {
  background: 'var(--bg-rail)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16,
};
const btn: React.CSSProperties = {
  padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
};
const btnGhost: React.CSSProperties = {
  ...btn, background: 'transparent', color: 'var(--text-sub)', border: '1.5px solid var(--line-strong)',
};
const input: React.CSSProperties = {
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', background: 'rgba(var(--fg-rgb),0.04)',
  border: '1.5px solid var(--line)', borderRadius: 8, color: 'var(--text)', outline: 'none', width: '100%',
};

export function ArticlesAdminPage() {
  const [key, setKey] = useState<string>(() => localStorage.getItem(KEY_STORE) ?? '');
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Article | 'new' | null>(null);

  const reload = useCallback(async (k: string) => {
    setArticles(await api.adminListArticles(k));
  }, []);

  useEffect(() => {
    if (!key) return;
    reload(key).then(() => setAuthed(true)).catch(() => { setAuthed(false); localStorage.removeItem(KEY_STORE); setKey(''); });
  }, [key, reload]);

  const tryKey = async () => {
    setKeyError(false);
    try {
      await api.adminListArticles(keyInput);
      localStorage.setItem(KEY_STORE, keyInput);
      setKey(keyInput);
    } catch { setKeyError(true); }
  };

  if (!authed) return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'var(--sans)' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)' }}>Админка статей</h1>
      <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>Введите ключ доступа (тот же, что и для админки записи).</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...input, flex: 1 }} type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryKey()} placeholder="Ключ" />
        <button style={btn} onClick={tryKey}>Войти</button>
      </div>
      {keyError && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 8 }}>Неверный ключ</p>}
    </div>
  );

  if (editing) {
    return (
      <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px 80px', fontFamily: 'var(--sans)' }}>
        <ArticleEditor
          adminKey={key}
          article={editing === 'new' ? null : editing}
          onDone={() => { setEditing(null); reload(key); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px 80px', fontFamily: 'var(--sans)' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', marginBottom: 24 }}>Админка статей</h1>
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0, flex: 1 }}>Статьи</h2>
          <button style={btn} onClick={() => setEditing('new')}>+ Новая статья</button>
        </div>
        {articles.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Пока нет статей.</p>}
        {articles.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{a.title}</div>
              <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>/{a.slug} · {a.readMin} мин · {new Date(a.date).toLocaleDateString('ru')}</div>
            </div>
            <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 13 }} onClick={() => setEditing(a)}>Редактировать</button>
            <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 13, color: 'var(--accent-red)' }}
              onClick={() => { if (confirm(`Удалить статью «${a.title}»?`)) api.adminDeleteArticle(key, a.id).then(() => reload(key)); }}>
              ✕
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
