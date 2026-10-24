import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { SkeletonCard } from '../Skeleton';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { useWarmWords } from '../../../../shared/src/warmWords/useWarmWords';
import { pluralEntries } from '../../../../shared/src/share/shareTexts';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// «Тёплые слова» — свои же ответы Здорового Взрослого из дневника режимов и
// карточек режимов, собранные в одном месте. Только чтение: кризисная
// детекция была на этапе записи (правило №7 CLAUDE.md).
export function WarmWordsEx({ onBack }: { onBack: () => void }) {
  const tr = useTr();
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
      lede={tr(
        'Здесь — твои слова из дневника режимов и карточек режимов: то, что говорит Здоровый Взрослый. Перечитывай, когда трудно.',
        'Здесь — ваши слова из дневника режимов и карточек режимов: то, что говорит Здоровый Взрослый. Перечитывайте, когда трудно.',
      )}
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
          {tr(
            'Не удалось загрузить твои слова. Они на месте — проверь связь и открой ещё раз.',
            'Не удалось загрузить ваши слова. Они на месте — проверьте связь и откройте ещё раз.',
          )}
        </div>
      )}

      {!failed && items !== null && items.length === 0 && (
        <p className="ds-card ex2-empty">
          {tr(
            'Здесь пока пусто. Слова появятся, когда сохранишь ответ Здорового Взрослого — в дневнике режимов или в карточке режима.',
            'Здесь пока пусто. Слова появятся, когда сохраните ответ Здорового Взрослого — в дневнике режимов или в карточке режима.',
          )}
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
                      {mode ? mode.name : 'Режим'}
                    </span>
                    <span className="ds-sub ex2-warm-when">
                      {fmtDate(item.at)} ·{' '}
                      {item.source === 'diary' ? 'дневник' : 'карточка режима'}
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
