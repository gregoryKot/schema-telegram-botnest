import { useState, type CSSProperties, type ReactElement } from 'react';
import type { ArticleSummary } from '../../api';
import type { ArtProps } from '../../components/art/paper';
import { SignScene } from '../../components/art/SceneParts';
import { SceneCover } from '../../components/art/LandingScenesMore';
import { FAQ } from './productContent';
import { Rich } from './Rich';
import { glue } from './typo';
import { formatDateString, utcCalendarDay } from '../../../../shared/src/utils/calendarDate';

// Карточки продуктового лендинга (плитка со знаком, карточка статьи, FAQ).
// Вид — styles/product-landing*.css; данные — productContent.ts (react-refresh: раздельно).

// ─── Плитка цветной бумаги (оттенок `hue`), знак кабинета крупно с тенью-вырезкой ──
export function InfoCard({ Art, hue, title, children }: { Art: (p: ArtProps) => ReactElement; hue: number; title: string; children: React.ReactNode }) {
  return (
    <div className="pp-paper pl2-tile" style={{ '--h': hue } as CSSProperties}>
      <div className="pl2-tile-art"><SignScene Art={Art} /></div>
      <div className="pl2-tile-body"><p className="pl2-tile-title">{glue(title)}</p><p className="pl2-tile-text">{children}</p></div>
    </div>
  );
}

// ─── Карточка статьи: обложка или, без неё, листы веером — тон и набор по порядку ──
const articleHue = (index: number) => [135, 45, 240][index % 3];
export function ArticleCard({ a, index = 0 }: { a: ArticleSummary; index?: number }) {
  return (
    <a className="ds-card ds-card--flush ds-card--hover pl2-article" href={`/articles/${a.slug}`}>
      <div className="pl2-article-img" style={{ '--h': articleHue(index) } as CSSProperties}>
        {a.heroImage ? <img src={a.heroImage} alt="" loading="lazy" decoding="async" /> : <SceneCover tone={index} hue={articleHue(index)} />}
      </div>
      <div className="pl2-article-body">
        <p className="pl2-article-title">{glue(a.title)}</p>
        <p className="pl2-article-desc">{glue(a.description)}</p>
        <span className="pl2-article-meta">{formatDateString(utcCalendarDay(a.date), { day: 'numeric', month: 'long' })} · {a.readMin} мин</span>
      </div>
    </a>
  );
}

export function FaqList() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="pl2-faq">
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`pl2-faq-item${isOpen ? ' is-open' : ''}`}>
            <button className="pl2-faq-q" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
              <span>{glue(item.q)}</span>
              <span className="pl2-faq-plus" aria-hidden>+</span>
            </button>
            <div className="pl2-faq-a">
              <div>
                <p><Rich parts={item.a} place="faq" /></p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
