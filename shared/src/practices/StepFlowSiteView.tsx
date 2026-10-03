// Вёрстка пошагового листа для сайта (variant="site"): editorial — без
// эмодзи-иллюстрации, выравнивание по левому краю; эйбрау «Шаг N из M»,
// serif-заголовок шага, прогресс — тонкие линии-сегменты, «Дальше» — чёрная
// пилюля сайта (.btn-primary), «Закрыть» — текстовая. Логика шагов —
// в StepFlowBody (сюда приходит готовое состояние).
import type { StepFlowViewProps } from './StepFlowBody';

export function StepFlowSiteView({
  title,
  subtitle,
  steps,
  doneExtra,
  onClose,
  step,
  isDone,
  cur,
  nextLabel,
  onNext,
}: StepFlowViewProps) {
  return (
    <div style={{ paddingTop: 4 }}>
      <div className="eyebrow">{title}</div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginTop: 'var(--space-4)',
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--line)',
          marginTop: 'var(--space-16)',
          padding: '20px 0 8px',
        }}
      >
        <div className="eyebrow">
          {isDone ? 'Итог' : `Шаг ${step + 1} из ${steps.length}`}
        </div>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 400,
            fontSize: 24,
            lineHeight: 1.25,
            color: 'var(--text)',
            marginTop: 'var(--space-8)',
          }}
        >
          {cur.title}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            marginTop: 'var(--space-8)',
            lineHeight: 1.6,
          }}
        >
          {cur.hint}
        </div>
        {isDone && doneExtra}
      </div>

      <div
        style={{ display: 'flex', gap: 4, margin: '16px 0 20px' }}
        aria-hidden="true"
      >
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2,
              background: i <= step ? 'var(--text)' : 'var(--line-strong)',
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-16)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--text-sub)',
            fontSize: 14,
            minHeight: 44,
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Закрыть
        </button>
        <button
          className="btn btn-primary"
          style={{
            minHeight: 44,
            padding: '0 28px',
            borderRadius: 999,
            fontSize: 14,
            fontFamily: 'inherit',
          }}
          onClick={onNext}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
