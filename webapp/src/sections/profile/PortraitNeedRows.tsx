// Пять строк потребностей в листе «Мой портрет»: те же полосы, что на карточке.
// Тап по строке раскрывает объяснение потребности — готовый текст
// NEEDS_EXPLAINER (shared/about), третью формулировку не пишем. Аккордеон:
// раскрыта одна строка, кнопка ≥44px по высоте.
import { useState } from 'react';
import { NEED_EXPLAINER_TEXT } from '../../../../shared/src/portrait/portraitTexts';
import type { PortraitNeed } from '../../../../shared/src/portrait/portraitData';
import { PortraitNeedBar } from './PortraitNeedBar';

export function PortraitNeedRows({ needs }: { needs: PortraitNeed[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const maxCount = Math.max(1, ...needs.map((n) => n.count));
  return (
    <div className="cpf-needrows">
      {needs.map((n) => {
        const isOpen = openId === n.id;
        const explainer = NEED_EXPLAINER_TEXT[n.id];
        return (
          <div key={n.id}>
            <button type="button" className="cpf-needrow" aria-expanded={isOpen}
              onClick={() => setOpenId((prev) => (prev === n.id ? null : n.id))}>
              <PortraitNeedBar n={n} maxCount={maxCount} />
              <span aria-hidden className="cpf-needrow-chev">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && explainer && <p className="ds-sub cpf-needrow-text">{explainer}</p>}
          </div>
        );
      })}
    </div>
  );
}
