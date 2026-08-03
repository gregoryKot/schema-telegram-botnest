import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { SkeletonCard } from '../Skeleton';
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
  const items = useWarmWords(api);

  return (
    <ExScreen
      onBack={goBack}
      eyebrow="Ресурс"
      eyebrowColor="var(--c-amber)"
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} height={92} />
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <p className="text-sm muted" style={{ lineHeight: 1.6 }}>
          {tr(
            'Здесь пока пусто. Слова появятся, когда сохранишь ответ Здорового Взрослого — в дневнике режимов или в карточке режима.',
            'Здесь пока пусто. Слова появятся, когда сохраните ответ Здорового Взрослого — в дневнике режимов или в карточке режима.',
          )}
        </p>
      )}

      {items !== null && items.length > 0 && (
        <>
          <div className="text-xs faint" style={{ marginBottom: 14 }}>
            {items.length} {pluralEntries(items.length)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => {
              const mode = getModeById(item.modeId);
              return (
                <div key={item.key} className="aside-card" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span className="text-sm">
                      {mode ? `${mode.emoji} ${mode.name}` : 'Режим'}
                    </span>
                    <span className="text-xs faint" style={{ textAlign: 'right', flexShrink: 0 }}>
                      {fmtDate(item.at)} ·{' '}
                      {item.source === 'diary' ? 'дневник' : 'карточка режима'}
                    </span>
                  </div>
                  <p className="body" style={{ whiteSpace: 'pre-wrap' }}>
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ExScreen>
  );
}
