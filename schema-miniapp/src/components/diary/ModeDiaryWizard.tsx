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
 * Последний шаг — Здоровый Взрослый: показываем пример-ориентир, а клиент пишет
 * СВОЁ (не готовый ответ). Обязательна только ситуация; остальное можно
 * пропустить, сохранить можно с любого шага (кнопка в шапке).
 * Контент шагов — shared/mode/modeDiarySteps (правило №3).
 */
export function ModeDiaryWizard({
  values,
  onChange,
  healthyResponse,
  onHealthyChange,
  healthyHint,
  onSave,
  canSave,
  saving,
}: {
  values: Record<ModeDiaryFieldKey, string>;
  onChange: (key: ModeDiaryFieldKey, value: string) => void;
  healthyResponse: string;
  onHealthyChange: (value: string) => void;
  healthyHint: string;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
}) {
  const tr = useTr();
  const STEPS = buildModeDiarySteps(tr);
  const TOTAL = STEPS.length + 1; // +1 — шаг Здорового Взрослого
  const [step, setStep] = useState(0);

  const isHa = step === STEPS.length;
  const cur = isHa ? null : STEPS[step];
  const val = isHa ? healthyResponse : values[cur!.key];
  const isLast = step === TOTAL - 1;
  const canNext = isHa ? true : cur!.required ? val.trim().length > 0 : true;
  const optional = isHa || !cur!.required;

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
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div
            key={i}
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
        Шаг {step + 1} из {TOTAL}
        {optional && ' · можно пропустить'}
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
        {isHa
          ? tr(
              'Что бы сказал твой Здоровый Взрослый?',
              'Что бы сказал ваш Здоровый Взрослый?',
            )
          : cur!.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
        {isHa
          ? tr(
              'Своими словами — как поддержал бы тот, кто на твоей стороне.',
              'Своими словами — как поддержал бы тот, кто на вашей стороне.',
            )
          : cur!.hint}
      </div>

      {isHa && (
        <div
          style={{
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent-green)',
              marginBottom: 6,
            }}
          >
            🌿 Например, можно сказать себе
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            «{healthyHint}»
          </div>
        </div>
      )}

      <DiaryTextArea
        value={val}
        onChange={(v) => (isHa ? onHealthyChange(v) : onChange(cur!.key, v))}
        placeholder={
          isHa
            ? tr('Напиши своими словами…', 'Напишите своими словами…')
            : cur!.example
        }
        rows={isHa ? 3 : cur!.rows}
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
              val.trim() || !optional ? 'Далее →' : 'Пропустить',
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
