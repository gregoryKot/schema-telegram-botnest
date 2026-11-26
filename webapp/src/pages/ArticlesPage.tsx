import { useEffect, useCallback, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api, ApiError } from '../api';
import type { ArticleSummary, Article } from '../api';
import { useAsyncData } from '../hooks/useAsyncData';
import { DIAGRAMS } from './articleDiagrams';
import { PRACTICE_BOOKING_URL } from './landing/constants';
import { siteTitleSuffix } from '../utils/domainChrome';
import { Btn } from '../components/landing-kit';
import { ArticleCover } from '../components/art/ArticleCover';
import { ArticleCard } from './landing/ArticleCard';
import { ArticleGridSkeleton, ArticleSkeleton } from './ArticleSkeletons';
import { backLink } from '../legal/legalStyles';
import { formatDateString, utcCalendarDay } from '../../../shared/src/utils/calendarDate';
import '../styles/article-card.css';
import '../styles/article-body.css';
// Шапки и лист записи — бумажные примитивы (pp-block, ds-eyebrow, ds-h1), раскладка — styles/article-card.css.

/** Лист записи под списком и под статьёй: блок между линиями — главное действие страницы. */
function BookCta({ label, text, more = false }: { label: string; text: string; more?: boolean }) {
  return (
    <section className="pp-block art-cta">
      <div className="ds-eyebrow">{label}</div>
      <p className="art-text">{text}</p>
      <div className="art-cta-actions">
        <Btn href={PRACTICE_BOOKING_URL} newTab={false}>Записаться →</Btn>
        {more && <Btn variant="ghost" href="/articles">Читать ещё</Btn>}
      </div>
    </section>
  );
}

// ─── Article list page ────────────────────────────────────────────────────────
export function ArticlesListPage() {
  // Сбой ≠ пусто: раньше `.catch(() => setArticles([]))` рисовал читателю со
  // слабой сетью пустую сетку — как будто статей на сайте нет.
  const listFetcher = useCallback(() => api.listArticles(), []);
  const { data: articles, reload, failed } = useAsyncData<ArticleSummary[] | null>(listFetcher, null);

  useEffect(() => {
    document.title = `Статьи о схема-терапии | ${siteTitleSuffix()}`;
  }, []);

  return (
    <div className="art-root">
      <div className="art-page">
        <a href="/" style={backLink}>← На главную</a>
        <header className="pp-block pp-block--head art-head">
          <div className="ds-eyebrow">Статьи</div>
          <h1 className="ds-h1">Схема-терапия:<br /><i>читайте и разбирайтесь</i></h1>
          <p className="art-text">Объясняю, как работают схемы, режимы и паттерны – простым языком.</p>
        </header>

        {failed ? (
          <div role="alert" className="art-alert">
            <p className="art-text">Не удалось загрузить статьи. Проверьте соединение.</p>
            <Btn onClick={() => { void reload(); }}>Попробовать ещё раз</Btn>
          </div>
        ) : articles === null ? <ArticleGridSkeleton /> : (
          <div className="art-grid">
            {articles.map((a, i) => <ArticleCard key={a.slug} a={a} index={i} titleAs="h2" withYear />)}
          </div>
        )}

        <BookCta label="Хотите разобраться глубже?" text="Первая встреча – 15 минут, бесплатно. Расскажете о запросе, я расскажу о подходе." />
      </div>
    </div>
  );
}

// ─── Single article page ──────────────────────────────────────────────────────
/** Колонка статьи с «← Все статьи» — одна на загрузку и на текст: силуэт стоит там же, где статья. */
function ReadFrame({ children }: { children: ReactNode }) {
  return (
    <div className="art-root">
      <div className="art-page art-page--read">
        <a href="/articles" style={backLink}>← Все статьи</a>
        {children}
      </div>
    </div>
  );
}

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  // resetKey=slug → back to the loading state (undefined) on navigation between
  // articles. null = настоящий 404 от сервера. Любой другой отказ (сеть, 5xx)
  // пробрасывается в хук и поднимает `failed`: раньше `.catch(() => null)`
  // превращал обрыв сети в экран «404» на существующей статье. Ветвление по
  // ApiError.status, не по тексту message — текст теперь может приходить с
  // сервера и меняться.
  const articleFetcher = useCallback(
    (): Promise<Article | null | undefined> =>
      slug
        ? api.getArticle(slug).catch((err: unknown) => {
            if (err instanceof ApiError && err.status === 404) return null;
            throw err;
          })
        : Promise.resolve(undefined),
    [slug],
  );
  const { data: article, reload, failed } = useAsyncData<Article | null | undefined>(articleFetcher, undefined, slug);

  useEffect(() => {
    if (article) document.title = `${article.title} | ${siteTitleSuffix()}`;
  }, [article]);

  if (failed) {
    return (
      <div className="art-root art-center">
        <div role="alert" className="art-alert">
          <p className="art-text">Не удалось загрузить статью. Проверьте соединение.</p>
          <Btn onClick={() => { void reload(); }}>Попробовать ещё раз</Btn>
        </div>
      </div>
    );
  }

  if (article === undefined) return <ReadFrame><ArticleSkeleton /></ReadFrame>;

  if (!article) {
    return (
      <div className="art-root art-center">
        <div className="art-alert">
          <p className="art-404">404</p>
          <a href="/articles" className="u-accent">← К статьям</a>
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
    <ReadFrame>
      <header className="pp-block pp-block--head art-head">
        <p className="art-meta">
          <span>{formatDateString(utcCalendarDay(article.date), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span aria-hidden="true">·</span>
          <span>{article.readMin} минут чтения</span>
        </p>
        <h1 className="ds-h1">{article.title}</h1>
        <p className="art-text">{article.description}</p>
      </header>

      <ArticleCover slug={article.slug} className="ac-cover ac-cover--hero" />

      <div className="article-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />

      <BookCta label="Разобраться на практике" text="Первая встреча – 15 минут, бесплатно. Обсудим ваш запрос, и я расскажу, как схема-терапия работает в вашем случае." more />
    </ReadFrame>
  );
}
