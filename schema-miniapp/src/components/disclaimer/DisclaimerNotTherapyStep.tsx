import { DisclaimerCheckbox } from './DisclaimerCheckbox';

// Шаг 2 онбординга Disclaimer: «это не терапия». Перенесено из
// Disclaimer.tsx как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function DisclaimerNotTherapyStep({
  c1,
  setC1,
}: {
  c1: boolean;
  setC1: (updater: (p: boolean) => boolean) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        Важно знать
      </div>
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 16 }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'rgba(var(--fg-rgb),0.7)',
            lineHeight: 1.7,
            marginBottom: 16,
          }}
        >
          «Всё по схеме» — инструмент самоисследования. Оценки, тесты и
          упражнения внутри{' '}
          <strong style={{ color: 'var(--text)' }}>
            не являются клинической диагностикой
          </strong>{' '}
          и не заменяют работу с психологом.
        </div>
        <DisclaimerCheckbox
          checked={c1}
          onToggle={() => setC1((p) => !p)}
          label="Я понимаю, что это инструмент самоисследования, а не клиническая диагностика"
        />
      </div>
    </div>
  );
}
