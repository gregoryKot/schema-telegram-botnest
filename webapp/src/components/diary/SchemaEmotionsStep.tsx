import { EMOTIONS, INTENSITY_LABELS } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';
import type { EmotionEntry } from '../../types';

// Шаг «Чувства» дневника схем (webapp): чипы эмоций + шкала интенсивности
// выбранных. Вынесено из SchemaEntrySheet — файл-источник пробивал потолок
// 300 строк (правило №10 CLAUDE.md). Разметка — существующие классы webapp
// (chip-row/chip-pill/intensity), перенесены как есть.
export function SchemaEmotionsStep({
  emotions,
  onToggle,
  onSetIntensity,
}: {
  emotions: EmotionEntry[];
  onToggle: (id: string) => void;
  onSetIntensity: (id: string, intensity: number) => void;
}) {
  return (
    <>
      <div className="chip-row">
        {EMOTIONS.map((em) => {
          const sel = emotions.find((e) => e.id === em.id);
          return (
            <button
              key={em.id}
              className={'chip-pill ' + (sel ? 'is-selected' : '')}
              onClick={() => onToggle(em.id)}
            >
              {em.label}
            </button>
          );
        })}
      </div>
      {emotions.length > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: '1px solid var(--line)',
          }}
        >
          {emotions.map((em) => {
            const meta = EMOTIONS.find((e) => e.id === em.id)!;
            return (
              <div
                key={em.id}
                className="intensity"
                style={{ '--int-color': 'var(--c-rose)' } as React.CSSProperties}
              >
                <span className="intensity-name">{meta.label}</span>
                <div className="intensity-bar">
                  {INTENSITY_LABELS.map((lbl, i) => (
                    <div
                      key={i}
                      className={
                        'intensity-step ' + (em.intensity >= i + 1 ? 'is-on' : '')
                      }
                      {...pressable(() => onSetIntensity(em.id, i + 1))}
                      title={lbl}
                    />
                  ))}
                </div>
                <span className="intensity-label">
                  {INTENSITY_LABELS[em.intensity - 1]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
