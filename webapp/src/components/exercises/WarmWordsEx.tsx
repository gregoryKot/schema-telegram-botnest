import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { WarmWordNote } from './WarmWordNote';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../Skeleton';
import { PaperAlert } from '../paper/PaperAlert';
import { PaperEmpty } from '../art/PaperEmpty';
import { useWarmWords } from '../../../../shared/src/warmWords/useWarmWords';
import { pluralEntries } from '../../../../shared/src/share/shareTexts';
import { buildWarmWordsTexts } from '../../../../shared/src/warmWords/warmWordsText';

/** Силуэт записок, пока слова грузятся: те же колонки и разная высота, а не три одинаковые плашки. */
const SKELETON_HEIGHTS = [132, 104, 156];

// «Тёплые слова» — свои же ответы Здорового Взрослого из дневника режимов и
// карточек режимов и переписанные фразы, собранные в одном месте. Только
// чтение: кризисная детекция была на этапе записи (правило №7 CLAUDE.md).
// Вид (редизайн 2026-11, b18): герой — лист соломы со знаком ChildCare (ENTITY_LOOK.warm_words), слова —
// записками тёплой бумаги (WarmWordNote): колонкой на телефоне, двумя-тремя на компьютере; пусто —
// чашка с объяснением, откуда появятся слова; сбой — лист соломы (PaperAlert), а не жёлтая плашка.
export function WarmWordsEx({ onBack }: { onBack: () => void }) {
  const text = buildWarmWordsTexts(useTr());
  const goBack = useHistorySheet(onBack);
  const { items, failed } = useWarmWords(api);

  return (
    <ExScreen
      onBack={goBack} caution look="warm_words"
      eyebrow="Ресурс"
      title={
        <>
          Тёплые
          <br />
          <span className="it">слова</span>
        </>
      }
      lede={text.lede}
    >
      {items === null && !failed && (
        <div className="ex2-notes" aria-hidden>
          {SKELETON_HEIGHTS.map((h) => <Skeleton key={h} height={h} radius={20} />)}
        </div>
      )}

      {failed && <PaperAlert sign="child_care" title={text.failed} />}

      {!failed && items !== null && items.length === 0 && (
        <PaperEmpty>{text.empty}</PaperEmpty>
      )}

      {items !== null && items.length > 0 && (
        <>
          <div className="ex2-count">
            {items.length} {pluralEntries(items.length)}
          </div>
          <div className="ex2-notes">
            {items.map((item, i) => <WarmWordNote key={item.key} item={item} index={i} />)}
          </div>
        </>
      )}
    </ExScreen>
  );
}
