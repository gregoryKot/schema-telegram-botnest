// Обложка статьи — сцена по slug на цветной бумаге (articleCoverModel.ts). Одна на карточку
// лендинга и списка /articles, шапку статьи и превью в админке. Своя сцена приезжает отдельным
// чанком (ArticleSceneArt.tsx, React.lazy): рамка сразу стоит бумагой её оттенка, рисунок
// ложится в неё, когда чанк загрузится. Статья без своей сцены — листы веером сразу.
// Класс light-lock: бумага обложки светлая и при тёмной теме (как BrandMark), иначе токены
// фигур уходят в тёмные. Декор: aria-hidden в самой сцене, смысл несёт заголовок рядом.
import { lazy, Suspense, type CSSProperties } from 'react';
import { articleCoverHue, hasOwnCover } from './articleCoverModel';
import { SceneCover } from './LandingScenesMore';
import '../../styles/article-card.css';

const ArticleSceneArt = lazy(() => import('./ArticleSceneArt'));

/** Рамка обложки: бумага оттенка статьи (--h) и сцена в ней; размеры — класс потребителя. */
export function ArticleCover({ slug, index = 0, className }: { slug: string; index?: number; className: string }) {
  const hue = articleCoverHue(slug, index);
  return (
    <div className={`light-lock ${className}`} style={{ '--h': hue } as CSSProperties}>
      {hasOwnCover(slug)
        ? <Suspense fallback={null}><ArticleSceneArt slug={slug} hue={hue} /></Suspense>
        : <SceneCover tone={index} hue={hue} />}
    </div>
  );
}
