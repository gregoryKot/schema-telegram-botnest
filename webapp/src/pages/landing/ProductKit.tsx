import { useState, type CSSProperties, type ReactElement } from 'react';
import type { ArtProps } from '../../components/art/paper';
import { SignScene } from '../../components/art/SceneParts';
import { FAQ } from './productContent';
import { Rich } from './Rich';
import { glue } from '../../../../shared/src/utils/typo';

// Карточки продуктового лендинга (плитка со знаком, FAQ); карточка статьи — ArticleCard.tsx.
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
