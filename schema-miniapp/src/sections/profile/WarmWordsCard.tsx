// Карточка-превью «Тёплые слова» — редизайн вкладки «Я». Данные приходят уже
// готовыми из useAboutMe (см. её комментарий про «вторую волну»): раньше эта
// карточка грузила getModeNotes/getModeDiary/getPhraseChecks САМА при своём
// монтировании, а монтировалась только после готовности aboutMe — сеть
// уходила вторым кругом (замер 2026-08-22, 3G: +621мс). Теперь карточка
// чисто презентационная, а её собственный скелетон живёт в
// ProfileCardSkeletons.tsx рядом с остальными карточками профиля.
//
// Открытие полного списка по-прежнему трекает WARM_WORDS_OPEN_EVENT — это
// делает shared/src/warmWords/useWarmWords.ts внутри компонента WarmWords,
// сюда трекинг не переезжает: эта карточка — только превью, не открытие.
import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
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
          <div className="d-caps">Мои тёплые слова</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
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
          из карточек и дневников
        </div>
      </div>

      {open && <WarmWords onClose={() => setOpen(false)} />}
    </>
  );
}
