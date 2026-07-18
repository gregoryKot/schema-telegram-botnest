import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../api';
import type { ArticleSummary, Article } from '../api';
import { DIAGRAMS } from './articleDiagrams';

// ─── Article list page ────────────────────────────────────────────────────────
export function ArticlesListPage() {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);

  useEffect(() => {
    document.title = 'Статьи о схема-терапии | schemehappens.ru';
    api.listArticles().then(setArticles).catch(() => setArticles([]));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh', flex: 1, minWidth: 0, overflowX: 'hidden' }}>
      <div className="art-page" style={{ maxWidth: 980, margin: '0 auto' }}>
        <a href="/" style={backLink}>← На главную</a>
        <p style={eyebrow}>Статьи</p>
        <h1 style={h1}>Схема-терапия:<br /><span style={{ fontStyle: 'italic' }}>читайте и разбирайтесь</span></h1>
        <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 48px', maxWidth: 560 }}>
          Объясняю, как работают схемы, режимы и паттерны – простым языком, без воды.
        </p>

        {articles === null && <p style={{ color: 'var(--text-faint)' }}>Загрузка…</p>}

        {articles && (
          <div className="art-grid">
            {articles.map((a) => (
              <Link key={a.slug} to={`/articles/${a.slug}`} className="art-card">
                {a.heroImage
                  ? <img className="art-cover" src={a.heroImage} alt="" loading="lazy" decoding="async" />
                  : <div className="art-cover art-cover-ph" aria-hidden />}
                <div className="art-body">
                  <h2 className="art-title">{a.title}</h2>
                  <p className="art-desc">{a.description}</p>
                  <div className="art-meta">
                    <span>{a.readMin} мин</span>
                    <span>·</span>
                    <span>{new Date(a.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <style>{`
          .art-page { padding: 64px 40px 96px; }
          .art-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
          .art-card { display: flex; flex-direction: column; text-decoration: none; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: var(--surface); transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
          .art-card:hover { transform: translateY(-3px); box-shadow: 0 16px 44px rgba(28,25,20,.10); border-color: var(--line-strong); }
          .art-cover { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; }
          .art-cover-ph { background: linear-gradient(135deg, var(--accent-soft), transparent 62%), var(--surface-2); position: relative; }
          .art-cover-ph::after { content: ''; position: absolute; right: -34px; bottom: -34px; width: 132px; height: 132px; border-radius: 50%; border: 1.5px solid var(--accent-line); }
          .art-cover-ph::before { content: ''; position: absolute; right: 6px; bottom: 6px; width: 72px; height: 72px; border-radius: 50%; border: 1.5px solid var(--accent-line); opacity: .6; }
          .art-body { padding: 20px 22px 22px; display: flex; flex-direction: column; flex: 1; }
          .art-title { font-family: var(--serif); font-size: 22px; font-weight: 400; color: var(--text); margin: 0 0 10px; letter-spacing: -.01em; line-height: 1.25; }
          .art-desc { font-size: 14px; color: var(--text-sub); line-height: 1.6; margin: 0 0 16px; flex: 1; }
          .art-meta { display: flex; gap: 8px; align-items: center; }
          .art-meta span { font-size: 12px; color: var(--text-faint); }
          @media (max-width: 720px) {
            .art-page { padding: 40px 20px 72px; }
            .art-grid { grid-template-columns: 1fr; gap: 20px; }
          }
        `}</style>

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
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
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-faint)' }}>Загрузка…</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: '0 0 16px' }}>404</p>
          <a href="/articles" style={{ color: 'var(--accent)' }}>← К статьям</a>
        </div>
      </div>
    );
  }

  // The diagram lives in its own field (not the editable content), so it's
  // never lost when the article text is edited. Inject it at render time near
  // the MIDDLE of the article (at the paragraph boundary closest to the middle)
  // so it breaks up the text rather than sitting right at the top.
  const diagram = article.diagramKey ? DIAGRAMS[article.diagramKey] : undefined;
  const withDiagram = (() => {
    if (!diagram) return article.content;
    const content = article.content;
    const marker = '</p>';
    const ends: number[] = [];
    for (let i = content.indexOf(marker); i !== -1; i = content.indexOf(marker, i + 1)) {
      ends.push(i + marker.length);
    }
    if (ends.length === 0) return diagram + content;
    const target = content.length / 2;
    const cut = ends.reduce((best, p) => (Math.abs(p - target) < Math.abs(best - target) ? p : best), ends[0]);
    return content.slice(0, cut) + diagram + content.slice(cut);
  })();

  const safeHtml = DOMPurify.sanitize(withDiagram, {
    ALLOWED_TAGS: [
      'h2', 'h3', 'p', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'br',
      // inline diagrams (SVG). No <marker>/<script> — arrowheads are polygons.
      'figure', 'figcaption', 'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'viewBox', 'role', 'aria-label',
      'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
      'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points',
      'transform', 'text-anchor', 'width', 'height', 'opacity', 'font-size',
    ],
  });

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh', flex: 1, minWidth: 0, overflowX: 'hidden' }}>
      <div className="art-page" style={{ maxWidth: 720, margin: '0 auto' }}>
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

        {article.heroImage ? (
          <img src={article.heroImage} alt="" loading="lazy" decoding="async"
            style={{ width: '100%', height: 'auto', maxHeight: 380, objectFit: 'cover', borderRadius: 20, display: 'block', margin: '0 0 44px' }} />
        ) : (
          <div style={{ height: 1, background: 'var(--line)', margin: '0 0 40px' }} />
        )}

        <div className="article-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        <style>{`
          .art-page { padding: 64px 40px 96px; }
          @media (max-width: 640px) { .art-page { padding: 40px 20px 72px; } }
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
          /* ── Inline diagrams ── */
          .article-content figure.dg { margin: 32px 0; padding: 24px 20px 18px; background: var(--accent-soft); border: 1px solid var(--accent-line); border-radius: 20px; }
          .article-content figure.dg svg { display: block; width: 100%; height: auto; }
          .article-content figure.dg figcaption { margin-top: 14px; font-size: 13px; line-height: 1.6; color: var(--text-sub); text-align: center; }
          .article-content figure.dg figcaption b { color: var(--text); font-weight: 600; }
          .dg-node { fill: var(--surface); stroke: var(--accent-line); stroke-width: 1.5; }
          .dg-chip { fill: var(--accent-soft); stroke: none; }
          .dg-accent { fill: var(--accent); stroke: var(--accent); }
          .dg-t { fill: var(--text); font-family: var(--sans); font-weight: 700; font-size: 15px; }
          .dg-t-on { fill: #fff; font-family: var(--sans); font-weight: 700; font-size: 15px; }
          .dg-t-acc { fill: var(--accent); font-family: var(--sans); font-weight: 700; font-size: 14px; }
          .dg-s { fill: var(--text-sub); font-family: var(--sans); font-size: 12px; }
          .dg-s-on { fill: rgba(255,255,255,.86); font-family: var(--sans); font-size: 12px; }
          .dg-cap { fill: var(--text-faint); font-family: var(--sans); font-size: 11.5px; font-weight: 700; letter-spacing: .08em; }
          .dg-cap-acc { fill: var(--accent); font-family: var(--sans); font-size: 11.5px; font-weight: 700; letter-spacing: .08em; }
          .dg-cap-on { fill: rgba(255,255,255,.8); font-family: var(--sans); font-size: 11.5px; font-weight: 700; letter-spacing: .08em; }
          .dg-flow { stroke: var(--accent); stroke-width: 2; fill: none; }
          .dg-flow-soft { stroke: var(--text-faint); stroke-width: 1.6; fill: none; stroke-dasharray: 5 5; }
          .dg-head { fill: var(--accent); }
          .dg-head-soft { fill: var(--text-faint); }
          .dg-lbl { fill: var(--accent); font-family: var(--sans); font-size: 12px; font-weight: 600; }
          .dg-water { fill: var(--accent-soft); }
          .dg-waterline { stroke: var(--accent); stroke-width: 1.5; opacity: .5; }
          .dg-ice { fill: var(--surface); stroke: var(--accent-line); stroke-width: 1.5; }
          .dg-ice-sub { fill: var(--surface); stroke: var(--accent-line); stroke-width: 1.5; opacity: .92; }
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
