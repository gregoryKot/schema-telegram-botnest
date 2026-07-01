import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../api';
import type { ArticleSummary, Article } from '../api';

// ─── Article list page ────────────────────────────────────────────────────────
export function ArticlesListPage() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);

  useEffect(() => {
    document.title = 'Статьи о схема-терапии | schemehappens.ru';
    api.listArticles().then(setArticles).catch(() => setArticles([]));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '64px 40px 96px' }}>
        <a href="/" style={backLink}>← На главную</a>
        <p style={eyebrow}>Статьи</p>
        <h1 style={h1}>Схема-терапия:<br /><span style={{ fontStyle: 'italic' }}>читайте и разбирайтесь</span></h1>
        <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 56px', maxWidth: 560 }}>
          Объясняю, как работают схемы, режимы и паттерны – простым языком, без воды.
        </p>

        {articles === null && <p style={{ color: 'var(--text-faint)' }}>Загрузка…</p>}

        {articles && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {articles.map((a) => (
              <Link key={a.slug} to={`/articles/${a.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '28px 0', borderTop: '1px solid var(--line)',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start',
                  transition: 'opacity .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.7'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--text)', margin: '0 0 10px', letterSpacing: '-.01em', lineHeight: 1.3 }}>
                      {a.title}
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>{a.description}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 4px', whiteSpace: 'nowrap' }}>{a.readMin} мин</p>
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, whiteSpace: 'nowrap' }}>
                      {new Date(a.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
            <div style={{ borderTop: '1px solid var(--line)' }} />
          </div>
        )}

        <div style={{ marginTop: 64, padding: '32px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 10px' }}>Хотите разобраться глубже?</p>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 20px' }}>
            Первая встреча – 15 минут, бесплатно. Расскажете о запросе, я расскажу о подходе.
          </p>
          <a href="/#booking" style={{
            display: 'inline-block', padding: '12px 24px', background: 'var(--accent)', color: 'white',
            borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Записаться →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Single article page ──────────────────────────────────────────────────────
export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    setArticle(undefined);
    api.getArticle(slug)
      .then(setArticle)
      .catch(() => setArticle(null));
  }, [slug]);

  useEffect(() => {
    if (article) document.title = `${article.title} | schemehappens.ru`;
  }, [article]);

  if (article === undefined) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-faint)' }}>Загрузка…</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: '0 0 16px' }}>404</p>
          <a href="/articles" style={{ color: 'var(--accent)' }}>← К статьям</a>
        </div>
      </div>
    );
  }

  const safeHtml = DOMPurify.sanitize(article.content, {
    ALLOWED_TAGS: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 40px 96px' }}>
        <a href="/articles" style={backLink}>← Все статьи</a>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {new Date(article.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{article.readMin} минут чтения</span>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 400, lineHeight: 1.15, margin: '0 0 20px', letterSpacing: '-.01em' }}>
            {article.title}
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0, maxWidth: 600 }}>
            {article.description}
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--line)', margin: '0 0 40px' }} />

        <div className="article-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        <style>{`
          .article-content h2 { font-family: var(--serif); font-size: 26px; font-weight: 400; color: var(--text); margin: 48px 0 16px; padding-top: 40px; border-top: 1px solid var(--line); letter-spacing: -.01em; }
          .article-content h2:first-child { margin-top: 0; padding-top: 0; border-top: none; }
          .article-content h3 { font-family: var(--serif); font-size: 20px; font-weight: 400; color: var(--text); margin: 32px 0 12px; letter-spacing: -.01em; }
          .article-content p { font-size: 15px; color: var(--text-sub); line-height: 1.9; margin: 0 0 12px; }
          .article-content strong { color: var(--text); font-weight: 600; }
          .article-content ul, .article-content ol { padding-left: 20px; margin: 8px 0 16px; }
          .article-content li { font-size: 15px; color: var(--text-sub); line-height: 1.8; margin-bottom: 6px; }
          .article-content hr { border: none; border-top: 1px solid var(--line); margin: 32px 0; }
          .article-content table { width: 100%; border-collapse: collapse; font-size: 14px; color: var(--text-sub); margin: 24px 0; }
          .article-content th { padding: 10px 14px; text-align: left; border-bottom: 2px solid var(--line); font-weight: 700; color: var(--text); font-size: 13px; }
          .article-content td { padding: 10px 14px; border-bottom: 1px solid var(--line); line-height: 1.6; }
          .article-content a { color: var(--accent); }
        `}</style>

        <div style={{ marginTop: 64, padding: '32px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 10px' }}>Разобраться на практике</p>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 20px' }}>
            Первая встреча – 15 минут, бесплатно. Обсудим ваш запрос и я расскажу, как работает схема-терапия в индивидуальном случае.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/#booking" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--accent)', color: 'white', borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Записаться →
            </a>
            <a href="/articles" style={{ display: 'inline-block', padding: '12px 20px', background: 'transparent', border: '1.5px solid var(--line-strong)', color: 'var(--text-sub)', borderRadius: 100, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              Читать ещё
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const backLink: React.CSSProperties = { fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48 };
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' };
const h1: React.CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-.01em' };
