// Пять строк потребностей в листе «Мой портрет»: те же полосы, что на карточке.
// Тап по строке раскрывает объяснение потребности — готовый текст
// NEEDS_EXPLAINER (shared/about), третью формулировку не пишем. Аккордеон
// на общей Disclosure: раскрыта одна строка, кнопка ≥44px по высоте.
import { useState } from 'react';
import { Disclosure, type DisclosureClasses } from '../../../../shared/src/components/Disclosure';
import { NEED_EXPLAINER_TEXT } from '../../../../shared/src/portrait/portraitTexts';
import type { PortraitNeed } from '../../../../shared/src/portrait/portraitData';
import { GlyphChevron } from '../../components/exercises/ExGlyphs';
import { PortraitNeedBar } from './PortraitNeedBar';

const ROW: DisclosureClasses = { root: '', btn: 'cpf-needrow', label: 'cpf-needrow-label', chev: 'cpf-needrow-chev', body: '' };

export function PortraitNeedRows({ needs }: { needs: PortraitNeed[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const maxCount = Math.max(1, ...needs.map((n) => n.count));
  return (
    <div className="cpf-needrows">
      {needs.map((n) => {
        const explainer = NEED_EXPLAINER_TEXT[n.id];
        return (
          <Disclosure key={n.id} classes={ROW} chev={<GlyphChevron />}
            title={<PortraitNeedBar n={n} maxCount={maxCount} />}
            open={openId === n.id} onToggle={() => setOpenId((prev) => (prev === n.id ? null : n.id))}>
            {explainer && <p className="ds-sub cpf-needrow-text">{explainer}</p>}
          </Disclosure>
        );
      })}
    </div>
  );
}
