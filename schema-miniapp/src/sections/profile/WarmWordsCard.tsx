// Карточка-превью «Тёплые слова» — редизайн вкладки «Я». Данные грузятся
// отдельно от useWarmWords (shared/src/warmWords/useWarmWords.ts): тот хук
// трекает WARM_WORDS_OPEN_EVENT при загрузке, а превью на вкладке «Я» — не
// открытие раздела, только карточка списка. Событие остаётся честным —
// считает только реальные открытия полного списка (тап по этой карточке
// рендерит существующий WarmWords, который сам трекает открытие).
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { pressable } from '../../utils/a11y';
import {
  collectWarmWords,
  type WarmWordsItem,
} from '../../../../shared/src/warmWords/collectWarmWords';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { WarmWords } from '../../components/WarmWords';

export function WarmWordsCard() {
  const [items, setItems] = useState<WarmWordsItem[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getModeNotes(), api.getModeDiary(), api.getPhraseChecks()])
      .then(([notes, entries, phrases]) => {
        if (!ignore) setItems(collectWarmWords(notes, entries, phrases));
      })
      .catch((e) => {
        console.error('WarmWordsCard load failed', e);
        if (!ignore) setItems([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (!items || items.length === 0) return null;
  // Детерминированный выбор превью — самая свежая фраза (collectWarmWords
  // уже сортирует по убыванию даты), без Math.random в рендере.
  const preview = items[0];

  return (
    <>
      <div
        {...pressable(() => setOpen(true))}
        className="card"
        style={{
          borderRadius: 20,
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
