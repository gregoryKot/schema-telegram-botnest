// Карточка статьи — одна на лендинг (три свежие) и список /articles: обложка-сцена статьи
// (components/art/ArticleCover.tsx), заголовок, подпись, дата и время чтения. Вид — styles/article-card.css.
// До 2026-11 у списка была своя карточка с фото или серой плашкой с кругами — вторая копия.
import { Link } from 'react-router-dom';
import type { ArticleSummary } from '../../api';
import { ArticleCover } from '../../components/art/ArticleCover';
import { glue } from '../../../../shared/src/utils/typo';
import { formatDateString, utcCalendarDay } from '../../../../shared/src/utils/calendarDate';

interface ArticleCardProps {
  a: ArticleSummary;
  /** Порядок карточки: бумага и листы обложки у статьи без своей сцены. */
  index?: number;
  /** Заголовок карточки: h2 в списке статей, абзац — в секции лендинга под своим h2. */
  titleAs?: 'h2' | 'p';
  /** Год в дате: в полном списке статьи за разные годы, на лендинге — только свежие. */
  withYear?: boolean;
}

export function ArticleCard({ a, index = 0, titleAs: Title = 'p', withYear = false }: ArticleCardProps) {
  const date = formatDateString(utcCalendarDay(a.date), { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) });
  return (
    <Link className="ds-card ds-card--flush ds-card--hover ac-card" to={`/articles/${a.slug}`}>
      <ArticleCover slug={a.slug} index={index} className="ac-cover" />
      <div className="ac-body">
        <Title className="ac-title">{glue(a.title)}</Title>
        <p className="ac-desc">{glue(a.description)}</p>
        <span className="ac-meta">{date} · {a.readMin} мин</span>
      </div>
    </Link>
  );
}
