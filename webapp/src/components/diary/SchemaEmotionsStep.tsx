import { EMOTIONS, INTENSITY_LABELS } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import type { EmotionEntry } from '../../types';
import { SignChip } from '../paper/SignChip';
import '../../styles/sheet-diary.css';

// Шаг «Чувства» дневника схем (webapp): чипы эмоций + шкала интенсивности
// выбранных (полоски растут к «сильно», diary-wizard.css). Вынесено из SchemaEntrySheet
// (правило №10). Чипы — SignChip: выбранное чувство — бумага глины с галочкой.
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
      <div className="sd-chips" style={hueStyle(DIARY_HUE.schema)}>
        {EMOTIONS.map((em) => (
          <SignChip key={em.id} label={em.label} on={emotions.some((e) => e.id === em.id)} onToggle={() => onToggle(em.id)} />
        ))}
      </div>
      {emotions.length > 0 && (
        <div className="sd-int-list" style={hueStyle(DIARY_HUE.schema)}>
          {emotions.map((em) => {
            const meta = EMOTIONS.find((e) => e.id === em.id)!;
            return (
              <div key={em.id} className="sd-int">
                <span className="sd-int-name">{meta.label}</span>
                <div className="sd-int-bar">
                  {INTENSITY_LABELS.map((lbl, i) => (
                    <div
                      key={i}
                      className={'sd-int-step' + (em.intensity >= i + 1 ? ' is-on' : '')}
                      {...pressable(() => onSetIntensity(em.id, i + 1))}
                      title={lbl} aria-label={`${meta.label}: ${lbl}`}
                    />
                  ))}
                </div>
                <span className="sd-int-label">{INTENSITY_LABELS[em.intensity - 1]}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
