// Оглавление юридического документа (b28): пункты — заголовки глав (LegalTocModel.ts), ссылки — на якоря.
// На ≥1100 — липкая колонка справа от текста (список виден всегда, кнопки нет); уже — свёрнуто под вводной
// частью и раскрывается тапом (кнопка с aria-expanded), не наведением. Своя подпись одна — «Содержание».
import { useState } from 'react';
import type { TocItem } from './LegalTocModel';

export function LegalToc({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <nav className="lg-toc" aria-label="Содержание" data-legal-toc="">
      <button type="button" className="lg-toc-toggle" aria-expanded={open} aria-controls="lg-toc-list" onClick={() => setOpen((v) => !v)}>
        Содержание<span className="lg-toc-chevron" aria-hidden="true" />
      </button>
      <p className="lg-toc-head" aria-hidden="true">Содержание</p>
      <ol id="lg-toc-list" className={open ? 'lg-toc-list is-open' : 'lg-toc-list'}>
        {items.map((it) => (
          <li key={it.id}><a href={`#${it.id}`} className="lg-toc-link" onClick={() => setOpen(false)}>{it.label}</a></li>
        ))}
      </ol>
    </nav>
  );
}
