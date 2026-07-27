import { useTr } from '../../utils/addressForm';
import { buildDiaryExplainers } from '../../../../shared/src/diary/diaryExplainers';
import { DisclaimerTimeChip } from './DisclaimerTimeChip';

// Шаг онбординга про дневники схем и режимов: до этого шага новичок узнал
// про потребности, но названия «Дневник схем/режимов» в разделе «Дневники»
// оставались для него пустым звуком. Контент — общий buildDiaryExplainers
// (тот же, что в пустых состояниях дневников; третьей формулировки нет).
export function DisclaimerDiariesWhyStep() {
  const tr = useTr();
  const ex = buildDiaryExplainers(tr);

  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 14,
        }}
      >
        Дневники схем и режимов
      </div>

      {(['schema', 'mode'] as const).map((type) => (
        <div
          key={type}
          className="card"
          style={{
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>{ex[type].emoji}</span>
          <div
            style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65 }}
          >
            {ex[type].what}
          </div>
        </div>
      ))}

      <DisclaimerTimeChip>
        {tr(
          'Запись — пара минут по шагам-подсказкам. Через 3–5 записей видно паттерн: что запускает и чего тебе на самом деле не хватает.',
          'Запись — пара минут по шагам-подсказкам. Через 3–5 записей видно паттерн: что запускает и чего вам на самом деле не хватает.',
        )}
      </DisclaimerTimeChip>
    </div>
  );
}
