import { useState, type CSSProperties, type ReactElement } from 'react';
import type { ArticleSummary } from '../../api';
import type { ArtProps } from '../../components/art/paper';
import { Sheets } from '../../components/art/PaperArt';
import { FAQ } from './productContent';
import { Rich } from './Rich';

// Карточки продуктового лендинга (знак на цветной бумаге, карточка статьи, FAQ).
// Вид — styles/product-landing.css; данные — productContent.ts (react-refresh: раздельно).

// ─── Квадрат цветной бумаги со знаком (оттенок `hue`), под ним слой тени ─────
export function InfoCard({ Art, hue, title, children }: { Art: (p: ArtProps) => ReactElement; hue: number; title: string; children: React.ReactNode }) {
  return (
    <div className="pp-paper pl2-card pl2-card--paper" style={{ '--h': hue } as CSSProperties}>
      <Art size="square" />
      <p className="pl2-card-title">{title}</p>
      <p className="pl2-card-text">{children}</p>
    </div>
  );
}

// ─── Карточка статьи: обложка или, без неё, листы (Sheets) на бумаге по очереди ──
const articleHue = (index: number) => [135, 45, 240][index % 3];
export function ArticleCard({ a, index = 0 }: { a: ArticleSummary; index?: number }) {
  return (
    <a className="ds-card ds-card--flush ds-card--hover pl2-article" href={`/articles/${a.slug}`}>
      <div className="pl2-article-img" style={{ '--h': articleHue(index) } as CSSProperties}>
        {a.heroImage ? <img src={a.heroImage} alt="" loading="lazy" decoding="async" /> : <Sheets size="hero" />}
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
