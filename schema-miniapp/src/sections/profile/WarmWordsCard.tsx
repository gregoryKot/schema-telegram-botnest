// Карточка-превью «Тёплые слова». Данные приходят из useAboutMe (раньше
// карточка грузила их сама — вторая волна сети, +621мс на 3G). Открытие
// полного списка трекает shared/src/warmWords/useWarmWords внутри WarmWords.
import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import {
  WARM_WORDS_CARD_TITLE,
  WARM_WORDS_CARD_SOURCE,
} from '../../../../shared/src/portrait/portraitTexts';
import { WarmWords } from '../../components/WarmWords';

interface Props {
  items: WarmWordsItem[];
}

export function WarmWordsCard({ items }: Props) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;
  // Детерминированный выбор превью — самая свежая фраза (collectWarmWords
  // уже сортирует по убыванию даты), без Math.random в рендере.
  const preview = items[0];

  return (
    <>
      <div
        {...pressable(() => setOpen(true))}
        className="card"
        style={{
          borderRadius: 'var(--r-20)',
          padding: '16px 16px 18px',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
          }}
        >
          <div className="d-caps">{WARM_WORDS_CARD_TITLE}</div>
          <div className="u-faint12">
            {items.length} {pluralRu(items.length, 'фраза', 'фразы', 'фраз')}
          </div>
        </div>
        <div
          className="d-display"
          style={{
            fontSize: 16,
            lineHeight: 1.45,
            color: 'var(--text)',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
          }}
        >
          «{preview.text}»
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
          {WARM_WORDS_CARD_SOURCE}
        </div>
      </div>

      {open && <WarmWords onClose={() => setOpen(false)} />}
    </>
  );
}
