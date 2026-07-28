import { EMOTIONS, INTENSITY_LABELS } from '../../schemaTherapyData';
import { EmotionEntry } from '../../types';

// Выбор чувств в дневнике схем: сетка эмоций + интенсивность выбранных.
// Вынесено из SchemaEntrySheet.tsx (правило №10).
export function EmotionPicker({
  emotions,
  onToggle,
  onSetIntensity,
  color,
}: {
  emotions: EmotionEntry[];
  onToggle: (id: string) => void;
  onSetIntensity: (id: string, intensity: number) => void;
  color: string;
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          marginBottom: 10,
        }}
      >
        {EMOTIONS.map((em) => {
          const sel = emotions.find((e) => e.id === em.id);
          return (
            <button
              key={em.id}
              onClick={() => onToggle(em.id)}
              className="sel-btn"
              style={{
                background: sel ? '#f8717133' : 'rgba(var(--fg-rgb),0.06)',
                border: sel ? '1px solid #f87171' : '1px solid transparent',
                borderRadius: 20,
                padding: '6px 12px',
                color: sel ? 'var(--chip-sel-text)' : 'rgba(var(--fg-rgb),0.6)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {em.emoji} {em.label}
            </button>
          );
        })}
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
                        ? color
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
    </>
  );
}
