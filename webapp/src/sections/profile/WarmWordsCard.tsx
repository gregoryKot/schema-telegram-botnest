// Карточка-превью «Тёплые слова» в профиле: самая свежая фраза и счётчик.
// Список целиком — существующий экран WarmWordsEx (тот же, что в разделе
// «Практика»; он грузит слова сам и трекает открытие). Данные превью уже
// собраны хуком useAboutMe — второй раз их не запрашиваем. Пусто — карточки
// нет (не выдуманная фраза). Парна schema-miniapp/.../WarmWordsCard.tsx.
import { lazy, Suspense, useState } from 'react';
import { pressable } from '../../utils/a11y';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { WARM_WORDS_CARD_TITLE, WARM_WORDS_CARD_SOURCE } from '../../../../shared/src/portrait/portraitTexts';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';

const WarmWordsEx = lazy(() => import('../../components/exercises/WarmWordsEx').then((m) => ({ default: m.WarmWordsEx })));

export function WarmWordsCard({ items }: { items: WarmWordsItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  // Самая свежая: collectWarmWords уже сортирует по убыванию даты.
  const preview = items[0];
  return (
    <>
      <section {...pressable(() => setOpen(true))} aria-label={WARM_WORDS_CARD_TITLE} className="ds-card ds-card--hover cpf-card">
        <div className="ds-head-row">
          <h2 className="ds-h3">{WARM_WORDS_CARD_TITLE}</h2>
          <span className="ds-sub">{items.length} {pluralRu(items.length, 'фраза', 'фразы', 'фраз')}</span>
        </div>
        <div className="cpf-warm-text">«{preview.text}»</div>
        <div className="cpf-hint">{WARM_WORDS_CARD_SOURCE}</div>
      </section>
      {open && <Suspense fallback={null}><WarmWordsEx onBack={() => setOpen(false)} /></Suspense>}
    </>
  );
}
