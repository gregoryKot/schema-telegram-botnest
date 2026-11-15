// Силуэты загрузки /articles и статьи (pages/ArticlesPage.tsx) — по форме контента, а не текст «Загрузка…»:
// карточки — рамка ArticleCard и обложка той же пропорции (правило .ac-cover, .ac-skel-cover в
// styles/article-card.css), статья — шапка, обложка рамки .ac-cover--hero и начало текста.
import { Skeleton, SkeletonLines } from '../components/Skeleton';

/** Сетка списка: карточки с обложкой, заголовком в две строки, подписью и датой. */
export function ArticleGridSkeleton() {
  return (
    <div className="art-grid" aria-hidden="true" data-testid="articles-skeleton">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="ds-card ds-card--flush ac-card">
          <Skeleton className="ac-skel-cover" height="auto" radius={0} />
          <div className="ac-body">
            <SkeletonLines widths={['84%', '52%']} height={18} gap={7} />
            <SkeletonLines widths={['96%', '70%']} />
            <Skeleton width={120} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Статья: дата, заголовок, подпись, обложка шапки и первые строки текста. */
export function ArticleSkeleton() {
  return (
    <div aria-hidden="true" data-testid="article-skeleton">
      <div className="pp-block pp-block--head art-head">
        <Skeleton width={200} height={12} />
        <SkeletonLines widths={['94%', '62%']} height={36} gap={14} />
        <SkeletonLines widths={['96%', '58%']} height={14} gap={13} />
      </div>
      <Skeleton className="ac-skel-hero" height="auto" radius={20} />
      <SkeletonLines widths={['100%', '97%', '99%', '64%']} gap={16} />
    </div>
  );
}
