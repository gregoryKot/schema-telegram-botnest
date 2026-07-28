import { EMOTIONS, INTENSITY_LABELS } from '../../schemaTherapyData';
import type { EmotionEntry } from '../../types';
import { SelectableChip } from './SelectableChip';

// Шаг «Чувства» дневника схем: чипы эмоций + шкала интенсивности выбранных.
// Вынесено из SchemaEntrySheet в подкомпонент визарда (правило №10 CLAUDE.md,
// файл-источник пробивал потолок 300 строк).
export function EmotionsStep({
  emotions,
  onToggle,
  onSetIntensity,
  accentColor,
}: {
  emotions: EmotionEntry[];
  onToggle: (id: string) => void;
  onSetIntensity: (id: string, intensity: number) => void;
  accentColor: string;
}) {
  return (
    <div>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}
      >
        {EMOTIONS.map((em) => (
          <SelectableChip
            key={em.id}
            label={`${em.emoji} ${em.label}`}
            selected={!!emotions.find((e) => e.id === em.id)}
            color="#f87171"
            onClick={() => onToggle(em.id)}
          />
        ))}
      </div>

      {emotions.map((em) => {
        const meta = EMOTIONS.find((e) => e.id === em.id)!;
        return (
          <div
            key={em.id}
            style={{
              marginBottom: 8,
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginBottom: 7,
              }}
            >
              {meta.emoji} {meta.label}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {INTENSITY_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  onClick={() => onSetIntensity(em.id, i + 1)}
                  className="sel-btn"
                  style={{
                    flex: 1,
                    background:
                      em.intensity === i + 1
                        ? accentColor
                        : 'rgba(var(--fg-rgb),0.08)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '5px 2px',
                    color:
                      em.intensity === i + 1
                        ? '#fff'
                        : 'rgba(var(--fg-rgb),0.4)',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
