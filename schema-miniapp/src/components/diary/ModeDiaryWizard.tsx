import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { DiaryTextArea } from './DiaryTextArea';
import { WizardProgress } from '../WizardProgress';
import { DiaryWizardNav } from './DiaryWizardNav';
import {
  buildModeDiarySteps,
  type ModeDiaryFieldKey,
} from '../../../../shared/src/mode/modeDiarySteps';

/**
 * Визард дневника режимов: один вопрос — один экран (шаг 3 потока, после
 * выбора чувства и режима).
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
  accentColor,
}: {
  values: Record<ModeDiaryFieldKey, string>;
  onChange: (key: ModeDiaryFieldKey, value: string) => void;
  healthyResponse: string;
  onHealthyChange: (value: string) => void;
  healthyHint: string;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  accentColor: string;
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
  // Заполненность каждого шага (поля дневника + шаг Здорового Взрослого) —
  // сегменты прогресса, кликабельны (сохранить можно с любого шага).
  const progressSegments = [
    ...STEPS.map((s) => ({ filled: values[s.key].trim().length > 0 })),
    { filled: healthyResponse.trim().length > 0 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <WizardProgress
          segments={progressSegments}
          active={step}
          accentColor={accentColor}
          onSelect={(i) => setStep(i)}
        />
      </div>
      <div className="d-caps" style={{ marginBottom: 18 }}>
        Шаг {step + 1} из {TOTAL}
        {optional && ' · можно пропустить'}
      </div>

      {/* Вопрос */}
      <div
        id="mode-diary-question"
        className="d-display"
        style={{ fontSize: 21, marginBottom: 8 }}
      >
        {isHa
          ? tr(
              'Что бы сказал твой Здоровый Взрослый?',
              'Что бы сказал ваш Здоровый Взрослый?',
            )
          : cur!.title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
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
            background: 'var(--calm)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 12,
          }}
        >
          <div className="d-caps" style={{ marginBottom: 6 }}>
            Например, можно сказать себе
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--ink-2)',
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
        labelId="mode-diary-question"
      />

      <DiaryWizardNav
        accentColor={accentColor}
        step={step}
        onStep={setStep}
        isLast={isLast}
        filled={val.trim().length > 0}
        optional={optional}
        canNext={canNext}
        canSave={canSave}
        saving={saving}
        onSave={onSave}
      />
    </div>
  );
}
