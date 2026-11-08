// Обложка статьи — сцена по slug на цветной бумаге (articleCoverModel.ts). Одна на карточку
// лендинга и списка /articles, шапку статьи и превью в админке. Класс light-lock: бумага
// обложки светлая и при тёмной теме (как BrandMark), иначе токены фигур уходят в тёмные.
// Декор: aria-hidden в самой сцене, смысл несёт заголовок рядом.
import type { CSSProperties } from 'react';
import { articleCoverHue, articleCoverLook } from './articleCoverModel';
import { SceneCover } from './LandingScenesMore';
import '../../styles/article-card.css';

/** Только картинка: своя сцена статьи или листы веером по порядку карточки (`index`). */
export function ArticleCoverArt({ slug, index = 0 }: { slug: string; index?: number }) {
  const look = articleCoverLook(slug);
  const hue = articleCoverHue(slug, index);
  return look ? <look.Scene hue={hue} /> : <SceneCover tone={index} hue={hue} />;
}

/** Рамка обложки: бумага оттенка статьи (--h) и сцена в ней; размеры — класс потребителя. */
export function ArticleCover({ slug, index = 0, className }: { slug: string; index?: number; className: string }) {
  return (
    <div className={`light-lock ${className}`} style={{ '--h': articleCoverHue(slug, index) } as CSSProperties}>
      <ArticleCoverArt slug={slug} index={index} />
    </div>
  );
}
