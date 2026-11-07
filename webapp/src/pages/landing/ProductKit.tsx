import { useState, type CSSProperties, type ReactElement } from 'react';
import type { ArticleSummary } from '../../api';
import type { ArtProps } from '../../components/art/paper';
import { FAQ } from './productContent';
import { Rich } from './Rich';

// Карточки продуктового лендинга (знак + заголовок + текст, карточка статьи,
// FAQ). Вид — styles/product-landing.css и ds-card кабинета; данные — в
// productContent.ts (react-refresh: раздельно).

// ─── Карточка со знаком: белая (ds-card) или цветная бумага (`hue`) ─────────
export function InfoCard({ Art, hue, title, children }: { Art: (p: ArtProps) => ReactElement; hue?: number; title: string; children: React.ReactNode }) {
  const paper = hue !== undefined;
  return (
    <div
      className={paper ? 'pp-paper pl2-card pl2-card--paper' : 'ds-card pl2-card'}
      style={paper ? ({ '--h': hue } as CSSProperties) : undefined}
    >
      <Art size="square" />
      <p className="pl2-card-title">{title}</p>
      <p className="pl2-card-text">{children}</p>
    </div>
  );
}

// ─── Карточка статьи ──────────────────────────────────────────────────────────
export function ArticleCard({ a }: { a: ArticleSummary }) {
  return (
    <a className="ds-card ds-card--flush ds-card--hover pl2-article" href={`/articles/${a.slug}`}>
      <div className="pl2-article-img">
        {a.heroImage && <img src={a.heroImage} alt="" loading="lazy" decoding="async" />}
      </div>
      <div className="pl2-article-body">
        <p className="pl2-article-title">{a.title}</p>
        <p className="pl2-article-desc">{a.description}</p>
        <span className="pl2-article-meta">{new Date(a.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · {a.readMin} мин</span>
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
              <span>{item.q}</span>
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
