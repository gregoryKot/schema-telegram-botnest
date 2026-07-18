import { useState, useCallback } from 'react';
import { api } from '../../api';
import type { Article } from '../../api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { ArticleEditor } from './ArticleEditor';
import { card, btn, btnGhost } from './shared';

/** Articles admin tab: list with create/edit/delete, backed by the WYSIWYG editor. */
export function ArticlesSection({ adminKey }: { adminKey: string }) {
  const [editing, setEditing] = useState<Article | 'new' | null>(null);

  const fetcher = useCallback(() => api.adminListArticles(adminKey), [adminKey]);
  const { data: articles, reload } = useAsyncData<Article[]>(fetcher, []);

  if (editing) {
    return (
      <ArticleEditor
        adminKey={adminKey}
        article={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); reload(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
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
          <button aria-label="Удалить статью" style={{ ...btnGhost, padding: '5px 12px', fontSize: 13, color: 'var(--accent-red)' }}
            onClick={() => { if (confirm(`Удалить статью «${a.title}»?`)) api.adminDeleteArticle(adminKey, a.id).then(reload); }}>
            ✕
          </button>
        </div>
      ))}
    </section>
  );
}
