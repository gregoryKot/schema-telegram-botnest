import { useState } from 'react';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryTextArea } from './DiaryTextArea';
import {
  buildModeDiarySteps,
  type ModeDiaryFieldKey,
} from '../../../../shared/src/mode/modeDiarySteps';

/**
 * Визард дневника режимов: один вопрос — один экран (после выбора режима).
 * Обязательна только ситуация; остальное можно пропустить. Сохранить можно в
 * любой момент, как только выбран режим и заполнена ситуация (кнопка в шапке).
 * Контент шагов — shared/mode/modeDiarySteps (правило №3).
 */
export function ModeDiaryWizard({
  values,
  onChange,
  onSave,
  canSave,
  saving,
}: {
  values: Record<ModeDiaryFieldKey, string>;
  onChange: (key: ModeDiaryFieldKey, value: string) => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
}) {
  const tr = useTr();
  const STEPS = buildModeDiarySteps(tr);
  const [step, setStep] = useState(0);

  const cur = STEPS[step];
  const val = values[cur.key];
  const isLast = step === STEPS.length - 1;
  const canNext = cur.required ? val.trim().length > 0 : true;

  const btn = (
    label: string,
    onClick: () => void,
    opts: { primary?: boolean; disabled?: boolean } = {},
  ) => (
    <button
      onClick={onClick}
      disabled={opts.disabled}
      style={{
        flex: opts.primary ? 1 : undefined,
        padding: '13px 18px',
        borderRadius: 12,
        border: 'none',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        cursor: opts.disabled ? 'default' : 'pointer',
        opacity: opts.disabled ? 0.4 : 1,
        background: opts.primary
          ? 'var(--accent-blue)'
          : 'rgba(var(--fg-rgb),0.08)',
        color: opts.primary ? '#fff' : 'var(--text)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginTop: 18 }}>
      {/* Прогресс */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                i < step
                  ? 'var(--accent-blue)'
                  : i === step
                    ? 'rgba(96,165,250,0.45)'
                    : 'rgba(var(--fg-rgb),0.1)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      <div
        style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}
      >
        Шаг {step + 1} из {STEPS.length}
        {!cur.required && ' · можно пропустить'}
      </div>

      {/* Вопрос */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 4,
        }}
      >
        {cur.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
        {cur.hint}
      </div>

      <DiaryTextArea
        value={val}
        onChange={(v) => onChange(cur.key, v)}
        placeholder={cur.example}
        rows={cur.rows}
      />

      {/* Навигация */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {step > 0 &&
          btn('← Назад', () => {
            haptic.tap();
            setStep((s) => s - 1);
          })}
        {isLast
          ? btn(saving ? 'Сохраняю…' : 'Готово', onSave, {
              primary: true,
              disabled: !canSave || saving,
            })
          : btn(
              val.trim() || cur.required ? 'Далее →' : 'Пропустить',
              () => {
                haptic.tap();
                setStep((s) => s + 1);
              },
              { primary: true, disabled: !canNext },
            )}
      </div>
    </div>
  );
}
