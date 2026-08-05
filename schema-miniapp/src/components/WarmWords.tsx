import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { SkeletonList } from './Skeleton';
import { SheetIconHeader } from './SheetIconHeader';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { getModeById } from '../schemaTherapyData';
import { useWarmWords } from '../../../shared/src/warmWords/useWarmWords';
import { pluralEntries } from '../../../shared/src/share/shareTexts';

interface Props {
  onClose: () => void;
}

// Откуда слова — подпись под датой (источники collectWarmWords).
const SOURCE_LABELS: Record<'diary' | 'card' | 'phrase', string> = {
  diary: 'дневник',
  card: 'карточка режима',
  phrase: 'разбор фразы',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// «Тёплые слова» — свои же ответы Здорового Взрослого из дневника режимов и
// карточек режимов, собранные в одном месте, чтобы перечитывать в трудный
// момент. Только чтение: детекция кризиса была на этапе записи (правило №7).
export function WarmWords({ onClose }: Props) {
  const tr = useTr();
  const items = useWarmWords(api);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <SheetIconHeader
          emoji="💛"
          bg="rgba(251,191,36,0.12)"
          border="rgba(251,191,36,0.2)"
          title="Тёплые слова"
          subtitle="Слова поддержки от Здорового Взрослого"
        />

        {/* Онбординг в контексте: откуда слова и зачем их перечитывать. */}
        <div
          style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.12)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
          }}
        >
          {tr(
            'Здесь — твои слова: ответы Здорового Взрослого из дневника и карточек режимов, а ещё переписанные фразы из разбора. Перечитывай, когда трудно.',
            'Здесь — ваши слова: ответы Здорового Взрослого из дневника и карточек режимов, а ещё переписанные фразы из разбора. Перечитывайте, когда трудно.',
          )}
        </div>

        {items === null && <SkeletonList rows={4} h={92} />}

        {items !== null && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
              }}
            >
              {tr(
                'Здесь пока пусто. Слова появятся, когда сохранишь ответ Здорового Взрослого — в дневнике режимов или в карточке режима.',
                'Здесь пока пусто. Слова появятся, когда сохраните ответ Здорового Взрослого — в дневнике режимов или в карточке режима.',
              )}
            </div>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                marginBottom: 10,
              }}
            >
              {items.length} {pluralEntries(items.length)}
            </div>
            {items.map((item) => {
              const mode = getModeById(item.modeId);
              return (
                <div
                  key={item.key}
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(var(--fg-rgb),0.03)',
                    border: '1px solid rgba(var(--fg-rgb),0.06)',
                    borderRadius: 14,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                      {item.source === 'phrase'
                        ? '🔎 Переписанная фраза'
                        : mode
                          ? `${mode.emoji} ${mode.name}`
                          : 'Режим'}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {fmtDate(item.at)} · {SOURCE_LABELS[item.source]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'rgba(var(--fg-rgb),0.85)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {item.text}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
