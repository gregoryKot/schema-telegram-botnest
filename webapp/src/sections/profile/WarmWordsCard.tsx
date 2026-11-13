// Плитка «Мои тёплые слова» на витрине профиля: самая свежая фраза Literata и счётчик, бумага и
// знак ENTITY_LOOK.warm_words (ChildCare — тот же знак, что у упражнения и BLOCK_META). Список
// целиком — существующий экран WarmWordsEx (тот же, что в «Практиках»; грузит слова сам и трекает
// открытие). Данные превью собраны useAboutMe — второй раз не запрашиваем. Пусто — плитки нет
// (не выдуманная фраза); профиль и обёртку блока не рисует (ScreenBlock when).
import { lazy, Suspense, useState } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { WARM_WORDS_CARD_TITLE, WARM_WORDS_CARD_SOURCE } from '../../../../shared/src/portrait/portraitTexts';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';
import { ShelfTile } from './ShelfTile';

const WarmWordsEx = lazy(() => import('../../components/exercises/WarmWordsEx').then((m) => ({ default: m.WarmWordsEx })));
export function WarmWordsCard({ items }: { items: WarmWordsItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  // Самая свежая: collectWarmWords уже сортирует по убыванию даты.
  const preview = items[0];
  return (
    <>
      <ShelfTile look={ENTITY_LOOK.warm_words} title={WARM_WORDS_CARD_TITLE} label={WARM_WORDS_CARD_TITLE} onOpen={() => setOpen(true)}
        foot={<span className="pp-meta">{items.length} {pluralRu(items.length, 'фраза', 'фразы', 'фраз')}</span>}>
        <span className="cpf-tile-quote">«{preview.text}»</span>
        <span className="cpf-tile-source">{WARM_WORDS_CARD_SOURCE}</span>
      </ShelfTile>
      {open && <Suspense fallback={null}><WarmWordsEx onBack={() => setOpen(false)} /></Suspense>}
    </>
  );
}
