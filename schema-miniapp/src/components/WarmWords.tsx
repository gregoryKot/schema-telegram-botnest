import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { SkeletonList } from './Skeleton';
import { SheetIconHeader } from './SheetIconHeader';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { getModeById } from '../schemaTherapyData';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { useWarmWords } from '../../../shared/src/warmWords/useWarmWords';
import { pluralEntries } from '../../../shared/src/share/shareTexts';
import {
  WARM_SOURCE_LABEL,
  buildWarmWordsTexts,
  warmWordTitle,
} from '../../../shared/src/warmWords/warmWordsText';

interface Props {
  onClose: () => void;
}

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
  const text = buildWarmWordsTexts(useTr());
  const { items, failed } = useWarmWords(api);

  return (
    <BottomSheet onClose={onClose}>
      <div className="u-pt4">
        <SheetIconHeader
          title="Тёплые слова"
          subtitle="Слова поддержки от Здорового Взрослого"
        />

        {/* Онбординг в контексте: откуда слова и зачем их перечитывать. */}
        <div
          style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.12)',
            borderRadius: 'var(--r-14)',
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
          }}
        >
          {text.lede}
        </div>

        {items === null && <SkeletonList rows={4} h={92} />}

        {failed && (
          <div
            role="alert"
            style={{
              textAlign: 'center',
              padding: '20px 8px',
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            {text.failed}
          </div>
        )}

        {!failed && items !== null && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div className="u-sub13-lh16">{text.empty}</div>
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
                    borderRadius: 'var(--r-14)',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                      gap: 'var(--space-8)',
                    }}
                  >
                    <span className="u-sub12">
                      {mode && (
                        <>
                          <IdentityDot
                            color={mode.groupColor ?? 'var(--accent)'}
                            size={8}
                          />{' '}
                        </>
                      )}
                      {warmWordTitle(item, mode?.name)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {fmtDate(item.at)} · {WARM_SOURCE_LABEL[item.source]}
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

        <div className="u-mt16">
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
