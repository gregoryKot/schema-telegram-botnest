import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { SkeletonCard } from '../Skeleton';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { useWarmWords } from '../../../../shared/src/warmWords/useWarmWords';
import { pluralEntries } from '../../../../shared/src/share/shareTexts';
import { WARM_SOURCE_LABEL, buildWarmWordsTexts, warmWordTitle } from '../../../../shared/src/warmWords/warmWordsText';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// «Тёплые слова» — свои же ответы Здорового Взрослого из дневника режимов и
// карточек режимов и переписанные фразы, собранные в одном месте. Только
// чтение: кризисная детекция была на этапе записи (правило №7 CLAUDE.md).
export function WarmWordsEx({ onBack }: { onBack: () => void }) {
  const text = buildWarmWordsTexts(useTr());
  const goBack = useHistorySheet(onBack);
  const { items, failed } = useWarmWords(api);

  return (
    <ExScreen
      onBack={goBack}
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
      {items === null && (
        <div className="ex2-stack">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} height={92} />
          ))}
        </div>
      )}

      {failed && (
        <div role="alert" className="ds-card ex2-empty">
          {text.failed}
        </div>
      )}

      {!failed && items !== null && items.length === 0 && (
        <p className="ds-card ex2-empty">
          {text.empty}
        </p>
      )}

      {items !== null && items.length > 0 && (
        <>
          <div className="ds-sub ex2-count">
            {items.length} {pluralEntries(items.length)}
          </div>
          <div className="ex2-stack">
            {items.map((item) => {
              const mode = getModeById(item.modeId);
              return (
                <div key={item.key} className="ds-card ds-card--row">
                  <div className="ex2-warm-head">
                    <span className="ex2-warm-mode">
                      {mode && <IdentityDot color={mode.groupColor} />}
                      {warmWordTitle(item, mode?.name)}
                    </span>
                    <span className="ds-sub ex2-warm-when">
                      {fmtDate(item.at)} · {WARM_SOURCE_LABEL[item.source]}
                    </span>
                  </div>
                  <p className="ex2-body-text">{item.text}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ExScreen>
  );
}
